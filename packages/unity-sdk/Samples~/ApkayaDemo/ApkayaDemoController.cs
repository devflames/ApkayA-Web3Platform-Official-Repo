using System.Threading.Tasks;
using Apkaya.UnitySdk.Connect;
using UnityEngine;
using UnityEngine.UI;

namespace Apkaya.UnitySdk.Samples
{
    /// <summary>
    /// Sample controller for the ApkayA Demo scene.
    /// Attach to a Canvas with Text + Button references, or drive from your own UI.
    /// </summary>
    public class ApkayaDemoController : MonoBehaviour, IApkayaExternalWallet
    {
        [Header("Engine")]
        public string engineBaseUrl = "http://localhost:3005";
        public string insightBaseUrl = "http://localhost:3006";
        public string apiKey = "dev-secret-key-change-me";
        public int chainId = 80002;

        [Header("Demo targets")]
        public string contractId = "";
        public string backendWalletId = "";

        [Header("UI (optional)")]
        public Text statusText;

        private ApkayaClient _client;
        private ApkayaConnect _connect;
        private ApkayaWalletConnectSession _wcSession = new();
        private string _mockAddress = "0x1111111111111111111111111111111111111111";

        private void Awake()
        {
            var config = new ApkayaConfig
            {
                EngineBaseUrl = engineBaseUrl,
                InsightBaseUrl = insightBaseUrl,
                ApiKey = apiKey
            };
            _client = new ApkayaClient(config);
            _connect = new ApkayaConnect(_client, chainId, "apkaya.game", "apkaya://auth");
            Log("Ready — use Connect / Balance / Contract Write buttons");
        }

        public async void OnConnectWalletClicked()
        {
            try
            {
                Log("Connecting external wallet + SIWE…");
                var session = await _connect.ConnectWithExternalWalletAsync(this);
                Log($"Connected {session.address}\nSession expires {session.expiresAt}");
            }
            catch (System.Exception ex)
            {
                Log($"Connect failed: {ex.Message}");
            }
        }

        public async void OnShowInsightBalancesClicked()
        {
            if (!_connect.IsConnected)
            {
                Log("Connect wallet first");
                return;
            }
            try
            {
                var balances = await _client.GetTokenBalancesAsync(_connect.ConnectedAddress, chainId);
                if (balances == null || balances.Count == 0)
                {
                    Log("No indexed ERC20 balances (Insight)");
                    return;
                }
                var lines = "";
                foreach (var b in balances)
                    lines += $"{b.contract_address}: {b.balance}\n";
                Log($"Insight balances:\n{lines}");
            }
            catch (System.Exception ex)
            {
                Log($"Insight error: {ex.Message}");
            }
        }

        public async void OnContractWriteClicked()
        {
            if (string.IsNullOrEmpty(contractId) || string.IsNullOrEmpty(backendWalletId))
            {
                Log("Set contractId and backendWalletId in inspector");
                return;
            }
            try
            {
                Log("Queueing contract write via Engine…");
                var tx = await _client.WriteContractAsync(
                    contractId,
                    backendWalletId,
                    "mintTo",
                    new object[] { _connect.ConnectedAddress ?? _mockAddress, "1000000000000000000" });
                Log($"Queued tx {tx.id} ({tx.status})");
                var finalTx = await _client.WaitForMinedAsync(tx.id);
                Log($"Final status: {finalTx.status} hash={finalTx.tx_hash}");
            }
            catch (System.Exception ex)
            {
                Log($"Contract write error: {ex.Message}");
            }
        }

        public void OnDisplayWalletConnectUri(string uri)
        {
            _wcSession.SetPairingUri(uri);
            Log($"WalletConnect URI (show as QR):\n{uri}");
        }

        // IApkayaExternalWallet — replace with real WalletConnect v2 integration in production.
        public Task<string> ConnectAsync()
        {
            _wcSession.SetConnectedAddress(_mockAddress);
            return Task.FromResult(_mockAddress);
        }

        public Task<string> SignMessageAsync(string message)
        {
            // Production: return signature from connected WC wallet.
            return Task.FromResult("0x" + new string('a', 130));
        }

        public Task DisconnectAsync()
        {
            _connect.Disconnect();
            _wcSession.Clear();
            return Task.CompletedTask;
        }

        private void Log(string msg)
        {
            Debug.Log("[ApkayaDemo] " + msg);
            if (statusText != null) statusText.text = msg;
        }
    }
}
