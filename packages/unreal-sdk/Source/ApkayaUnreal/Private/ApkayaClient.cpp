#include "ApkayaClient.h"

#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

namespace
{
    FString TrimTrailingSlash(const FString& Url)
    {
        FString Out = Url;
        while (Out.EndsWith(TEXT("/")))
        {
            Out.LeftChopInline(1, EAllowShrinking::No);
        }
        return Out;
    }

    TSharedPtr<FJsonObject> ParseJsonObject(const FString& Body)
    {
        TSharedPtr<FJsonObject> Root;
        const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Body);
        FJsonSerializer::Deserialize(Reader, Root);
        return Root;
    }

    FString JsonStringField(const TSharedPtr<FJsonObject>& Obj, const FString& Key)
    {
        if (!Obj.IsValid())
        {
            return FString();
        }
        return Obj->GetStringField(Key);
    }

    int32 JsonIntField(const TSharedPtr<FJsonObject>& Obj, const FString& Key)
    {
        if (!Obj.IsValid())
        {
            return 0;
        }
        return static_cast<int32>(Obj->GetNumberField(Key));
    }

    FApkayaTransactionRecord ParseTransaction(const TSharedPtr<FJsonObject>& Obj)
    {
        FApkayaTransactionRecord Tx;
        if (!Obj.IsValid())
        {
            return Tx;
        }
        Tx.Id = JsonStringField(Obj, TEXT("id"));
        Tx.ChainId = JsonIntField(Obj, TEXT("chain_id"));
        Tx.FromWalletId = JsonStringField(Obj, TEXT("from_wallet_id"));
        Tx.ToAddress = JsonStringField(Obj, TEXT("to_address"));
        Tx.Status = JsonStringField(Obj, TEXT("status"));
        Tx.TxHash = JsonStringField(Obj, TEXT("tx_hash"));
        return Tx;
    }

    FApkayaSiweNonceResult ParseSiweNonce(const TSharedPtr<FJsonObject>& Obj)
    {
        FApkayaSiweNonceResult Out;
        if (!Obj.IsValid())
        {
            return Out;
        }
        Out.Nonce = JsonStringField(Obj, TEXT("nonce"));
        Out.Message = JsonStringField(Obj, TEXT("message"));
        Out.ExpiresAt = JsonStringField(Obj, TEXT("expiresAt"));
        return Out;
    }

    FApkayaAuthSession ParseAuthSession(const TSharedPtr<FJsonObject>& Obj)
    {
        FApkayaAuthSession Out;
        if (!Obj.IsValid())
        {
            return Out;
        }
        Out.SessionToken = JsonStringField(Obj, TEXT("sessionToken"));
        Out.ExpiresAt = JsonStringField(Obj, TEXT("expiresAt"));
        Out.Address = JsonStringField(Obj, TEXT("address"));
        Out.AuthMethod = JsonStringField(Obj, TEXT("authMethod"));
        Out.EndUserId = JsonStringField(Obj, TEXT("endUserId"));
        Out.BackendWalletId = JsonStringField(Obj, TEXT("backendWalletId"));
        return Out;
    }

    TArray<FApkayaTokenBalance> ParseTokenBalances(const TSharedPtr<FJsonValue>& ResultValue)
    {
        TArray<FApkayaTokenBalance> Balances;
        if (!ResultValue.IsValid() || ResultValue->Type != EJson::Array)
        {
            return Balances;
        }
        for (const TSharedPtr<FJsonValue>& Item : ResultValue->AsArray())
        {
            const TSharedPtr<FJsonObject> Obj = Item->AsObject();
            FApkayaTokenBalance Balance;
            Balance.ContractAddress = JsonStringField(Obj, TEXT("contract_address"));
            Balance.Balance = JsonStringField(Obj, TEXT("balance"));
            Balances.Add(Balance);
        }
        return Balances;
    }

    TSharedPtr<FJsonObject> UnwrapResult(const FString& Body, FString& OutError)
    {
        const TSharedPtr<FJsonObject> Root = ParseJsonObject(Body);
        if (!Root.IsValid())
        {
            OutError = TEXT("Invalid JSON response");
            return nullptr;
        }
        if (Root->HasField(TEXT("error")))
        {
            OutError = Root->GetStringField(TEXT("error"));
            return nullptr;
        }
        if (!Root->HasField(TEXT("result")))
        {
            OutError = TEXT("Missing result envelope");
            return nullptr;
        }
        const TSharedPtr<FJsonValue> ResultValue = Root->TryGetField(TEXT("result"));
        if (ResultValue->Type == EJson::Object)
        {
            return ResultValue->AsObject();
        }
        OutError = TEXT("Expected object result");
        return nullptr;
    }
}

