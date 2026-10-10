import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import { createInboundWebhookRouter } from "./routes/inbound-webhooks";
import { readWebhookIntegrations } from "./services/inbound-webhook-contract";
import { processInboundWebhook } from "./services/inbound-webhook";

const app: Express = express();

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use("/api/webhooks/inbound", createInboundWebhookRouter({ integrations: readWebhookIntegrations, process: processInboundWebhook }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use("/api", router);

export default app;
