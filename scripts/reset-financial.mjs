// scripts/reset-financial.mjs
// Teltech Ledger - Script para zerar todos os dados do módulo financeiro

import pg from '../lib/db/node_modules/pg/lib/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env se não estiver definido
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ ERRO: DATABASE_URL não foi definida. Configure no arquivo .env ou passe como variável de ambiente.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });

async function resetFinance() {
  console.log("=====================================================");
  console.log("⚠️  TELTECH LEDGER - RESET DO MÓDULO FINANCEIRO");
  console.log("=====================================================");
  console.log("Conectando ao banco de dados...");
  
  await client.connect();
  console.log("✅ Conexão estabelecida com sucesso.");

  try {
    console.log("\nIniciando limpeza das tabelas financeiras...");
    await client.query("BEGIN;");

    // 1. Tasks
    const resTasks = await client.query("UPDATE tasks SET client_id = NULL WHERE client_id IS NOT NULL;");
    console.log(`  ✔️ Clientes desvinculados de tarefas: ${resTasks.rowCount}`);

    // 2. WhatsApp messages de cobrança
    const resWa = await client.query("DELETE FROM whatsapp_messages WHERE transaction_id IS NOT NULL OR client_id IS NOT NULL;");
    console.log(`  ✔️ Mensagens de cobrança/clientes no WhatsApp removidas: ${resWa.rowCount}`);

    // 3. Audit logs
    const resAudit = await client.query("DELETE FROM financial_audit_logs;");
    console.log(`  ✔️ Logs de auditoria financeira removidos: ${resAudit.rowCount}`);

    // 4. Transações
    const resTx = await client.query("DELETE FROM financial_transactions;");
    console.log(`  ✔️ Transações (cobranças, receitas, despesas) removidas: ${resTx.rowCount}`);

    // 5. Módulos e Itens de vendas
    const resModules = await client.query("DELETE FROM sale_modules;");
    console.log(`  ✔️ Módulos contratados removidos: ${resModules.rowCount}`);

    const resItems = await client.query("DELETE FROM sale_items;");
    console.log(`  ✔️ Itens de vendas removidos: ${resItems.rowCount}`);

    const resSales = await client.query("DELETE FROM client_sales;");
    console.log(`  ✔️ Vendas comerciais removidas: ${resSales.rowCount}`);

    // 6. Contratos de clientes
    const resContracts = await client.query("DELETE FROM client_contracts;");
    console.log(`  ✔️ Contratos legados removidos: ${resContracts.rowCount}`);

    // 7. Clientes
    const resClients = await client.query("DELETE FROM clients;");
    console.log(`  ✔️ Clientes excluídos: ${resClients.rowCount}`);

    // 8. Orçamentos
    const resBudgets = await client.query("DELETE FROM financial_budgets;");
    console.log(`  ✔️ Orçamentos departamentais removidos: ${resBudgets.rowCount}`);

    // 9. Resetar saldo das contas
    const resAccs = await client.query("UPDATE financial_accounts SET current_balance = 0;");
    console.log(`  ✔️ Contas bancárias com saldo zerado: ${resAccs.rowCount}`);

    await client.query("COMMIT;");
    console.log("\n🎉 SUCESSO: Todos os dados do módulo financeiro foram resetados com perfeição!");
    console.log("O sistema está pronto e zerado para novos lançamentos.");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("\n❌ ERRO durante a execução do reset. Transação desfeita (ROLLBACK):", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetFinance();
