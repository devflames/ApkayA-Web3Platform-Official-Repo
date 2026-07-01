#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "ApkayaTypes.h"
#include "ApkayaBlueprintLibrary.generated.h"

UCLASS()
class APKAYAUNREAL_API UApkayaBlueprintLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "Apkaya|Config")
    static FApkayaClientConfig MakeApkayaConfig(
        const FString& EngineBaseUrl,
        const FString& ApiKey,
        const FString& InsightBaseUrl);

    UFUNCTION(BlueprintCallable, Category = "Apkaya|Transactions", meta = (AutoCreateRefTerm = "Config"))
    static void ApkayaSendTransaction(
        const FApkayaClientConfig& Config,
        int32 ChainId,
        const FString& FromWalletId,
        const FString& ToAddress,
        const FString& DataHex,
        const FString& ValueWei,
        FApkayaTransactionDelegate Callback);

    UFUNCTION(BlueprintCallable, Category = "Apkaya|Transactions", meta = (AutoCreateRefTerm = "Config"))
    static void ApkayaGetTransactionStatus(
        const FApkayaClientConfig& Config,
        const FString& TransactionId,
        FApkayaTransactionDelegate Callback);

    UFUNCTION(BlueprintCallable, Category = "Apkaya|Contracts", meta = (AutoCreateRefTerm = "Config"))
    static void ApkayaWriteContract(
        const FApkayaClientConfig& Config,
        const FString& ContractId,
        const FString& FromWalletId,
        const FString& FunctionName,
        const FString& ArgsJsonArray,
        const FString& ValueWei,
        FApkayaTransactionDelegate Callback);

    UFUNCTION(BlueprintCallable, Category = "Apkaya|Insight", meta = (AutoCreateRefTerm = "Config"))
    static void ApkayaGetTokenBalances(
        const FApkayaClientConfig& Config,
        const FString& WalletAddress,
        int32 ChainId,
        FApkayaTokenBalancesDelegate Callback);

    UFUNCTION(BlueprintCallable, Category = "Apkaya|Auth", meta = (AutoCreateRefTerm = "Config"))
    static void ApkayaRequestSiweNonce(
        const FApkayaClientConfig& Config,
        const FString& Address,
        int32 ChainId,
        const FString& Domain,
        const FString& Uri,
        const FString& Statement,
        FApkayaSiweNonceDelegate Callback);

    UFUNCTION(BlueprintCallable, Category = "Apkaya|Auth", meta = (AutoCreateRefTerm = "Config"))
    static void ApkayaVerifySiwe(
        const FApkayaClientConfig& Config,
        const FString& Message,
        const FString& Signature,
        FApkayaAuthSessionDelegate Callback);

    /** Display this URI as QR for WalletConnect v2; wire signature callback to ApkayaVerifySiwe. */
    UFUNCTION(BlueprintPure, Category = "Apkaya|WalletConnect")
    static FString ApkayaFormatWalletConnectPairingHint(const FString& PairingUri);
};
