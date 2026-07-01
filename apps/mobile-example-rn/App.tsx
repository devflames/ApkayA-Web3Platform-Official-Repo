import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MobileConnectProvider, useMobileConnect } from "@apkaya/mobile-sdk";

const ENGINE_URL = process.env.EXPO_PUBLIC_ENGINE_URL ?? "http://localhost:3005";
const INSIGHT_URL = process.env.EXPO_PUBLIC_INSIGHT_URL ?? "http://localhost:3006";
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? "dev-secret-key-change-me";
const CHAIN_ID = Number(process.env.EXPO_PUBLIC_CHAIN_ID ?? 80002);
const WC_PROJECT_ID = process.env.EXPO_PUBLIC_WC_PROJECT_ID ?? "";

function DemoScreen() {
  const {
    client,
    address,
    isConnected,
    isConnecting,
    connectWalletConnect,
    connectInAppEmail,
    verifyInAppEmail,
    disconnect,
    walletConnectUri,
    error,
  } = useMobileConnect();

  const [email, setEmail] = useState("demo@example.com");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [balances, setBalances] = useState<string>("—");
  const [walletId, setWalletId] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>("—");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sub = Linking.addEventListener("url", () => {
      /* @walletconnect/react-native-compat handles WC return URLs */
    });
    return () => sub.remove();
  }, []);

  async function handleInsightBalance() {
    if (!address) return;
    setLoading(true);
    try {
      const rows = await client.insight.tokenBalances(address, CHAIN_ID);
      setBalances(rows.length ? rows.map((r) => `${r.contract_address}: ${r.balance}`).join("\n") : "No indexed ERC20 balances");
    } catch (err) {
      setBalances(err instanceof Error ? err.message : "Insight error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTx() {
    setLoading(true);
    try {
      let id = walletId;
      if (!id) {
        const wallet = await client.wallets.create("mobile-example");
        id = wallet.id;
        setWalletId(id);
      }
      const tx = await client.transactions.send({
        chainId: CHAIN_ID,
        fromWalletId: id,
        toAddress: "0x000000000000000000000000000000000000dEaD",
        valueWei: "1000000000000000",
      });
      setTxStatus(`Queued ${tx.id} (${tx.status})`);
      const mined = await client.transactions.waitForMined(tx.id, { timeoutMs: 120_000 });
      setTxStatus(`Final: ${mined.status} hash=${mined.tx_hash ?? "—"}`);
    } catch (err) {
      setTxStatus(err instanceof Error ? err.message : "Tx failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>ApkayA Mobile Example (RN)</Text>
      <Text style={styles.meta}>Engine: {ENGINE_URL}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>1. Connect wallet</Text>
      {isConnected ? (
        <>
          <Text>Connected: {address}</Text>
          <Button title="Disconnect" onPress={() => disconnect()} />
        </>
      ) : (
        <>
          <Button
            title={isConnecting ? "Connecting…" : "WalletConnect"}
            onPress={() => connectWalletConnect().catch(() => undefined)}
            disabled={!WC_PROJECT_ID || isConnecting}
          />
          {!WC_PROJECT_ID ? (
            <Text style={styles.hint}>Set EXPO_PUBLIC_WC_PROJECT_ID for WalletConnect</Text>
          ) : null}
          {walletConnectUri ? <Text style={styles.hint}>WC URI opened: {walletConnectUri.slice(0, 40)}…</Text> : null}
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" />
          <Button
            title="Request email OTP"
            onPress={async () => {
              const r = await connectInAppEmail(email);
              setDevCode(r.devCode ?? null);
            }}
          />
          {devCode ? <Text style={styles.hint}>Dev OTP: {devCode}</Text> : null}
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="OTP code" />
          <Button title="Verify email wallet" onPress={() => verifyInAppEmail(email, code)} />
        </>
      )}

      <Text style={styles.section}>2. Insight balance</Text>
      <Button title="Read indexed token balances" onPress={handleInsightBalance} disabled={!address || loading} />
      <Text style={styles.output}>{balances}</Text>

      <Text style={styles.section}>3. Engine transaction</Text>
      <Button title="Create wallet + send 0.001 native tx" onPress={handleSendTx} disabled={loading} />
      <Text style={styles.output}>{txStatus}</Text>
      {loading ? <ActivityIndicator /> : null}
    </ScrollView>
  );
}

export default function App() {
  return (
    <MobileConnectProvider
      engineBaseUrl={ENGINE_URL}
      engineApiKey={API_KEY}
      insightBaseUrl={INSIGHT_URL}
      chainId={CHAIN_ID}
      walletConnectProjectId={WC_PROJECT_ID || undefined}
      walletConnectMobile={{ appLinkScheme: "apkayaexample" }}
      siwe={{ domain: "apkaya.dev", uri: "apkayaexample://auth" }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <DemoScreen />
      </SafeAreaView>
    </MobileConnectProvider>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  title: { fontSize: 20, fontWeight: "700" },
  meta: { color: "#666", marginBottom: 8 },
  section: { marginTop: 16, fontWeight: "600", fontSize: 16 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 8, borderRadius: 6 },
  output: { fontFamily: "monospace", fontSize: 12, marginTop: 4 },
  hint: { fontSize: 12, color: "#888" },
  error: { color: "#c00" },
});
