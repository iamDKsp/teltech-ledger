import app from "./app";
import { logger } from "./lib/logger";
import { seedUsers } from "./seed";

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

  // Seed preset users on startup
  try {
    await seedUsers();
  } catch (e) {
    logger.error({ err: e }, "Seed failed");
  }
});
