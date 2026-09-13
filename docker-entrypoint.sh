#!/bin/sh
set -e

echo "=== [Teltech API] Aguardando banco de dados PostgreSQL ficar pronto ==="

pnpm --filter @workspace/db exec node -e "
const { Pool } = require('pg');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set!');
  process.exit(1);
}
const pool = new Pool({ connectionString: url });
async function check() {
  for (let i = 0; i < 30; i++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('PostgreSQL conectado com sucesso!');
      process.exit(0);
    } catch (err) {
      console.log('Aguardando PostgreSQL (' + (i + 1) + '/30)...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('Tempo limite esgotado esperando o PostgreSQL.');
  process.exit(1);
}
check();
"

echo "=== [Teltech API] Sincronizando schema do banco (Drizzle) ==="
pnpm --filter @workspace/db run push-force

echo "=== [Teltech API] Iniciando servidor Teltech Ledger ==="
exec node --enable-source-maps ./artifacts/api-server/dist/index.mjs
