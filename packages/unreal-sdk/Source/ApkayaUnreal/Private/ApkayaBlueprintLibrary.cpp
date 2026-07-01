#include "ApkayaBlueprintLibrary.h"
#include "ApkayaClient.h"

FApkayaClientConfig UApkayaBlueprintLibrary::MakeApkayaConfig(
    const FString& EngineBaseUrl,
    const FString& ApiKey,
    const FString& InsightBaseUrl)
{
    FApkayaClientConfig Config;
    Config.EngineBaseUrl = EngineBaseUrl;
    Config.ApiKey = ApiKey;
    Config.InsightBaseUrl = InsightBaseUrl;
    return Config;
}

void UApkayaBlueprintLibrary::ApkayaSendTransaction(
    const FApkayaClientConfig& Config,
    int32 ChainId,
    const FString& FromWalletId,
    const FString& ToAddress,
    const FString& DataHex,
    const FString& ValueWei,
    FApkayaTransactionDelegate Callback)
{
    FApkayaClient(Config).SendTransaction(ChainId, FromWalletId, ToAddress, DataHex, ValueWei, Callback);
}

void UApkayaBlueprintLibrary::ApkayaGetTransactionStatus(
    const FApkayaClientConfig& Config,
    const FString& TransactionId,
    FApkayaTransactionDelegate Callback)
{
    FApkayaClient(Config).GetTransactionStatus(TransactionId, Callback);
}

void UApkayaBlueprintLibrary::ApkayaWriteContract(
    const FApkayaClientConfig& Config,
    const FString& ContractId,
    const FString& FromWalletId,
    const FString& FunctionName,
    const FString& ArgsJsonArray,
    const FString& ValueWei,
    FApkayaTransactionDelegate Callback)
{
    FApkayaClient(Config).WriteContract(
        ContractId, FromWalletId, FunctionName, ArgsJsonArray, ValueWei, Callback);
}

void UApkayaBlueprintLibrary::ApkayaGetTokenBalances(
    const FApkayaClientConfig& Config,
    const FString& WalletAddress,
    int32 ChainId,
    FApkayaTokenBalancesDelegate Callback)
{
    FApkayaClient(Config).GetTokenBalances(WalletAddress, ChainId, Callback);
}

void UApkayaBlueprintLibrary::ApkayaRequestSiweNonce(
    const FApkayaClientConfig& Config,
    const FString& Address,
    int32 ChainId,
    const FString& Domain,
    const FString& Uri,
    const FString& Statement,
    FApkayaSiweNonceDelegate Callback)
{
    FApkayaClient(Config).RequestSiweNonce(Address, ChainId, Domain, Uri, Statement, Callback);
}

void UApkayaBlueprintLibrary::ApkayaVerifySiwe(
    const FApkayaClientConfig& Config,
    const FString& Message,
    const FString& Signature,
    FApkayaAuthSessionDelegate Callback)
{
    FApkayaClient(Config).VerifySiwe(Message, Signature, Callback);
}

FString UApkayaBlueprintLibrary::ApkayaFormatWalletConnectPairingHint(const FString& PairingUri)
{
    if (PairingUri.IsEmpty())
    {
        return TEXT("Provide a WalletConnect v2 pairing URI from your WC integration.");
    }
    return FString::Printf(
        TEXT("Display as QR or open deep link:\n%s"),
        *PairingUri);
}
