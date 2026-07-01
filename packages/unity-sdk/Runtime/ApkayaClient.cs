using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Apkaya.UnitySdk
{
    [Serializable]
    public class BackendWallet
    {
        public string id;
        public string label;
        public string address;
        public string key_type;
        public string created_at;
        public int is_active;
    }

    [Serializable]
    public class TransactionRecord
    {
        public string id;
        public int chain_id;
        public string from_wallet_id;
        public string to_address;
        public string status;
        public string tx_hash;
    }

    [Serializable]
    public class ChainConfig
    {
        public int chainId;
        public string name;
        public string rpcUrl;
    }

    [Serializable]
    public class ContractDetail
    {
        public string id;
        public int chain_id;
        public string address;
        public string name;
        public List<object> abi;
        public List<ContractFunctionInfo> functions;
    }

    [Serializable]
    public class ContractFunctionInfo
    {
        public string name;
        public string stateMutability;
    }

    [Serializable]
    public class TokenBalance
    {
        public string contract_address;
        public string balance;
    }

    [Serializable]
    public class SiweNonceResult
    {
        public string nonce;
        public string message;
        public string expiresAt;
    }

    [Serializable]
    public class AuthSessionResult
    {
        public string sessionToken;
        public string expiresAt;
        public string address;
        public string authMethod;
        public string endUserId;
        public string backendWalletId;
    }

    public sealed class ApkayaClient
    {
        public ApkayaClient(ApkayaConfig config)
        {
            Config = config ?? throw new ArgumentNullException(nameof(config));
        }

        public ApkayaConfig Config { get; }

        public Task<BackendWallet> CreateWalletAsync(string label) =>
            ApkayaHttp.RequestAsync<BackendWallet>(Config, Config.NormalizedEngineUrl,
                "/backend-wallet/create", "POST", new { label });

        public Task<List<BackendWallet>> ListWalletsAsync() =>
            ApkayaHttp.RequestAsync<List<BackendWallet>>(Config, Config.NormalizedEngineUrl,
                "/backend-wallet");

        public Task<BackendWallet> GetWalletAsync(string id) =>
            ApkayaHttp.RequestAsync<BackendWallet>(Config, Config.NormalizedEngineUrl,
                $"/backend-wallet/{id}");

        public Task<TransactionRecord> SendTransactionAsync(
            int chainId,
            string fromWalletId,
            string toAddress,
            string data = "0x",
            string valueWei = "0",
            string idempotencyKey = null) =>
            ApkayaHttp.RequestAsync<TransactionRecord>(Config, Config.NormalizedEngineUrl,
                "/transaction/send", "POST", new
                {
                    chainId,
                    fromWalletId,
                    toAddress,
                    data,
                    valueWei,
                    idempotencyKey
                });

        public Task<TransactionRecord> GetTransactionStatusAsync(string id) =>
            ApkayaHttp.RequestAsync<TransactionRecord>(Config, Config.NormalizedEngineUrl,
                $"/transaction/status/{id}");

        public Task<List<ChainConfig>> ListChainsAsync() =>
            ApkayaHttp.RequestAsync<List<ChainConfig>>(Config, Config.NormalizedEngineUrl, "/chain");

        public Task<ContractDetail> GetContractAsync(string contractId) =>
            ApkayaHttp.RequestAsync<ContractDetail>(Config, Config.NormalizedEngineUrl,
                $"/contract/{contractId}");

        public Task<TransactionRecord> WriteContractAsync(
            string contractId,
            string fromWalletId,
            string functionName,
            object[] args = null,
            string valueWei = "0") =>
            ApkayaHttp.RequestAsync<TransactionRecord>(Config, Config.NormalizedEngineUrl,
                $"/contract/{contractId}/write", "POST", new
                {
                    fromWalletId,
                    functionName,
                    args = args ?? Array.Empty<object>(),
                    valueWei
                });

        public Task<object> ReadContractAsync(string contractId, string functionName, object[] args = null) =>
            ApkayaHttp.RequestAsync<object>(Config, Config.NormalizedEngineUrl,
                $"/contract/{contractId}/read", "POST", new
                {
                    functionName,
                    args = args ?? Array.Empty<object>()
                });

        public Task<List<TokenBalance>> GetTokenBalancesAsync(string address, int chainId) =>
            ApkayaHttp.RequestAsync<List<TokenBalance>>(Config, Config.NormalizedInsightUrl,
                $"/insight/tokens/{Uri.EscapeDataString(address)}/balances?chainId={chainId}");

        public Task<SiweNonceResult> SiweNonceAsync(string address, int chainId, string domain, string uri, string statement = null) =>
            ApkayaHttp.RequestAsync<SiweNonceResult>(Config, Config.NormalizedEngineUrl,
                "/auth/siwe/nonce", "POST", new { address, chainId, domain, uri, statement });

        public Task<AuthSessionResult> SiweVerifyAsync(string message, string signature) =>
            ApkayaHttp.RequestAsync<AuthSessionResult>(Config, Config.NormalizedEngineUrl,
                "/auth/siwe/verify", "POST", new { message, signature });

        public Task<Dictionary<string, object>> EmailRequestCodeAsync(string email) =>
            ApkayaHttp.RequestAsync<Dictionary<string, object>>(Config, Config.NormalizedEngineUrl,
                "/auth/email/request-code", "POST", new { email });

        public Task<AuthSessionResult> EmailVerifyCodeAsync(string email, string code) =>
            ApkayaHttp.RequestAsync<AuthSessionResult>(Config, Config.NormalizedEngineUrl,
                "/auth/email/verify-code", "POST", new { email, code });

        public async Task<TransactionRecord> WaitForMinedAsync(string txId, int timeoutMs = 120000, int intervalMs = 2000)
        {
            var start = DateTime.UtcNow;
            while ((DateTime.UtcNow - start).TotalMilliseconds < timeoutMs)
            {
                var tx = await GetTransactionStatusAsync(txId);
                if (tx.status is "mined" or "reverted" or "errored" or "cancelled")
                    return tx;
                await Task.Delay(intervalMs);
            }
            throw new TimeoutException($"Timed out waiting for transaction {txId}");
        }
    }
}
