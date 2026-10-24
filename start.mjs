// start.mjs - Teltech Ledger API Startup Script
// Using Node.js instead of a shell script to avoid Windows CRLF issues.
// Node.js handles CRLF line endings natively regardless of OS.

import net from 'node:net';
import { spawn } from 'node:child_process';

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

function runSchemaSyncInBackground() {
  if (process.env.SKIP_DB_PUSH === 'true') {
    console.log('=== [Teltech API] Sincronização de schema ignorada (SKIP_DB_PUSH=true) ===');
    return;
  }

  console.log('=== [Teltech API] Sincronizando schema do banco em background (Drizzle) ===');
  const scriptName = process.env.FORCE_DB_PUSH === 'false' ? 'push' : 'push-force';
  const child = spawn('pnpm', ['--filter', '@workspace/db', 'run', scriptName], {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: true,
  });

  const killTimer = setTimeout(() => {
    console.warn('=== [Teltech API] Timeout na sincronização do Drizzle (45s). Continuando execução normal. ===');
    child.kill('SIGTERM');
  }, 45000);

  child.on('exit', (code) => {
    clearTimeout(killTimer);
    if (code === 0) {
      console.log('=== [Teltech API] Schema sincronizado com sucesso ===');
    } else {
      console.warn(`=== [Teltech API] Sincronização Drizzle finalizou com código ${code} (auto-migração SQL ativa) ===`);
    }
  });
}

await waitForPostgres();

console.log('=== [Teltech API] Iniciando servidor Teltech Ledger ===');
await import('./artifacts/api-server/dist/index.mjs');

// Run Drizzle schema sync asynchronously so port 5000 and /api/healthz respond immediately
runSchemaSyncInBackground();

