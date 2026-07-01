import assert from "node:assert/strict";
import { Interface, zeroPadValue } from "ethers";
import { describe, it } from "node:test";
import {
  decodeTransferBatchLog,
  decodeTransferLog,
  decodeTransferSingleLog,
  normalizeAddress,
} from "../services/events.js";

const erc1155Interface = new Interface([
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
]);

const addr1 = "0x1111111111111111111111111111111111111111";
const addr2 = "0x2222222222222222222222222222222222222222";
const addrA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const addrB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const addrC = "0xcccccccccccccccccccccccccccccccccccccccc";

describe("normalizeAddress", () => {
  it("extracts addresses from 32-byte topic words", () => {
    assert.equal(normalizeAddress(zeroPadValue(addr1, 32)), addr1);
  });
});

describe("decodeTransferLog", () => {
  it("decodes ERC20 Transfer", () => {
    const decoded = decodeTransferLog(
      [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        zeroPadValue(addr1, 32),
        zeroPadValue(addr2, 32),
      ],
      "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000"
    );
    assert.equal(decoded?.eventName, "Transfer");
    assert.equal(decoded?.args.from, addr1);
    assert.equal(decoded?.args.to, addr2);
    assert.equal(decoded?.args.value, "1000000000000000000");
  });

  it("decodes ERC721 Transfer", () => {
    const decoded = decodeTransferLog(
      [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        zeroPadValue(addr1, 32),
        zeroPadValue(addr2, 32),
        zeroPadValue("0x42", 32),
      ],
      "0x"
    );
    assert.equal(decoded?.args.tokenId, "66");
    assert.equal(decoded?.args.value, undefined);
  });
});

describe("decodeTransferSingleLog", () => {
  it("decodes ERC1155 TransferSingle", () => {
    const encoded = erc1155Interface.encodeEventLog("TransferSingle", [addrA, addrB, addrC, 7n, 3n]);
    const decoded = decodeTransferSingleLog(encoded.topics, encoded.data);
    assert.equal(decoded?.eventName, "TransferSingle");
    assert.equal(decoded?.args.id, "7");
    assert.equal(decoded?.args.value, "3");
  });
});

describe("decodeTransferBatchLog", () => {
  it("decodes ERC1155 TransferBatch", () => {
    const encoded = erc1155Interface.encodeEventLog("TransferBatch", [
      addrA,
      addrB,
      addrC,
      [1n, 2n],
      [5n, 10n],
    ]);
    const decoded = decodeTransferBatchLog(encoded.topics, encoded.data);
    assert.deepEqual(decoded?.args.ids, ["1", "2"]);
    assert.deepEqual(decoded?.args.values, ["5", "10"]);
  });
});
