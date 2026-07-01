import { createCdpJwt } from "./cdpAuth.js";
import {
  chainIdToCdpBlockchain,
  ONRAMP_POPUP_BASE,
  ONRAMP_ASSETS,
} from "./cdpBridgeConfig.js";

const ONRAMP_HOST = "api.developer.coinbase.com";
const ONRAMP_PATH = "/onramp/v1/token";

export interface OnrampSessionInput {
  address: string;
  chainId: number;
  assets?: string[];
  clientIp: string;
  presetFiatAmount?: number;
  defaultNetwork?: string;
}

export interface OnrampSessionResult {
  token: string;
  popupUrl: string;
  expiresInSeconds: number;
}

export async function createOnrampSession(input: OnrampSessionInput): Promise<OnrampSessionResult> {
  const blockchain = chainIdToCdpBlockchain(input.chainId);
  if (!blockchain) {
    throw new Error(`Chain ${input.chainId} is not mapped for CDP onramp.`);
  }

  const body = {
    addresses: [{ address: input.address, blockchains: [blockchain] }],
    assets: input.assets ?? [...ONRAMP_ASSETS],
    clientIp: input.clientIp,
  };

  const bodyStr = JSON.stringify(body);
  const jwt = await createCdpJwt({
    requestMethod: "POST",
    requestHost: ONRAMP_HOST,
    requestPath: ONRAMP_PATH,
  });

  const res = await fetch(`https://${ONRAMP_HOST}${ONRAMP_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: bodyStr,
  });

  const data = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !data.token) {
    throw new Error(data.message ?? `CDP onramp session failed (${res.status})`);
  }

  const params = new URLSearchParams({ sessionToken: data.token });
  if (input.defaultNetwork) params.set("defaultNetwork", input.defaultNetwork);
  if (input.presetFiatAmount) params.set("presetFiatAmount", String(input.presetFiatAmount));

  return {
    token: data.token,
    popupUrl: `${ONRAMP_POPUP_BASE}?${params.toString()}`,
    expiresInSeconds: 300,
  };
}
