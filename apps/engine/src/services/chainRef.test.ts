import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEvmAddress,
  isSolanaAddress,
  resolveChainRef,
  chainKey,
} from "./chainRef.js";

describe("chainRef", () => {
  it("resolves EVM chain ref from numeric chainId", () => {
    const ref = resolveChainRef({ chainId: 8453 });
    assert.equal(ref.chainFamily, "evm");
    assert.equal(ref.chainId, "8453");
    assert.equal(chainKey(ref), "evm:8453");
  });

  it("resolves explicit Solana chain ref", () => {
    const ref = resolveChainRef({ chainFamily: "solana", chainId: "devnet" });
    assert.equal(chainKey(ref), "solana:devnet");
  });

  it("validates addresses per family", () => {
    assert.equal(isEvmAddress("0x1111111111111111111111111111111111111111"), true);
    assert.equal(isEvmAddress("1111111111111111111111111111111111111111"), false);
    assert.equal(isSolanaAddress("11111111111111111111111111111111"), true);
  });
});
