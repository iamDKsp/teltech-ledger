import app from "./app";
import { logger } from "./lib/logger";
import { seedUsers } from "./seed";
import { startWhatsAppAutomation, stopWhatsAppAutomation } from "./services/whatsapp-automation";
import { startSalesBillingScheduler, stopSalesBillingScheduler } from "./services/sales-billing";
import { ensurePushNotificationSchema } from "./services/push-notification";

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Ensure Push Notification & Movement Alert schema exists
  try {
    await ensurePushNotificationSchema();
  } catch (e) {
    logger.error({ err: e }, "Push notification schema check failed");
  }

  // Seed preset users on startup
  try {
    await seedUsers();
  } catch (e) {
    logger.error({ err: e }, "Seed failed");
  }
  try {
    await startWhatsAppAutomation();
  } catch (e) {
    logger.error({ err: e }, "WhatsApp automation startup failed");
  }
  try {
    startSalesBillingScheduler();
  } catch (e) {
    logger.error({ err: e }, "Sales billing scheduler startup failed");
  }
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    stopSalesBillingScheduler();
    void stopWhatsAppAutomation().finally(() => process.exit(0));
  });
}
