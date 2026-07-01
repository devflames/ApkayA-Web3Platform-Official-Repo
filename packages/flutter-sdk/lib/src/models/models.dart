class BackendWallet {
  BackendWallet({
    required this.id,
    required this.label,
    required this.address,
    required this.keyType,
    required this.createdAt,
    required this.isActive,
  });

  final String id;
  final String label;
  final String address;
  final String keyType;
  final String createdAt;
  final int isActive;

  factory BackendWallet.fromJson(Map<String, dynamic> json) => BackendWallet(
        id: json['id'] as String,
        label: json['label'] as String,
        address: json['address'] as String,
        keyType: json['key_type'] as String,
        createdAt: json['created_at'] as String,
        isActive: json['is_active'] as int,
      );
}

class TransactionRecord {
  TransactionRecord({
    required this.id,
    required this.chainId,
    required this.fromWalletId,
    required this.toAddress,
    required this.status,
    this.txHash,
    this.extra = const {},
  });

  final String id;
  final int chainId;
  final String fromWalletId;
  final String toAddress;
  final String status;
  final String? txHash;
  final Map<String, dynamic> extra;

  factory TransactionRecord.fromJson(Map<String, dynamic> json) => TransactionRecord(
        id: json['id'] as String,
        chainId: json['chain_id'] as int,
        fromWalletId: json['from_wallet_id'] as String,
        toAddress: json['to_address'] as String,
        status: json['status'] as String,
        txHash: json['tx_hash'] as String?,
        extra: Map<String, dynamic>.from(json),
      );
}

class ChainConfig {
  ChainConfig({required this.chainId, required this.name, required this.rpcUrl});
  final int chainId;
  final String name;
  final String rpcUrl;

  factory ChainConfig.fromJson(Map<String, dynamic> json) => ChainConfig(
        chainId: json['chainId'] as int,
        name: json['name'] as String,
        rpcUrl: json['rpcUrl'] as String,
      );
}

class ApiKeyRecord {
  ApiKeyRecord({
    required this.id,
    required this.label,
    required this.keyPrefix,
    required this.createdAt,
    this.lastUsedAt,
    this.revokedAt,
    required this.isActive,
    this.rateLimitPerMinute,
  });

  final String id;
  final String label;
  final String keyPrefix;
  final String createdAt;
  final String? lastUsedAt;
  final String? revokedAt;
  final int isActive;
  final int? rateLimitPerMinute;

  factory ApiKeyRecord.fromJson(Map<String, dynamic> json) => ApiKeyRecord(
        id: json['id'] as String,
        label: json['label'] as String,
        keyPrefix: json['key_prefix'] as String,
        createdAt: json['created_at'] as String,
        lastUsedAt: json['last_used_at'] as String?,
        revokedAt: json['revoked_at'] as String?,
        isActive: json['is_active'] as int,
        rateLimitPerMinute: json['rate_limit_per_minute'] as int?,
      );
}

class CreatedApiKey extends ApiKeyRecord {
  CreatedApiKey({
    required super.id,
    required super.label,
    required super.keyPrefix,
    required super.createdAt,
    super.lastUsedAt,
    super.revokedAt,
    required super.isActive,
    super.rateLimitPerMinute,
    required this.key,
  });

  final String key;

  factory CreatedApiKey.fromJson(Map<String, dynamic> json) => CreatedApiKey(
        id: json['id'] as String,
        label: json['label'] as String,
        keyPrefix: json['key_prefix'] as String,
        createdAt: json['created_at'] as String,
        lastUsedAt: json['last_used_at'] as String?,
        revokedAt: json['revoked_at'] as String?,
        isActive: json['is_active'] as int,
        rateLimitPerMinute: json['rate_limit_per_minute'] as int?,
        key: json['key'] as String,
      );
}

class DeployedContract {
  DeployedContract({
    required this.id,
    required this.chainId,
    required this.address,
    required this.name,
    required this.abiJson,
    this.deployerWalletId,
    required this.deployedAt,
    this.txId,
  });

  final String id;
  final int chainId;
  final String address;
  final String name;
  final String abiJson;
  final String? deployerWalletId;
  final String deployedAt;
  final String? txId;

  factory DeployedContract.fromJson(Map<String, dynamic> json) => DeployedContract(
        id: json['id'] as String,
        chainId: json['chain_id'] as int,
        address: json['address'] as String,
        name: json['name'] as String,
        abiJson: json['abi_json'] as String,
        deployerWalletId: json['deployer_wallet_id'] as String?,
        deployedAt: json['deployed_at'] as String,
        txId: json['tx_id'] as String?,
      );
}

class ContractFunctionInfo {
  ContractFunctionInfo({
    required this.name,
    required this.stateMutability,
    required this.inputs,
    required this.outputs,
  });

  final String name;
  final String stateMutability;
  final List<Map<String, String>> inputs;
  final List<Map<String, String>> outputs;

  factory ContractFunctionInfo.fromJson(Map<String, dynamic> json) => ContractFunctionInfo(
        name: json['name'] as String,
        stateMutability: json['stateMutability'] as String,
        inputs: (json['inputs'] as List<dynamic>)
            .map((e) => Map<String, String>.from(e as Map))
            .toList(),
        outputs: (json['outputs'] as List<dynamic>)
            .map((e) => Map<String, String>.from(e as Map))
            .toList(),
      );
}