FApkayaHttpClient::FApkayaHttpClient(const FApkayaClientConfig& InConfig)
    : Config(InConfig)
{
}

FString FApkayaHttpClient::GetEngineUrl() const
{
    return TrimTrailingSlash(Config.EngineBaseUrl);
}

FString FApkayaHttpClient::GetInsightUrl() const
{
    if (!Config.InsightBaseUrl.IsEmpty())
    {
        return TrimTrailingSlash(Config.InsightBaseUrl);
    }
    return TEXT("http://localhost:3006");
}

FString FApkayaHttpClient::ExtractErrorMessage(const FString& ResponseBody, int32 StatusCode)
{
    const TSharedPtr<FJsonObject> Root = ParseJsonObject(ResponseBody);
    if (Root.IsValid() && Root->HasField(TEXT("error")))
    {
        return Root->GetStringField(TEXT("error"));
    }
    if (!ResponseBody.IsEmpty())
    {
        return ResponseBody;
    }
    return FString::Printf(TEXT("HTTP %d"), StatusCode);
}

void FApkayaHttpClient::Request(
    const FString& BaseUrl,
    const FString& Path,
    const FString& Verb,
    const FString& BodyJson,
    const TMap<FString, FString>& ExtraHeaders,
    FApkayaInternalHttpCallback Callback) const
{
    const FString Url = FString::Printf(TEXT("%s%s"), *TrimTrailingSlash(BaseUrl), *Path);
    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(Url);
    Request->SetVerb(Verb);
    Request->SetHeader(TEXT("Authorization"), FString::Printf(TEXT("Bearer %s"), *Config.ApiKey));
    Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));

    for (const TPair<FString, FString>& Header : ExtraHeaders)
    {
        Request->SetHeader(Header.Key, Header.Value);
    }

    if (!BodyJson.IsEmpty() && Verb != TEXT("GET"))
    {
        Request->SetContentAsString(BodyJson);
    }

    Request->OnProcessRequestComplete().BindLambda(
        [Callback = MoveTemp(Callback)](FHttpRequestPtr, FHttpResponsePtr Response, bool bConnected)
        {
            if (!bConnected || !Response.IsValid())
            {
                Callback(false, TEXT("Network error"));
                return;
            }
            const int32 Code = Response->GetResponseCode();
            const FString Body = Response->GetContentAsString();
            if (Code < 200 || Code >= 300)
            {
                Callback(false, ExtractErrorMessage(Body, Code));
                return;
            }
            Callback(true, Body);
        });

    Request->ProcessRequest();
}

FApkayaClient::FApkayaClient(const FApkayaClientConfig& InConfig)
    : Http(InConfig)
{
}

void FApkayaClient::SendTransaction(
    int32 ChainId,
    const FString& FromWalletId,
    const FString& ToAddress,
    const FString& DataHex,
    const FString& ValueWei,
    FApkayaTransactionDelegate Callback) const
{
    TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetNumberField(TEXT("chainId"), ChainId);
    Body->SetStringField(TEXT("fromWalletId"), FromWalletId);
    Body->SetStringField(TEXT("toAddress"), ToAddress);
    Body->SetStringField(TEXT("data"), DataHex.IsEmpty() ? TEXT("0x") : DataHex);
    Body->SetStringField(TEXT("valueWei"), ValueWei.IsEmpty() ? TEXT("0") : ValueWei);

    FString BodyJson;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyJson);
    FJsonSerializer::Serialize(Body.ToSharedRef(), Writer);

    Http.Request(Http.GetEngineUrl(), TEXT("/transaction/send"), TEXT("POST"), BodyJson, {},
        [Callback](bool bSuccess, const FString& ResponseBody)
            {
                if (!bSuccess)
                {
                    Callback.ExecuteIfBound(false, FApkayaTransactionRecord(), ResponseBody);
                    return;
                }
                FString Error;
                const TSharedPtr<FJsonObject> Result = UnwrapResult(ResponseBody, Error);
                if (!Result.IsValid())
                {
                    Callback.ExecuteIfBound(false, FApkayaTransactionRecord(), Error);
                    return;
                }
                Callback.ExecuteIfBound(true, ParseTransaction(Result), FString());
            });
}

