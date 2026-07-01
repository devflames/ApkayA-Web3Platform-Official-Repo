import type {
  BridgeEngineConfig,
  OnrampSessionRequest,
  OnrampSessionResponse,
} from "../core/types.js";
import { createOnrampSession, detectClientIp } from "../core/client.js";

export interface OnrampProvider {
  readonly id: string;
  createSession(input: Omit<OnrampSessionRequest, "clientIp"> & { clientIp?: string }): Promise<OnrampSessionResponse>;
}

export class CoinbaseOnrampProvider implements OnrampProvider {
  readonly id = "coinbase";

  constructor(private readonly engine: BridgeEngineConfig) {}

  async createSession(
    input: Omit<OnrampSessionRequest, "clientIp"> & { clientIp?: string }
  ): Promise<OnrampSessionResponse> {
    const clientIp = input.clientIp ?? (await detectClientIp());
    return createOnrampSession(this.engine, { ...input, clientIp });
  }
}
