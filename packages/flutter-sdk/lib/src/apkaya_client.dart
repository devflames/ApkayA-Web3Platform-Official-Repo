import 'dart:convert';

import 'package:http/http.dart' as http;

import '../exceptions/apkaya_exception.dart';
import '../models/models.dart';

class ApkayaClientOptions {
  ApkayaClientOptions({
    required this.baseUrl,
    required this.apiKey,
    this.insightBaseUrl,
    http.Client? httpClient,
  }) : httpClient = httpClient ?? http.Client();

  final String baseUrl;
  final String apiKey;
  final String? insightBaseUrl;
  final http.Client httpClient;

  String get engineBaseUrl => baseUrl.replaceAll(RegExp(r'/+$'), '');

  String get insightUrl {
    if (insightBaseUrl != null) {
      return insightBaseUrl!.replaceAll(RegExp(r'/+$'), '');
    }
    final uri = Uri.tryParse(engineBaseUrl);
    if (uri == null) return 'http://localhost:3006';
    final port = uri.port == 3005 || uri.port == 0 ? 3006 : uri.port;
    return uri.replace(port: port).origin;
  }
}

class ApkayaClient {
  ApkayaClient(ApkayaClientOptions options)
      : _options = options,
        wallets = ApkayaWalletsApi(options),
        transactions = ApkayaTransactionsApi(options),
        chains = ApkayaChainsApi(options),
        contracts = ApkayaContractsApi(options),
        apiKeys = ApkayaApiKeysApi(options),
        auth = ApkayaAuthApi(options),
        bridge = ApkayaBridgeApi(options),
        insight = ApkayaInsightApi(options);

  final ApkayaClientOptions _options;
  ApkayaClientOptions get options => _options;

  final ApkayaWalletsApi wallets;
  final ApkayaTransactionsApi transactions;
  final ApkayaChainsApi chains;
  final ApkayaContractsApi contracts;
  final ApkayaApiKeysApi apiKeys;
  final ApkayaAuthApi auth;
  final ApkayaBridgeApi bridge;
  final ApkayaInsightApi insight;
}

Future<T> _request<T>(
  ApkayaClientOptions options,
  String baseUrl,
  String path, {
  String method = 'GET',
  Map<String, dynamic>? body,
  Map<String, String>? extraHeaders,
  T Function(Map<String, dynamic> json)? map,
  T Function(List<dynamic> json)? mapList,
}) async {
  final uri = Uri.parse('$baseUrl$path');
  final headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${options.apiKey}',
    ...?extraHeaders,
  };

  late http.Response response;
  switch (method) {
    case 'POST':
      response = await options.httpClient.post(
        uri,
        headers: headers,
        body: body == null ? null : jsonEncode(body),
      );
      break;
    default:
      response = await options.httpClient.get(uri, headers: headers);
  }

  final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
  if (response.statusCode >= 400) {
    final message = decoded is Map && decoded['error'] != null
        ? decoded['error'] as String
        : response.reasonPhrase ?? 'Request failed';
    throw ApkayaException(response.statusCode, message);
  }

  final result = decoded is Map ? decoded['result'] : null;
  if (mapList != null) {
    return mapList(result as List<dynamic>);
  }
  if (map != null) {
    return map(Map<String, dynamic>.from(result as Map));
  }
  return result as T;
}

class ApkayaWalletsApi {
  ApkayaWalletsApi(this._options);
  final ApkayaClientOptions _options;

  Future<BackendWallet> create(String label) => _request(
        _options,
        _options.engineBaseUrl,
        '/backend-wallet/create',
        method: 'POST',
        body: {'label': label},
        map: BackendWallet.fromJson,
      );

