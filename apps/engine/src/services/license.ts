import { z } from "zod";
import type pino from "pino";

const ValidateResponseSchema = z.object({
  valid: z.boolean(),
  product: z.string().optional(),
  edition: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
  features: z.record(z.unknown()).optional(),
});

export type LicenseStatus =
  | {
      enabled: false;
      valid: null;
      checkedAt: null;
      edition: null;
      expiresAt: null;
      error: null;
    }
  | {
      enabled: true;
      valid: boolean;
      checkedAt: string;
      edition: string | null;
      expiresAt: string | null;
      error: string | null;
    };

function nowIso(): string {
  return new Date().toISOString();
}

function getConfig():
  | { enabled: false }
  | { enabled: true; url: string; licenseKey: string; product: string; pollMs: number } {
  const url = process.env.LICENSE_SERVER_URL?.trim();
  const licenseKey = process.env.LICENSE_KEY?.trim();

  if (!url || !licenseKey) return { enabled: false };

  const product = (process.env.LICENSE_PRODUCT ?? "apkaya-web3platform").trim();
  const pollMs = Number(process.env.LICENSE_POLL_INTERVAL_MS ?? 6 * 60 * 60 * 1000); // 6h default
  return { enabled: true, url, licenseKey, product, pollMs: Number.isFinite(pollMs) ? pollMs : 6 * 60 * 60 * 1000 };
}

export function createLicenseMonitor(log: pino.Logger): {
  getStatus: () => LicenseStatus;
  start: () => void;
  validateOnce: () => Promise<void>;
} {
  const cfg = getConfig();

  let status: LicenseStatus = cfg.enabled
    ? { enabled: true, valid: false, checkedAt: nowIso(), edition: null, expiresAt: null, error: "Not validated yet" }
    : { enabled: false, valid: null, checkedAt: null, edition: null, expiresAt: null, error: null };

  async function validateOnce(): Promise<void> {
    const currentCfg = getConfig();
    if (!currentCfg.enabled) {
      status = { enabled: false, valid: null, checkedAt: null, edition: null, expiresAt: null, error: null };
      return;
    }

    try {
      const res = await fetch(currentCfg.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: currentCfg.licenseKey,
          product: currentCfg.product,
          version: process.env.ENGINE_VERSION,
          instanceId: process.env.LICENSE_INSTANCE_ID,
        }),
      });

      const bodyText = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(bodyText);
      } catch {
        throw new Error(`License server returned non-JSON (status ${res.status}).`);
      }

      const parsed = ValidateResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error(`License server returned unexpected JSON (status ${res.status}).`);
      }

      status = {
        enabled: true,
        valid: Boolean(parsed.data.valid) && res.ok,
        checkedAt: nowIso(),
        edition: parsed.data.edition ?? null,
        expiresAt: parsed.data.expiresAt ?? null,
        error: res.ok ? null : "License validation failed",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      status = {
        enabled: true,
        valid: false,
        checkedAt: nowIso(),
        edition: null,
        expiresAt: null,
        error: msg,
      };
      log.warn({ err: msg }, "license validation error");
    }
  }

  function start(): void {
    const startCfg = getConfig();
    if (!startCfg.enabled) return;

    // Fire-and-forget initial validation.
    void validateOnce();

    setInterval(() => {
      void validateOnce();
    }, startCfg.pollMs).unref?.();
  }

  return {
    getStatus: () => status,
    start,
    validateOnce,
  };
}

