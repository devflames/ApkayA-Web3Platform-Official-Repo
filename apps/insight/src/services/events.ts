import { Interface } from "ethers";

export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const TRANSFER_SINGLE_TOPIC =
  "0xc3d58168c5ae7397731d063d5fbbcf2d809ba527690a8259bbea2520c4979";
export const TRANSFER_BATCH_TOPIC =
  "0x4a39dc06d4c0dbc64b70af90fd698a233518a5c6076469a844434f0837f238";

export const INDEXED_EVENT_TOPICS = [TRANSFER_TOPIC, TRANSFER_SINGLE_TOPIC, TRANSFER_BATCH_TOPIC];

export function normalizeAddress(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, "").padStart(64, "0").slice(-40);
  return `0x${hex}`;
}

const erc1155Interface = new Interface([
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
]);

export interface DecodedEvent {
  eventName: string;
  args: Record<string, unknown>;
}

function topicToAddress(topic: string): string {
  return normalizeAddress(topic);
}

export function decodeTransferLog(topics: readonly string[], data: string): DecodedEvent | null {
  const topic0 = topics[0]?.toLowerCase();
  if (topic0 !== TRANSFER_TOPIC) return null;

  const from = topicToAddress(topics[1]!);
  const to = topicToAddress(topics[2]!);

  if (topics.length === 4) {
    const tokenId = BigInt(topics[3]!).toString();
    return { eventName: "Transfer", args: { from, to, tokenId } };
  }

  if (topics.length === 3) {
    const value =
      data && data !== "0x" ? BigInt(data).toString() : "0";
    return { eventName: "Transfer", args: { from, to, value } };
  }

  return null;
}

export function decodeTransferSingleLog(topics: readonly string[], data: string): DecodedEvent | null {
  try {
    const event = erc1155Interface.getEvent("TransferSingle");
    if (!event || topics[0]?.toLowerCase() !== event.topicHash.toLowerCase()) return null;

    const parsed = erc1155Interface.decodeEventLog(event, data, topics as string[]);
    return {
      eventName: "TransferSingle",
      args: {
        operator: normalizeAddress(String(parsed.operator)),
        from: normalizeAddress(String(parsed.from)),
        to: normalizeAddress(String(parsed.to)),
        id: parsed.id.toString(),
        value: parsed.value.toString(),
      },
    };
  } catch {
    return null;
  }
}

export function decodeTransferBatchLog(topics: readonly string[], data: string): DecodedEvent | null {
  try {
    const event = erc1155Interface.getEvent("TransferBatch");
    if (!event || topics[0]?.toLowerCase() !== event.topicHash.toLowerCase()) return null;

    const parsed = erc1155Interface.decodeEventLog(event, data, topics as string[]);
    const idList = (parsed[3] ?? parsed.ids) as readonly bigint[];
    const valueList = (parsed[4] ?? parsed.values) as readonly bigint[];
    const ids = [...idList].map((id) => id.toString());
    const values = [...valueList].map((value) => value.toString());
    return {
      eventName: "TransferBatch",
      args: {
        operator: normalizeAddress(String(parsed.operator)),
        from: normalizeAddress(String(parsed.from)),
        to: normalizeAddress(String(parsed.to)),
        ids,
        values,
      },
    };
  } catch {
    return null;
  }
}

export function decodeIndexedLog(topics: readonly string[], data: string): DecodedEvent | null {
  const topic0 = topics[0]?.toLowerCase();
  if (topic0 === TRANSFER_TOPIC) return decodeTransferLog(topics, data);
  if (topic0 === TRANSFER_SINGLE_TOPIC) return decodeTransferSingleLog(topics, data);
  if (topic0 === TRANSFER_BATCH_TOPIC) return decodeTransferBatchLog(topics, data);
  return null;
}
