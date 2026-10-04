-- ==============================================================================
-- TELTECH LEDGER - RESET COMPLETO DO MÓDULO FINANCEIRO
-- ==============================================================================
-- Este script remove todos os dados do módulo financeiro:
--   - Clientes
--   - Contratos e Vendas Comerciais (Entradas, Parcelas, Assinaturas)
--   - Cobranças, Receitas e Despesas (Livro Caixa)
--   - Histórico de Auditoria Financeira
--   - Fila de Cobrança do WhatsApp
--   - Orçamentos departamentais
--   - Zera os saldos das contas bancárias
--
-- O QUE É PRESERVADO:
--   - Usuários e Membros
--   - Workspaces
--   - Projetos, Colunas e Tarefas do Kanban (apenas o vínculo do cliente é desfeito)
--   - Categorias Financeiras padrão (para você já ter categorias ao lançar novas contas)
--   - Sessão e Conexão pareada do WhatsApp (não precisa ler QR code de novo)
--   - Reuniões, Metas e Mensagens de projetos
-- ==============================================================================

BEGIN;

-- 1. Desvincular clientes das tarefas do Kanban (mantém as tarefas e o histórico do quadro)
UPDATE tasks 
SET client_id = NULL 
WHERE client_id IS NOT NULL;

-- 2. Limpar mensagens da fila/histórico do WhatsApp ligadas a cobranças e clientes
DELETE FROM whatsapp_messages 
WHERE transaction_id IS NOT NULL 
   OR client_id IS NOT NULL;

-- 3. Limpar histórico de auditoria financeira
DELETE FROM financial_audit_logs;

-- 4. Limpar todas as transações financeiras (receitas, despesas, cobranças, retiradas, reembolsos)
DELETE FROM financial_transactions;

-- 5. Limpar módulos das vendas comerciais
DELETE FROM sale_modules;

-- 6. Limpar itens de venda (entradas pontuais e mensalidades recorrentes)
DELETE FROM sale_items;

-- 7. Limpar propostas e contratos de venda
DELETE FROM client_sales;

-- 8. Limpar contratos legados de clientes
DELETE FROM client_contracts;

-- 9. Excluir todos os clientes
DELETE FROM clients;

-- 10. Limpar orçamentos mensais departamentais
DELETE FROM financial_budgets;

-- 11. Zerar o saldo atual das contas bancárias (deixando-as limpas para novos lançamentos)
UPDATE financial_accounts 
SET current_balance = 0;

-- (Opcional) Se você quiser também apagar as contas bancárias cadastradas, descomente a linha abaixo:
-- DELETE FROM financial_accounts;

COMMIT;
