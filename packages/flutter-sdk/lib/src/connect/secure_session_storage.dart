import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _inAppSessionKey = 'apkaya_connect_in_app_session';
const _siweSessionTokenKey = 'apkaya_siwe_session_token';

/// iOS Keychain / Android Keystore session storage (same security bar as RN keychain).
class SecureSessionStorage {
  SecureSessionStorage({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  final FlutterSecureStorage _storage;

  Future<void> saveInAppSession(Map<String, dynamic> session) async {
    await _storage.write(key: _inAppSessionKey, value: jsonEncode(session));
  }

  Future<Map<String, dynamic>?> loadInAppSession() async {
    final raw = await _storage.read(key: _inAppSessionKey);
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  Future<void> clearInAppSession() async {
    await _storage.delete(key: _inAppSessionKey);
  }

  Future<void> saveSiweSessionToken(String token) async {
    await _storage.write(key: _siweSessionTokenKey, value: token);
  }

  Future<String?> loadSiweSessionToken() async {
    return _storage.read(key: _siweSessionTokenKey);
  }

  Future<void> clearSiweSessionToken() async {
    await _storage.delete(key: _siweSessionTokenKey);
  }

  Future<void> clearAll() async {
    await clearInAppSession();
    await clearSiweSessionToken();
  }
}