  Future<List<BackendWallet>> list() => _request(
        _options,
        _options.engineBaseUrl,
        '/backend-wallet',
        mapList: (json) => json.map((e) => BackendWallet.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<BackendWallet> get(String id) => _request(
        _options,
        _options.engineBaseUrl,
        '/backend-wallet/$id',
        map: BackendWallet.fromJson,
      );

  Future<WalletBalance> balance(String id, int chainId) => _request(
        _options,
        _options.engineBaseUrl,
        '/backend-wallet/$id/balance?chainId=$chainId',
        map: WalletBalance.fromJson,
      );
}

class ApkayaTransactionsApi {
  ApkayaTransactionsApi(this._options);
  final ApkayaClientOptions _options;

  Future<TransactionRecord> send({
    required int chainId,
    required String fromWalletId,
    required String toAddress,
    String? data,
    String? valueWei,
    String? idempotencyKey,
    Map<String, dynamic>? metadata,
  }) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/transaction/send',
        method: 'POST',
        body: {
          'chainId': chainId,
          'fromWalletId': fromWalletId,
          'toAddress': toAddress,
          if (data != null) 'data': data,
          if (valueWei != null) 'valueWei': valueWei,
          if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
          if (metadata != null) 'metadata': metadata,
        },
        map: TransactionRecord.fromJson,
      );

  Future<TransactionRecord> status(String id) => _request(
        _options,
        _options.engineBaseUrl,
        '/transaction/status/$id',
        map: TransactionRecord.fromJson,
      );

  Future<List<TransactionRecord>> list({
    String? status,
    String? walletId,
    int? chainId,
    int? limit,
  }) {
    final params = <String, String>{};
    if (status != null) params['status'] = status;
    if (walletId != null) params['walletId'] = walletId;
    if (chainId != null) params['chainId'] = '$chainId';
    if (limit != null) params['limit'] = '$limit';
    final qs = params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
    return _request(
      _options,
      _options.engineBaseUrl,
      '/transaction${qs.isEmpty ? '' : '?$qs'}',
      mapList: (json) =>
          json.map((e) => TransactionRecord.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  Future<Map<String, dynamic>> cancel(String id) => _request(
        _options,
        _options.engineBaseUrl,
        '/transaction/cancel/$id',
        method: 'POST',
        map: (json) => json,
      );

  Future<TransactionRecord> waitForMined(
    String id, {
    Duration timeout = const Duration(minutes: 2),
    Duration interval = const Duration(seconds: 2),
  }) async {
    final end = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(end)) {
      final tx = await status(id);
      if (['mined', 'reverted', 'errored', 'cancelled'].contains(tx.status)) {
        return tx;
      }
      await Future<void>.delayed(interval);
    }
    throw ApkayaException(408, 'Timed out waiting for transaction $id');
  }
}

class ApkayaChainsApi {
  ApkayaChainsApi(this._options);
  final ApkayaClientOptions _options;

  Future<List<ChainConfig>> list() => _request(
        _options,
        _options.engineBaseUrl,
        '/chain',
        mapList: (json) => json.map((e) => ChainConfig.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class ApkayaContractsApi {
  ApkayaContractsApi(this._options);
  final ApkayaClientOptions _options;

  Future<DeployedContract> register({
    required int chainId,
    required String address,
    required String name,
    required List<dynamic> abi,
    String? deployerWalletId,
    String? txId,
  }) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/contract/register',
        method: 'POST',
        body: {
          'chainId': chainId,
          'address': address,
          'name': name,
          'abi': abi,
          if (deployerWalletId != null) 'deployerWalletId': deployerWalletId,
          if (txId != null) 'txId': txId,
        },
        map: DeployedContract.fromJson,
      );

  Future<List<DeployedContract>> list({int? chainId, int? limit}) {
    final params = <String, String>{};
    if (chainId != null) params['chainId'] = '$chainId';
    if (limit != null) params['limit'] = '$limit';
    final qs = params.entries.map((e) => '${e.key}=${e.value}').join('&');
    return _request(
      _options,
      _options.engineBaseUrl,
      '/contract${qs.isEmpty ? '' : '?$qs'}',
      mapList: (json) =>
          json.map((e) => DeployedContract.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  Future<ContractDetail> get(String id) => _request(
        _options,
        _options.engineBaseUrl,
        '/contract/$id',
        map: ContractDetail.fromJson,
      );

  Future<Map<String, dynamic>> read(String id, String functionName, {List<dynamic>? args}) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/contract/$id/read',
        method: 'POST',
        body: {'functionName': functionName, 'args': args ?? []},
        map: (json) => json,
      );

  Future<TransactionRecord> write(
    String id, {
    required String fromWalletId,
    required String functionName,
    List<dynamic>? args,
    String? valueWei,
    String? idempotencyKey,
    Map<String, dynamic>? metadata,
  }) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/contract/$id/write',
        method: 'POST',
        body: {
          'fromWalletId': fromWalletId,
          'functionName': functionName,
          if (args != null) 'args': args,
          if (valueWei != null) 'valueWei': valueWei,
          if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
          if (metadata != null) 'metadata': metadata,
        },
        map: TransactionRecord.fromJson,
      );
}

class ApkayaApiKeysApi {
  ApkayaApiKeysApi(this._options);
  final ApkayaClientOptions _options;

  Future<CreatedApiKey> create(String label, {int? rateLimitPerMinute}) => _request(
        _options,
        _options.engineBaseUrl,
        '/api-key/create',
        method: 'POST',
        body: {
          'label': label,
          if (rateLimitPerMinute != null) 'rateLimitPerMinute': rateLimitPerMinute,
        },
        map: CreatedApiKey.fromJson,
      );

  Future<List<ApiKeyRecord>> list() => _request(
        _options,
        _options.engineBaseUrl,
        '/api-key',
        mapList: (json) => json.map((e) => ApiKeyRecord.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<ApiKeyRecord> get(String id) => _request(
        _options,
        _options.engineBaseUrl,
        '/api-key/$id',
        map: ApiKeyRecord.fromJson,
      );

  Future<Map<String, dynamic>> revoke(String id) => _request(
        _options,
        _options.engineBaseUrl,
        '/api-key/$id/revoke',
        method: 'POST',
        map: (json) => json,
      );

  Future<Map<String, dynamic>> reactivate(String id) => _request(
        _options,
        _options.engineBaseUrl,
        '/api-key/$id/reactivate',
        method: 'POST',
        map: (json) => json,
      );

  Future<Map<String, dynamic>> setRateLimit(String id, int? rateLimitPerMinute) => _request(
        _options,
        _options.engineBaseUrl,
        '/api-key/$id/rate-limit',
        method: 'POST',
        body: {'rateLimitPerMinute': rateLimitPerMinute},
        map: (json) => json,
      );
}

class ApkayaAuthApi {
  ApkayaAuthApi(this._options);
  final ApkayaClientOptions _options;

  Future<SiweNonceResult> siweNonce({
    required String address,
    required int chainId,
    required String domain,
    required String uri,
    String? statement,
  }) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/auth/siwe/nonce',
        method: 'POST',
        body: {
          'address': address,
          'chainId': chainId,
          'domain': domain,
          'uri': uri,
          if (statement != null) 'statement': statement,
        },
        map: SiweNonceResult.fromJson,
      );

  Future<AuthSessionResult> siweVerify({required String message, required String signature}) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/auth/siwe/verify',
        method: 'POST',
        body: {'message': message, 'signature': signature},
        map: AuthSessionResult.fromJson,
      );

  Future<Map<String, dynamic>> emailRequestCode(String email) => _request(
        _options,
        _options.engineBaseUrl,
        '/auth/email/request-code',
        method: 'POST',
        body: {'email': email},
        map: (json) => json,
      );

  Future<AuthSessionResult> emailVerifyCode({required String email, required String code}) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/auth/email/verify-code',
        method: 'POST',
        body: {'email': email, 'code': code},
        map: AuthSessionResult.fromJson,
      );

  Future<Map<String, dynamic>> session(String sessionToken) => _request(
        _options,
        _options.engineBaseUrl,
        '/auth/session',
        extraHeaders: {'X-Apkaya-Session': sessionToken},
        map: (json) => json,
      );

  Future<Map<String, dynamic>> inAppSignMessage(String sessionToken, String message) => _request(
        _options,
        _options.engineBaseUrl,
        '/auth/in-app/sign-message',
        method: 'POST',
        extraHeaders: {'X-Apkaya-Session': sessionToken},
        body: {'message': message},
        map: (json) => json,
      );

  Future<TransactionRecord> inAppSendTransaction(
    String sessionToken, {
    required int chainId,
    required String toAddress,
    String? data,
    String? valueWei,
    String? idempotencyKey,
  }) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/auth/in-app/send-transaction',
        method: 'POST',
        extraHeaders: {'X-Apkaya-Session': sessionToken},
        body: {
          'chainId': chainId,
          'toAddress': toAddress,
          if (data != null) 'data': data,
          if (valueWei != null) 'valueWei': valueWei,
          if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
        },
        map: TransactionRecord.fromJson,
      );
}

class ApkayaBridgeApi {
  ApkayaBridgeApi(this._options);
  final ApkayaClientOptions _options;

  Future<Map<String, dynamic>> supported() => _request(
        _options,
        _options.engineBaseUrl,
        '/bridge/supported',
        map: (json) => json,
      );

  Future<Map<String, dynamic>> onrampSession({
    required String address,
    required int chainId,
    required String clientIp,
    List<String>? assets,
    int? presetFiatAmount,
  }) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/bridge/onramp/session',
        method: 'POST',
        body: {
          'address': address,
          'chainId': chainId,
          'clientIp': clientIp,
          if (assets != null) 'assets': assets,
          if (presetFiatAmount != null) 'presetFiatAmount': presetFiatAmount,
        },
        map: (json) => json,
      );

  Future<Map<String, dynamic>> swapQuote({
    required int chainId,
    required String fromToken,
    required String toToken,
    required String fromAmount,
    required String taker,
    int? slippageBps,
  }) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/bridge/swap/quote',
        method: 'POST',
        body: {
          'chainId': chainId,
          'fromToken': fromToken,
          'toToken': toToken,
          'fromAmount': fromAmount,
          'taker': taker,
          if (slippageBps != null) 'slippageBps': slippageBps,
        },
        map: (json) => json,
      );

  Future<Map<String, dynamic>> swapExecute({
    required int chainId,
    required String fromToken,
    required String toToken,
    required String fromAmount,
    required String taker,
    int? slippageBps,
  }) =>
      _request(
        _options,
        _options.engineBaseUrl,
        '/bridge/swap/execute',
        method: 'POST',
        body: {
          'chainId': chainId,
          'fromToken': fromToken,
          'toToken': toToken,
          'fromAmount': fromAmount,
          'taker': taker,
          if (slippageBps != null) 'slippageBps': slippageBps,
        },
        map: (json) => json,
      );
}

class ApkayaInsightApi {
  ApkayaInsightApi(this._options);
  final ApkayaClientOptions _options;

  Future<List<IndexerChainStatus>> status() => _request(
        _options,
        _options.insightUrl,
        '/insight/status',
        mapList: (json) =>
            json.map((e) => IndexerChainStatus.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<TokenBalance>> tokenBalances(String address, int chainId) => _request(
        _options,
        _options.insightUrl,
        '/insight/tokens/${Uri.encodeComponent(address)}/balances?chainId=$chainId',
        mapList: (json) =>
            json.map((e) => TokenBalance.fromJson(e as Map<String, dynamic>)).toList(),
      );

  Future<List<NftOwned>> nftsOwned(String address, {required int chainId, String? contractAddress}) {
    final params = 'chainId=$chainId${contractAddress != null ? '&contractAddress=$contractAddress' : ''}';
    return _request(
      _options,
      _options.insightUrl,
      '/insight/nfts/${Uri.encodeComponent(address)}/owned?$params',
      mapList: (json) => json.map((e) => NftOwned.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  Future<List<InsightEvent>> transfers({
    required int chainId,
    String? contractAddress,
    int? fromBlock,
    int? toBlock,
    int? limit,
  }) {
    final params = <String, String>{'chainId': '$chainId'};
    if (contractAddress != null) params['contractAddress'] = contractAddress;
    if (fromBlock != null) params['fromBlock'] = '$fromBlock';
    if (toBlock != null) params['toBlock'] = '$toBlock';
    if (limit != null) params['limit'] = '$limit';
    final qs = params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
    return _request(
      _options,
      _options.insightUrl,
      '/insight/transfers?$qs',
      mapList: (json) =>
          json.map((e) => InsightEvent.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }

  Future<List<InsightEvent>> events({
    required int chainId,
    String? contractAddress,
    String? eventName,
    int? limit,
  }) {
    final params = <String, String>{'chainId': '$chainId'};
    if (contractAddress != null) params['contractAddress'] = contractAddress;
    if (eventName != null) params['eventName'] = eventName;
    if (limit != null) params['limit'] = '$limit';
    final qs = params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
    return _request(
      _options,
      _options.insightUrl,
      '/insight/events?$qs',
      mapList: (json) =>
          json.map((e) => InsightEvent.fromJson(e as Map<String, dynamic>)).toList(),
    );
  }
}
