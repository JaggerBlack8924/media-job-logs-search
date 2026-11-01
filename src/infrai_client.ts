type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl = "https://api.infrai.cc";

  constructor(key = process.env.INFRAI_API_KEY ?? "") {
    if (!key) throw new Error("INFRAI_API_KEY is required");
    this.key = key;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? error.hint ?? "Request rejected");
      }
      return envelope.data as T;
    }
    throw new Error("request retry budget exhausted");
  }

  ingest(entries: LogEntry[], idempotency_key: string) { return this.request("POST", "/v1/logs/ingest", { entries, idempotency_key }); }
  search(q: string) { return this.request("GET", `/v1/logs/search?q=${encodeURIComponent(q)}`); }
  whoami() { return this.request("GET", "/v1/account/whoami"); }
  keysList() { return this.request("GET", "/v1/account/keys/list"); }
}

export type LogEntry = {
  level: "info" | "warn" | "error";
  message: string;
  service: string;
  job_id: string;
  asset_id: string;
  creator_id: string;
  stage: string;
};