void FApkayaClient::GetTransactionStatus(const FString& TxId, FApkayaTransactionDelegate Callback) const
{
    const FString Path = FString::Printf(TEXT("/transaction/status/%s"), *TxId);
    Http.Request(Http.GetEngineUrl(), Path, TEXT("GET"), FString(), {},
        [Callback](bool bSuccess, const FString& ResponseBody)
            {
                if (!bSuccess)
                {
                    Callback.ExecuteIfBound(false, FApkayaTransactionRecord(), ResponseBody);
                    return;
                }
                FString Error;
                const TSharedPtr<FJsonObject> Result = UnwrapResult(ResponseBody, Error);
                if (!Result.IsValid())
                {
                    Callback.ExecuteIfBound(false, FApkayaTransactionRecord(), Error);
                    return;
                }
                Callback.ExecuteIfBound(true, ParseTransaction(Result), FString());
            });
}

void FApkayaClient::WriteContract(
    const FString& ContractId,
    const FString& FromWalletId,
    const FString& FunctionName,
    const FString& ArgsJsonArray,
    const FString& ValueWei,
    FApkayaTransactionDelegate Callback) const
{
    TSharedPtr<FJsonValue> ArgsValue;
    const TSharedRef<TJsonReader<>> ArgsReader = TJsonReaderFactory<>::Create(ArgsJsonArray);
    FJsonSerializer::Deserialize(ArgsReader, ArgsValue);
    if (!ArgsValue.IsValid())
    {
        ArgsValue = MakeShared<FJsonValueArray>(TArray<TSharedPtr<FJsonValue>>());
    }

    TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetStringField(TEXT("fromWalletId"), FromWalletId);
    Body->SetStringField(TEXT("functionName"), FunctionName);
    Body->SetField(TEXT("args"), ArgsValue);
    Body->SetStringField(TEXT("valueWei"), ValueWei.IsEmpty() ? TEXT("0") : ValueWei);

    FString BodyJson;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyJson);
    FJsonSerializer::Serialize(Body.ToSharedRef(), Writer);

    const FString Path = FString::Printf(TEXT("/contract/%s/write"), *ContractId);
    Http.Request(Http.GetEngineUrl(), Path, TEXT("POST"), BodyJson, {},
        [Callback](bool bSuccess, const FString& ResponseBody)
            {
                if (!bSuccess)
                {
                    Callback.ExecuteIfBound(false, FApkayaTransactionRecord(), ResponseBody);
                    return;
                }
                FString Error;
                const TSharedPtr<FJsonObject> Result = UnwrapResult(ResponseBody, Error);
                if (!Result.IsValid())
                {
                    Callback.ExecuteIfBound(false, FApkayaTransactionRecord(), Error);
                    return;
                }
                Callback.ExecuteIfBound(true, ParseTransaction(Result), FString());
            });
}

void FApkayaClient::GetTokenBalances(
    const FString& Address,
    int32 ChainId,
    FApkayaTokenBalancesDelegate Callback) const
{
    const FString Path = FString::Printf(
        TEXT("/insight/tokens/%s/balances?chainId=%d"),
        *Address,
        ChainId);

    Http.Request(Http.GetInsightUrl(), Path, TEXT("GET"), FString(), {},
        [Callback](bool bSuccess, const FString& ResponseBody)
            {
                if (!bSuccess)
                {
                    Callback.ExecuteIfBound(false, TArray<FApkayaTokenBalance>(), ResponseBody);
                    return;
                }
                const TSharedPtr<FJsonObject> Root = ParseJsonObject(ResponseBody);
                if (!Root.IsValid())
                {
                    Callback.ExecuteIfBound(false, TArray<FApkayaTokenBalance>(), TEXT("Invalid JSON"));
                    return;
                }
                if (Root->HasField(TEXT("error")))
                {
                    Callback.ExecuteIfBound(false, TArray<FApkayaTokenBalance>(), Root->GetStringField(TEXT("error")));
                    return;
                }
                const TSharedPtr<FJsonValue> ResultValue = Root->TryGetField(TEXT("result"));
                Callback.ExecuteIfBound(true, ParseTokenBalances(ResultValue), FString());
            });
}

