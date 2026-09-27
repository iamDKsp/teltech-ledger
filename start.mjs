// start.mjs - Teltech Ledger API Startup Script
// Using Node.js instead of a shell script to avoid Windows CRLF issues.
// Node.js handles CRLF line endings natively regardless of OS.

import net from 'node:net';
import { execSync } from 'node:child_process';

const DB_HOST = 'db';
const DB_PORT = 5432;
const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;

async function waitForPostgres() {
  console.log('=== [Teltech API] Aguardando banco de dados PostgreSQL ===');
  for (let i = 0; i < MAX_RETRIES; i++) {
    const connected = await new Promise((resolve) => {
      const socket = net.connect({ host: DB_HOST, port: DB_PORT });
      socket.setTimeout(1000);
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
    });

    if (connected) {
      console.log('PostgreSQL pronto!');
      return;
    }

    console.log(`Aguardando PostgreSQL (${i + 1}/${MAX_RETRIES})...`);
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
  }
  console.error('Tempo limite esgotado esperando o PostgreSQL.');
  process.exit(1);
}

await waitForPostgres();

if (process.env.SKIP_DB_PUSH !== 'true') {
  console.log('=== [Teltech API] Sincronizando schema do banco (Drizzle) ===');
  const pushCmd = process.env.FORCE_DB_PUSH === 'true'
    ? 'pnpm --filter @workspace/db run push-force'
    : 'pnpm --filter @workspace/db run push';
  try {
    execSync(pushCmd, { stdio: 'inherit' });
  } catch (err) {
    console.error('Erro na sincronização de schema:', err.message);
    if (process.env.NODE_ENV === 'production') {
      console.error('Falha crítica na sincronização de schema em produção. Abortando inicialização.');
      process.exit(1);
    }
  }
} else {
  console.log('=== [Teltech API] Sincronização de schema ignorada (SKIP_DB_PUSH=true) ===');
}
console.log('=== [Teltech API] Iniciando servidor Teltech Ledger ===');
await import('./artifacts/api-server/dist/index.mjs');
