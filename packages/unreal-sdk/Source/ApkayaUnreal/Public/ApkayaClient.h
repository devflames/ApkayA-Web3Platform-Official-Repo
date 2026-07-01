#pragma once

#include "CoreMinimal.h"
#include "ApkayaTypes.h"

class APKAYAUNREAL_API FApkayaHttpClient
{
public:
    explicit FApkayaHttpClient(const FApkayaClientConfig& InConfig);

    void Request(
        const FString& BaseUrl,
        const FString& Path,
        const FString& Verb,
        const FString& BodyJson,
        const TMap<FString, FString>& ExtraHeaders,
        FApkayaInternalHttpCallback Callback) const;

    FString GetEngineUrl() const;
    FString GetInsightUrl() const;

private:
    FApkayaClientConfig Config;
    static FString ExtractErrorMessage(const FString& ResponseBody, int32 StatusCode);
};

class APKAYAUNREAL_API FApkayaClient
{
public:
    explicit FApkayaClient(const FApkayaClientConfig& InConfig);

    void SendTransaction(
        int32 ChainId,
        const FString& FromWalletId,
        const FString& ToAddress,
        const FString& DataHex,
        const FString& ValueWei,
        FApkayaTransactionDelegate Callback) const;

    void GetTransactionStatus(const FString& TxId, FApkayaTransactionDelegate Callback) const;

    void WriteContract(
        const FString& ContractId,
        const FString& FromWalletId,
        const FString& FunctionName,
        const FString& ArgsJsonArray,
        const FString& ValueWei,
        FApkayaTransactionDelegate Callback) const;

    void GetTokenBalances(
        const FString& Address,
        int32 ChainId,
        FApkayaTokenBalancesDelegate Callback) const;

    void RequestSiweNonce(
        const FString& Address,
        int32 ChainId,
        const FString& Domain,
        const FString& Uri,
        const FString& Statement,
        FApkayaSiweNonceDelegate Callback) const;

    void VerifySiwe(
        const FString& Message,
        const FString& Signature,
        FApkayaAuthSessionDelegate Callback) const;

    void RequestEmailCode(const FString& Email, FApkayaInternalHttpCallback Callback) const;

    void VerifyEmailCode(
        const FString& Email,
        const FString& Code,
        FApkayaAuthSessionDelegate Callback) const;

private:
    FApkayaHttpClient Http;
};