void FApkayaClient::RequestSiweNonce(
    const FString& Address,
    int32 ChainId,
    const FString& Domain,
    const FString& Uri,
    const FString& Statement,
    FApkayaSiweNonceDelegate Callback) const
{
    TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetStringField(TEXT("address"), Address);
    Body->SetNumberField(TEXT("chainId"), ChainId);
    Body->SetStringField(TEXT("domain"), Domain);
    Body->SetStringField(TEXT("uri"), Uri);
    if (!Statement.IsEmpty())
    {
        Body->SetStringField(TEXT("statement"), Statement);
    }

    FString BodyJson;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyJson);
    FJsonSerializer::Serialize(Body.ToSharedRef(), Writer);

    Http.Request(Http.GetEngineUrl(), TEXT("/auth/siwe/nonce"), TEXT("POST"), BodyJson, {},
        [Callback](bool bSuccess, const FString& ResponseBody)
            {
                if (!bSuccess)
                {
                    Callback.ExecuteIfBound(false, FApkayaSiweNonceResult(), ResponseBody);
                    return;
                }
                FString Error;
                const TSharedPtr<FJsonObject> Result = UnwrapResult(ResponseBody, Error);
                if (!Result.IsValid())
                {
                    Callback.ExecuteIfBound(false, FApkayaSiweNonceResult(), Error);
                    return;
                }
                Callback.ExecuteIfBound(true, ParseSiweNonce(Result), FString());
            });
}

void FApkayaClient::VerifySiwe(
    const FString& Message,
    const FString& Signature,
    FApkayaAuthSessionDelegate Callback) const
{
    TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetStringField(TEXT("message"), Message);
    Body->SetStringField(TEXT("signature"), Signature);

    FString BodyJson;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyJson);
    FJsonSerializer::Serialize(Body.ToSharedRef(), Writer);

    Http.Request(Http.GetEngineUrl(), TEXT("/auth/siwe/verify"), TEXT("POST"), BodyJson, {},
        [Callback](bool bSuccess, const FString& ResponseBody)
            {
                if (!bSuccess)
                {
                    Callback.ExecuteIfBound(false, FApkayaAuthSession(), ResponseBody);
                    return;
                }
                FString Error;
                const TSharedPtr<FJsonObject> Result = UnwrapResult(ResponseBody, Error);
                if (!Result.IsValid())
                {
                    Callback.ExecuteIfBound(false, FApkayaAuthSession(), Error);
                    return;
                }
                Callback.ExecuteIfBound(true, ParseAuthSession(Result), FString());
            });
}

void FApkayaClient::RequestEmailCode(const FString& Email, FApkayaInternalHttpCallback Callback) const
{
    TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetStringField(TEXT("email"), Email);

    FString BodyJson;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyJson);
    FJsonSerializer::Serialize(Body.ToSharedRef(), Writer);

    Http.Request(Http.GetEngineUrl(), TEXT("/auth/email/request-code"), TEXT("POST"), BodyJson, {}, Callback);
}

void FApkayaClient::VerifyEmailCode(
    const FString& Email,
    const FString& Code,
    FApkayaAuthSessionDelegate Callback) const
{
    TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
    Body->SetStringField(TEXT("email"), Email);
    Body->SetStringField(TEXT("code"), Code);

    FString BodyJson;
    const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&BodyJson);
    FJsonSerializer::Serialize(Body.ToSharedRef(), Writer);

    Http.Request(Http.GetEngineUrl(), TEXT("/auth/email/verify-code"), TEXT("POST"), BodyJson, {},
        [Callback](bool bSuccess, const FString& ResponseBody)
            {
                if (!bSuccess)
                {
                    Callback.ExecuteIfBound(false, FApkayaAuthSession(), ResponseBody);
                    return;
                }
                FString Error;
                const TSharedPtr<FJsonObject> Result = UnwrapResult(ResponseBody, Error);
                if (!Result.IsValid())
                {
                    Callback.ExecuteIfBound(false, FApkayaAuthSession(), Error);
                    return;
                }
                Callback.ExecuteIfBound(true, ParseAuthSession(Result), FString());
            });
}
