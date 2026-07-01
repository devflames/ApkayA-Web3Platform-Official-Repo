import '../apkaya_client.dart';
import '../models/models.dart';
import 'secure_session_storage.dart';

/// Mobile wallet connect — WalletConnect v2 (Reown AppKit) + SIWE + email in-app wallet.
class ApkayaConnect {
  ApkayaConnect({
    required this.client,
    required this.chainId,
    SecureSessionStorage? storage,
    this.siweDomain,
    this.siweUri,
    this.siweStatement,
  }) : storage = storage ?? SecureSessionStorage();

  final ApkayaClient client;
  final int chainId;
  final SecureSessionStorage storage;
  final String? siweDomain;
  final String? siweUri;
  final String? siweStatement;

  String? _address;
  String? _sessionToken;
  AuthSessionResult? _inAppSession;

  String? get address => _address;
  String? get sessionToken => _sessionToken;
  bool get isConnected => _address != null;

  /// Restore persisted in-app email session on cold start.
  Future<void> initialize() async {
    _sessionToken = await storage.loadSiweSessionToken();
    final raw = await storage.loadInAppSession();
    if (raw != null) {
      _inAppSession = AuthSessionResult.fromJson(raw);
      _address = _inAppSession!.address;
      _sessionToken ??= _inAppSession!.sessionToken;
    }
  }

  /// Complete SIWE after an external wallet returns address + signature.
  Future<AuthSessionResult> completeSiwe({
    required String walletAddress,
    required String signature,
    required String message,
  }) async {
    final session = await client.auth.siweVerify(message: message, signature: signature);
    _address = session.address;
    _sessionToken = session.sessionToken;
    await storage.saveSiweSessionToken(session.sessionToken);
    return session;
  }

  /// Request SIWE nonce/message for external wallet signing.
  Future<SiweNonceResult> prepareSiwe(String walletAddress) {
    if (siweDomain == null || siweUri == null) {
      throw StateError('siweDomain and siweUri are required for SIWE.');
    }
    return client.auth.siweNonce(
      address: walletAddress,
      chainId: chainId,
      domain: siweDomain!,
      uri: siweUri!,
      statement: siweStatement,
    );
  }

  /// Start email OTP — returns devCode when ENGINE_AUTH_DEV_LOG_OTP=true.
  Future<String?> requestEmailCode(String email) async {
    final result = await client.auth.emailRequestCode(email);
    return result['devCode'] as String?;
  }

  /// Verify email OTP and establish in-app custody wallet session.
  Future<AuthSessionResult> verifyEmailCode(String email, String code) async {
    final session = await client.auth.emailVerifyCode(email: email, code: code);
    _inAppSession = session;
    _address = session.address;
    _sessionToken = session.sessionToken;
    await storage.saveInAppSession(session.toJson());
    await storage.saveSiweSessionToken(session.sessionToken);
    return session;
  }

  /// Sign via in-app custody wallet (email sessions).
  Future<String> signMessage(String message) async {
    final token = _sessionToken;
    if (token == null) throw StateError('Not connected.');
    final result = await client.auth.inAppSignMessage(token, message);
    return result['signature'] as String;
  }

  /// Queue tx via in-app custody wallet.
  Future<TransactionRecord> sendInAppTransaction({
    required String toAddress,
    String? data,
    String? valueWei,
    String? idempotencyKey,
  }) async {
    final token = _sessionToken;
    if (token == null) throw StateError('Not connected.');
    return client.auth.inAppSendTransaction(
      token,
      chainId: chainId,
      toAddress: toAddress,
      data: data,
      valueWei: valueWei,
      idempotencyKey: idempotencyKey,
    );
  }

  Future<void> disconnect() async {
    _address = null;
    _sessionToken = null;
    _inAppSession = null;
    await storage.clearAll();
  }
}

/// WalletConnect v2 via Reown AppKit — initialize in your app widget tree.
///
/// See packages/flutter-sdk/README.md for AppKit setup (project ID, deep links).
/// After AppKit returns a connected address, call [ApkayaConnect.prepareSiwe] +
/// [ApkayaConnect.completeSiwe] to issue an Engine session JWT.
class ApkayaWalletConnect {
  ApkayaWalletConnect({
    required this.projectId,
    required this.appLinkScheme,
  });

  final String projectId;
  final String appLinkScheme;
}
