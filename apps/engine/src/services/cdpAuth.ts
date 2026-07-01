import { generateJwt } from "@coinbase/cdp-sdk/auth";

function getCdpCredentials(): { apiKeyId: string; apiKeySecret: string } {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;

  if (!apiKeyId || !apiKeySecret) {
    throw new Error(
      "CDP_API_KEY_ID and CDP_API_KEY_SECRET must be configured. " +
        "Download a CDP Secret API Key (Key ID + Secret) from portal.cdp.coinbase.com — " +
        "not a Coinbase Exchange / Advanced Trade key."
    );
  }

  return {
    apiKeyId,
    apiKeySecret: apiKeySecret.replace(/\\n/g, "\n"),
  };
}

export async function createCdpJwt(input: {
  requestMethod: string;
  requestHost: string;
  requestPath: string;
}): Promise<string> {
  const { apiKeyId, apiKeySecret } = getCdpCredentials();

  return generateJwt({
    apiKeyId,
    apiKeySecret,
    requestMethod: input.requestMethod,
    requestHost: input.requestHost,
    requestPath: input.requestPath,
    expiresIn: 120,
  });
}

export function isCdpConfigured(): boolean {
  return Boolean(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET);
}
