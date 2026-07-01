import { nanoid } from "nanoid";
import { Contract, Interface, type FunctionFragment, type InterfaceAbi } from "ethers";
import { execute, query, queryOne } from "../db/index.js";
import { serializeRow, serializeRows } from "../db/serialize.js";
import { getProvider } from "./chains.js";
import { enqueueTransaction, type TransactionRecord } from "./transactions.js";
import { getBackendWallet } from "./wallets.js";

export interface DeployedContractRecord {
  id: string;
  chain_id: number;
  address: string;
  name: string;
  abi_json: string;
  deployer_wallet_id: string | null;
  deployed_at: string;
  tx_id: string | null;
}

export interface RegisterContractInput {
  chainId: number;
  address: string;
  name: string;
  abi: unknown[];
  deployerWalletId?: string;
  txId?: string;
}

export interface ContractFunctionInfo {
  name: string;
  stateMutability: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
}

function parseAbi(json: string): InterfaceAbi {
  return JSON.parse(json) as InterfaceAbi;
}

function getInterface(abiJson: string): Interface {
  return new Interface(parseAbi(abiJson));
}

function serializeCallResult(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeCallResult);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeCallResult(v)])
    );
  }
  return value;
}

function coerceFunctionArgs(fn: FunctionFragment, args: unknown[]): unknown[] {
  return fn.inputs.map((input, index) => {
    const val = args[index];
    if (val === undefined || val === null) {
      throw new Error(`Missing argument "${input.name}" (${input.type}) at index ${index}.`);
    }
    if (input.type.startsWith("uint") || input.type.startsWith("int")) {
      return BigInt(val as string | number | bigint);
    }
    if (input.type === "bool") return val === true || val === "true";
    if (input.type.endsWith("[]") && typeof val === "string") {
      return JSON.parse(val);
    }
    return val;
  });
}

function findFunction(iface: Interface, functionName: string): FunctionFragment {
  const fn = iface.getFunction(functionName);
  if (!fn) {
    throw new Error(`Function "${functionName}" not found in contract ABI.`);
  }
  return fn;
}

export function listContractFunctions(abiJson: string): ContractFunctionInfo[] {
  const iface = getInterface(abiJson);
  return iface.fragments
    .filter((f): f is FunctionFragment => f.type === "function")
    .map((fn) => ({
      name: fn.name,
      stateMutability: fn.stateMutability,
      inputs: fn.inputs.map((i) => ({ name: i.name, type: i.type })),
      outputs: fn.outputs.map((o) => ({ name: o.name, type: o.type })),
    }));
}

export async function registerContract(input: RegisterContractInput): Promise<DeployedContractRecord> {
  const id = nanoid();
  const abiJson = JSON.stringify(input.abi);

  await execute(
    `INSERT INTO deployed_contracts
      (id, chain_id, address, name, abi_json, deployer_wallet_id, tx_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      input.chainId,
      input.address,
      input.name,
      abiJson,
      input.deployerWalletId ?? null,
      input.txId ?? null,
    ]
  );

  const record = await getContract(id);
  if (!record) throw new Error("Failed to register contract.");
  return record;
}

export async function getContract(id: string): Promise<DeployedContractRecord | undefined> {
  const row = await queryOne<DeployedContractRecord>(
    `SELECT * FROM deployed_contracts WHERE id = $1`,
    [id]
  );
  return row ? serializeRow(row) : undefined;
}

export async function listContracts(filters?: {
  chainId?: number;
  limit?: number;
}): Promise<DeployedContractRecord[]> {
  const params: unknown[] = [];
  let where = "";
  if (filters?.chainId) {
    where = "WHERE chain_id = $1";
    params.push(filters.chainId);
  }
  const limit = Math.min(filters?.limit ?? 100, 200);
  params.push(limit);
  const limitParam = filters?.chainId ? "$2" : "$1";

  const rows = await query<DeployedContractRecord>(
    `SELECT * FROM deployed_contracts ${where} ORDER BY deployed_at DESC LIMIT ${limitParam}`,
    params
  );
  return serializeRows(rows);
}

export async function readContractFunction(
  contractId: string,
  functionName: string,
  args: unknown[] = []
): Promise<{ result: unknown }> {
  const contract = await getContract(contractId);
  if (!contract) throw new Error("Contract not found.");

  const iface = getInterface(contract.abi_json);
  const fn = findFunction(iface, functionName);

  if (fn.stateMutability !== "view" && fn.stateMutability !== "pure") {
    throw new Error(`Function "${functionName}" is not a read-only (view/pure) function.`);
  }

  const coerced = coerceFunctionArgs(fn, args);
  const provider = getProvider(contract.chain_id);
  const runner = new Contract(contract.address, parseAbi(contract.abi_json), provider);
  const raw = await runner.getFunction(functionName).staticCall(...coerced);

  if (fn.outputs.length <= 1) {
    return { result: serializeCallResult(raw) };
  }

  const named = fn.outputs.map((output, index) => {
    const key = output.name || `_${index}`;
    const value = Array.isArray(raw) ? raw[index] : (raw as Record<string, unknown>)[key];
    return [key, serializeCallResult(value)];
  });
  return { result: Object.fromEntries(named) };
}

export async function writeContractFunction(input: {
  contractId: string;
  fromWalletId: string;
  functionName: string;
  args?: unknown[];
  valueWei?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<TransactionRecord> {
  const contract = await getContract(input.contractId);
  if (!contract) throw new Error("Contract not found.");

  if (!(await getBackendWallet(input.fromWalletId))) {
    throw new Error(`Backend wallet ${input.fromWalletId} not found.`);
  }

  const iface = getInterface(contract.abi_json);
  const fn = findFunction(iface, input.functionName);

  if (fn.stateMutability === "view" || fn.stateMutability === "pure") {
    throw new Error(`Function "${input.functionName}" is read-only. Use /contract/:id/read instead.`);
  }

  const coerced = coerceFunctionArgs(fn, input.args ?? []);
  const data = iface.encodeFunctionData(fn, coerced);

  return enqueueTransaction({
    chainId: contract.chain_id,
    fromWalletId: input.fromWalletId,
    toAddress: contract.address,
    data,
    valueWei: input.valueWei ?? "0",
    idempotencyKey: input.idempotencyKey,
    metadata: {
      contractId: contract.id,
      contractName: contract.name,
      functionName: input.functionName,
      ...input.metadata,
    },
  });
}
