using System;
using System.Threading.Tasks;

namespace Apkaya.UnitySdk.Connect
{
    /// <summary>
    /// External wallet signer — implement with WalletConnect v2 (QR / deep link) or platform SDK.
    /// The SDK does not embed WalletConnect; your game supplies address + signatures.
    /// </summary>
    public interface IApkayaExternalWallet
    {
        Task<string> ConnectAsync();
        Task<string> SignMessageAsync(string message);
        Task DisconnectAsync();
    }

    /// <summary>
    /// SIWE + optional email in-app session against Engine /auth/* — same flow as @apkaya/connect.
    /// </summary>
    public sealed class ApkayaConnect
    {
        private readonly ApkayaClient _client;
        private readonly int _chainId;
        private readonly string _siweDomain;
        private readonly string _siweUri;
        private readonly string _siweStatement;

        public ApkayaConnect(
            ApkayaClient client,
            int chainId,
            string siweDomain,
            string siweUri,
            string siweStatement = null)
        {
            _client = client;
            _chainId = chainId;
            _siweDomain = siweDomain;
            _siweUri = siweUri;
            _siweStatement = siweStatement;
        }

        public string ConnectedAddress { get; private set; }
        public string SessionToken { get; private set; }
        public bool IsConnected => !string.IsNullOrEmpty(ConnectedAddress);

        /// <summary>
        /// Connect external wallet via WalletConnect (or other) then complete SIWE against Engine.
        /// </summary>
        public async Task<AuthSessionResult> ConnectWithExternalWalletAsync(IApkayaExternalWallet wallet)
        {
            var address = await wallet.ConnectAsync();
            var nonce = await _client.SiweNonceAsync(address, _chainId, _siweDomain, _siweUri, _siweStatement);
            var signature = await wallet.SignMessageAsync(nonce.message);
            var session = await _client.SiweVerifyAsync(nonce.message, signature);
            ConnectedAddress = session.address;
            SessionToken = session.sessionToken;
            return session;
        }

        /// <summary>Email OTP in-app custody wallet (Engine creates backend wallet).</summary>
        public async Task<string> RequestEmailCodeAsync(string email)
        {
            var result = await _client.EmailRequestCodeAsync(email);
            return result.TryGetValue("devCode", out var code) ? code?.ToString() : null;
        }

        public async Task<AuthSessionResult> VerifyEmailCodeAsync(string email, string code)
        {
            var session = await _client.EmailVerifyCodeAsync(email, code);
            ConnectedAddress = session.address;
            SessionToken = session.sessionToken;
            return session;
        }

        public void Disconnect()
        {
            ConnectedAddress = null;
            SessionToken = null;
        }
    }

    /// <summary>
    /// Helper for WalletConnect v2 QR / deep-link UX in Unity.
    /// Display <see cref="PairingUri"/> as a QR code; open on mobile via deep link.
    /// Wire <see cref="IApkayaExternalWallet"/> to your WalletConnect Unity integration
    /// (e.g. WalletConnect Unity Modal / WalletConnectSharp).
    /// </summary>
    public sealed class ApkayaWalletConnectSession
    {
        public string PairingUri { get; private set; }
        public string ConnectedAddress { get; private set; }

        public void SetPairingUri(string uri) => PairingUri = uri;
        public void SetConnectedAddress(string address) => ConnectedAddress = address;
        public void Clear()
        {
            PairingUri = null;
            ConnectedAddress = null;
        }
    }
}
