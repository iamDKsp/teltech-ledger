import express, { Router, type Request, type Response, type NextFunction } from "express";
import { TextDecoder } from "node:util";
import {
  WebhookError, hashPayload, inboundWebhookSchema, verifyWebhookSignature,
  type InboundWebhook, type WebhookIntegration,
} from "../services/inbound-webhook-contract";

interface Dependencies {
  integrations: () => WebhookIntegration[];
  process: (config: WebhookIntegration, event: InboundWebhook, bodyHash: string) => Promise<Record<string, unknown>>;
}

// Mount BEFORE the app JSON parser: HMAC covers the exact UTF-8 bytes sent.
export function createInboundWebhookRouter(deps: Dependencies) {
  const router = Router();
  const windows = new Map<string, { until: number; count: number }>();
  const raw = express.raw({ type: "application/json", limit: "256kb", inflate: false });
  router.post("/:source", (req, res, next) => {
    if (!req.is("application/json")) { res.status(415).json({ error: "unsupported_media_type", message: "Envie application/json em UTF-8." }); return; }
    if (req.headers["content-encoding"] && req.headers["content-encoding"] !== "identity") {
      res.status(415).json({ error: "unsupported_encoding", message: "Envie JSON sem compressão." }); return;
    }
    next();
  }, raw, async (req, res) => {
    try {
      const configs = deps.integrations();
      if (!configs.length) throw new WebhookError(503, "integration_disabled", "Webhook ainda não configurado no servidor.");
      const source = req.params.source as string;
      const config = configs.find((i) => i.source === source);
      if (!config) throw new WebhookError(404, "source_not_found", "Integração não encontrada.");
      if (!Buffer.isBuffer(req.body) || !verifyWebhookSignature(config.secret, source,
        req.get("x-leadger-timestamp"), req.get("x-leadger-signature"), req.body)) {
        throw new WebhookError(401, "invalid_signature", "Assinatura inválida ou timestamp expirado.");
      }
      const now = Date.now();
      let window = windows.get(source);
      if (!window || window.until <= now) { window = { until: now + 60_000, count: 0 }; windows.set(source, window); }
      if (++window.count > 120) {
        res.setHeader("Retry-After", Math.ceil((window.until - now) / 1000));
        throw new WebhookError(429, "rate_limited", "Limite de 120 eventos/minuto por integração nesta instância.");
      }
      let body: unknown;
      try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(req.body)); }
      catch { throw new WebhookError(400, "invalid_json", "Corpo deve ser JSON válido em UTF-8."); }
      const parsed = inboundWebhookSchema.safeParse(body);
      if (!parsed.success) {
        res.status(422).json({ error: "invalid_payload", message: "Dados fora do contrato v1.",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
        return;
      }
      const result = await deps.process(config, parsed.data, hashPayload(req.body));
      req.log?.info({ source, eventId: parsed.data.eventId, eventType: parsed.data.eventType, outcome: result.outcome,
        duplicate: result.duplicate === true }, "Inbound webhook processed");
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof WebhookError) {
        res.status(error.status).json({ error: error.code, message: error.message });
        return;
      }
      // Log only classification, not the SQL parameters, secret or customer payload.
      req.log?.error({ source: req.params.source, errorCode: (error as { code?: string })?.code ?? "unknown" }, "Inbound webhook failed");
      res.setHeader("Retry-After", "10");
      res.status(503).json({ error: "temporarily_unavailable", message: "Evento não confirmado. Reenvie com o mesmo eventId e corpo." });
    }
  });
  router.use((error: { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? "payload_too_large" : "invalid_body",
      message: error.status === 413 ? "Limite do corpo: 256 KiB." : "Não foi possível ler o corpo da requisição." });
  });
  return router;
}
