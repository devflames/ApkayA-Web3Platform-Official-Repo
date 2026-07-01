#pragma once

#include "CoreMinimal.h"
#include "ApkayaTypes.generated.h"

USTRUCT(BlueprintType)
struct FApkayaBackendWallet
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString Id;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString Label;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString Address;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString KeyType;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString CreatedAt;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    int32 IsActive = 0;
};

USTRUCT(BlueprintType)
struct FApkayaTransactionRecord
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString Id;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    int32 ChainId = 0;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString FromWalletId;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString ToAddress;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString Status;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString TxHash;
};

USTRUCT(BlueprintType)
struct FApkayaTokenBalance
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString ContractAddress;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString Balance;
};

USTRUCT(BlueprintType)
struct FApkayaSiweNonceResult
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString Nonce;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString Message;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString ExpiresAt;
};

USTRUCT(BlueprintType)
struct FApkayaAuthSession
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString SessionToken;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString ExpiresAt;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString Address;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString AuthMethod;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString EndUserId;

    UPROPERTY(BlueprintReadOnly, Category = "Apkaya")
    FString BackendWalletId;
};

USTRUCT(BlueprintType)
struct FApkayaClientConfig
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Apkaya")
    FString EngineBaseUrl = TEXT("http://localhost:3005");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Apkaya")
    FString InsightBaseUrl = TEXT("http://localhost:3006");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Apkaya")
    FString ApiKey = TEXT("dev-secret-key-change-me");
};

DECLARE_DYNAMIC_DELEGATE_TwoParams(FApkayaHttpResponseDelegate, bool, bSuccess, const FString&, ResponseBody);
DECLARE_DYNAMIC_DELEGATE_ThreeParams(FApkayaTransactionDelegate, bool, bSuccess, const FApkayaTransactionRecord&, Transaction, const FString&, Error);
DECLARE_DYNAMIC_DELEGATE_ThreeParams(FApkayaTokenBalancesDelegate, bool, bSuccess, const TArray<FApkayaTokenBalance>&, Balances, const FString&, Error);
DECLARE_DYNAMIC_DELEGATE_ThreeParams(FApkayaSiweNonceDelegate, bool, bSuccess, const FApkayaSiweNonceResult&, NonceResult, const FString&, Error);
DECLARE_DYNAMIC_DELEGATE_ThreeParams(FApkayaAuthSessionDelegate, bool, bSuccess, const FApkayaAuthSession&, Session, const FString&, Error);

using FApkayaInternalHttpCallback = TFunction<void(bool bSuccess, const FString& ResponseBody)>;