class ContractDetail {
  ContractDetail({
    required this.id,
    required this.chainId,
    required this.address,
    required this.name,
    this.deployerWalletId,
    required this.deployedAt,
    this.txId,
    required this.abi,
    required this.functions,
  });

  final String id;
  final int chainId;
  final String address;
  final String name;
  final String? deployerWalletId;
  final String deployedAt;
  final String? txId;
  final List<dynamic> abi;
  final List<ContractFunctionInfo> functions;

  factory ContractDetail.fromJson(Map<String, dynamic> json) => ContractDetail(
        id: json['id'] as String,
        chainId: json['chain_id'] as int,
        address: json['address'] as String,
        name: json['name'] as String,
        deployerWalletId: json['deployer_wallet_id'] as String?,
        deployedAt: json['deployed_at'] as String,
        txId: json['tx_id'] as String?,
        abi: json['abi'] as List<dynamic>,
        functions: (json['functions'] as List<dynamic>)
            .map((e) => ContractFunctionInfo.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class InsightEvent {
  InsightEvent({
    required this.id,
    required this.chainId,
    required this.blockNumber,
    required this.blockHash,
    required this.txHash,
    required this.logIndex,
    required this.contractAddress,
    required this.eventName,
    required this.decodedArgsJson,
    required this.indexedAt,
  });

  final String id;
  final int chainId;
  final String blockNumber;
  final String blockHash;
  final String txHash;
  final int logIndex;
  final String contractAddress;
  final String eventName;
  final Map<String, dynamic> decodedArgsJson;
  final String indexedAt;

  factory InsightEvent.fromJson(Map<String, dynamic> json) => InsightEvent(
        id: json['id'] as String,
        chainId: json['chain_id'] as int,
        blockNumber: json['block_number'] as String,
        blockHash: json['block_hash'] as String,
        txHash: json['tx_hash'] as String,
        logIndex: json['log_index'] as int,
        contractAddress: json['contract_address'] as String,
        eventName: json['event_name'] as String,
        decodedArgsJson: Map<String, dynamic>.from(json['decoded_args_json'] as Map),
        indexedAt: json['indexed_at'] as String,
      );
}

class TokenBalance {
  TokenBalance({required this.contractAddress, required this.balance});
  final String contractAddress;
  final String balance;

  factory TokenBalance.fromJson(Map<String, dynamic> json) => TokenBalance(
        contractAddress: json['contract_address'] as String,
        balance: json['balance'] as String,
      );
}

class NftOwned {
  NftOwned({
    required this.contractAddress,
    required this.tokenId,
    required this.balance,
    required this.standard,
  });

  final String contractAddress;
  final String tokenId;
  final String balance;
  final String standard;

  factory NftOwned.fromJson(Map<String, dynamic> json) => NftOwned(
        contractAddress: json['contract_address'] as String,
        tokenId: json['token_id'] as String,
        balance: json['balance'] as String,
        standard: json['standard'] as String,
      );
}

class IndexerChainStatus {
  IndexerChainStatus({
    required this.chainId,
    required this.lastIndexedBlock,
    this.updatedAt,
  });

  final int chainId;
  final String lastIndexedBlock;
  final String? updatedAt;

  factory IndexerChainStatus.fromJson(Map<String, dynamic> json) => IndexerChainStatus(
        chainId: json['chain_id'] as int,
        lastIndexedBlock: json['last_indexed_block'] as String,
        updatedAt: json['updated_at'] as String?,
      );
}

class SiweNonceResult {
  SiweNonceResult({required this.nonce, required this.message, required this.expiresAt});
  final String nonce;
  final String message;
  final String expiresAt;

  factory SiweNonceResult.fromJson(Map<String, dynamic> json) => SiweNonceResult(
        nonce: json['nonce'] as String,
        message: json['message'] as String,
        expiresAt: json['expiresAt'] as String,
      );
}

class AuthSessionResult {
  AuthSessionResult({
    required this.sessionToken,
    required this.expiresAt,
    required this.address,
    required this.authMethod,
    required this.endUserId,
    this.backendWalletId,
  });

  final String sessionToken;
  final String expiresAt;
  final String address;
  final String authMethod;
  final String endUserId;
  final String? backendWalletId;

  factory AuthSessionResult.fromJson(Map<String, dynamic> json) => AuthSessionResult(
        sessionToken: json['sessionToken'] as String,
        expiresAt: json['expiresAt'] as String,
        address: json['address'] as String,
        authMethod: json['authMethod'] as String,
        endUserId: json['endUserId'] as String,
        backendWalletId: json['backendWalletId'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'sessionToken': sessionToken,
        'expiresAt': expiresAt,
        'address': address,
        'authMethod': authMethod,
        'endUserId': endUserId,
        'backendWalletId': backendWalletId,
      };
}

class WalletBalance {
  WalletBalance({required this.address, required this.chainId, required this.balanceWei});
  final String address;
  final int chainId;
  final String balanceWei;

  factory WalletBalance.fromJson(Map<String, dynamic> json) => WalletBalance(
        address: json['address'] as String,
        chainId: json['chainId'] as int,
        balanceWei: json['balanceWei'] as String,
      );
}
