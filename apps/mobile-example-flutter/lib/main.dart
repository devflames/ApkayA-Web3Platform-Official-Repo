import 'package:apkaya_flutter_sdk/apkaya_flutter_sdk.dart';
import 'package:flutter/material.dart';

const engineUrl = String.fromEnvironment(
  'ENGINE_URL',
  defaultValue: 'http://localhost:3005',
);
const insightUrl = String.fromEnvironment(
  'INSIGHT_URL',
  defaultValue: 'http://localhost:3006',
);
const apiKey = String.fromEnvironment(
  'API_KEY',
  defaultValue: 'dev-secret-key-change-me',
);
const chainId = int.fromEnvironment('CHAIN_ID', defaultValue: 80002);

void main() {
  runApp(const ApkayaExampleApp());
}

class ApkayaExampleApp extends StatefulWidget {
  const ApkayaExampleApp({super.key});

  @override
  State<ApkayaExampleApp> createState() => _ApkayaExampleAppState();
}

class _ApkayaExampleAppState extends State<ApkayaExampleApp> {
  late final ApkayaClient _client = ApkayaClient(
    ApkayaClientOptions(
      baseUrl: engineUrl,
      apiKey: apiKey,
      insightBaseUrl: insightUrl,
    ),
  );
  late final ApkayaConnect _connect = ApkayaConnect(
    client: _client,
    chainId: chainId,
    siweDomain: 'apkaya.dev',
    siweUri: 'apkayaexample://auth',
  );

  final _emailController = TextEditingController(text: 'demo@example.com');
  final _codeController = TextEditingController();

  String _log = '';
  String? _devCode;
  String? _walletId;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await _connect.initialize();
    setState(() {
      _log = _connect.isConnected
          ? 'Restored session: ${_connect.address}'
          : 'Not connected';
    });
  }

  void _append(String line) => setState(() => _log = '$_log\n$line');

  Future<void> _requestOtp() async {
    setState(() => _busy = true);
    try {
      _devCode = await _connect.requestEmailCode(_emailController.text.trim());
      _append('OTP requested${ _devCode != null ? ' (dev: $_devCode)' : ''}');
    } catch (e) {
      _append('OTP error: $e');
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _verifyOtp() async {
    setState(() => _busy = true);
    try {
      final session = await _connect.verifyEmailCode(
        _emailController.text.trim(),
        _codeController.text.trim(),
      );
      _append('Connected: ${session.address}');
    } catch (e) {
      _append('Verify error: $e');
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _readInsight() async {
    final addr = _connect.address;
    if (addr == null) {
      _append('Connect first');
      return;
    }
    setState(() => _busy = true);
    try {
      final rows = await _client.insight.tokenBalances(addr, chainId);
      _append(rows.isEmpty
          ? 'No indexed ERC20 balances'
          : rows.map((r) => '${r.contractAddress}: ${r.balance}').join('\n'));
    } catch (e) {
      _append('Insight error: $e');
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _sendTx() async {
    setState(() => _busy = true);
    try {
      _walletId ??= (await _client.wallets.create('flutter-example')).id;
      final tx = await _client.transactions.send(
        chainId: chainId,
        fromWalletId: _walletId!,
        toAddress: '0x000000000000000000000000000000000000dEaD',
        valueWei: '1000000000000000',
      );
      _append('Queued ${tx.id} (${tx.status})');
      final finalTx = await _client.transactions.waitForMined(tx.id);
      _append('Final ${finalTx.status} hash=${finalTx.txHash ?? '—'}');
    } catch (e) {
      _append('Tx error: $e');
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('ApkayA Flutter Example')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Engine: $engineUrl', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 12),
            const Text('1. Connect (email in-app wallet)', style: TextStyle(fontWeight: FontWeight.bold)),
            TextField(controller: _emailController, decoration: const InputDecoration(labelText: 'Email')),
            TextField(controller: _codeController, decoration: const InputDecoration(labelText: 'OTP code')),
            Wrap(spacing: 8, children: [
              ElevatedButton(onPressed: _busy ? null : _requestOtp, child: const Text('Request OTP')),
              ElevatedButton(onPressed: _busy ? null : _verifyOtp, child: const Text('Verify')),
              if (_connect.isConnected)
                OutlinedButton(onPressed: _connect.disconnect, child: const Text('Disconnect')),
            ]),
            if (_devCode != null) Text('Dev OTP: $_devCode'),
            const SizedBox(height: 16),
            const Text('2. Insight balance', style: TextStyle(fontWeight: FontWeight.bold)),
            ElevatedButton(onPressed: _busy ? null : _readInsight, child: const Text('Read token balances')),
            const SizedBox(height: 16),
            const Text('3. Engine transaction', style: TextStyle(fontWeight: FontWeight.bold)),
            ElevatedButton(onPressed: _busy ? null : _sendTx, child: const Text('Create wallet + send tx')),
            const SizedBox(height: 16),
            Text(_log, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
            if (_busy) const LinearProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
