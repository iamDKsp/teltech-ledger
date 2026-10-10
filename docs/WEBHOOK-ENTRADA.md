# Webhook de entrada do Leadger

O receptor está em `POST /api/webhooks/inbound/:source`. Ele sincroniza clientes,
bases/contratos de mensalidade e faturas, com HMAC, identificação externa,
versões, transação de banco, ajustes de saldo e auditoria. O contrato para o
desenvolvedor do emissor está em [INTEGRACAO-WEBHOOK-ENTRADA.txt](INTEGRACAO-WEBHOOK-ENTRADA.txt).

Domínio de produção informado: `https://leadger.teltech.com.br`.
URL definida para a integração `sistema-amigo`:

```text
POST https://leadger.teltech.com.br/api/webhooks/inbound/sistema-amigo
```

`https://leadger.teltech.com.br/configuracoes` é a tela de configurações, não a
URL de recebimento. A URL acima depende da versão nova publicada e do source
`sistema-amigo` ativado no servidor; definir o endereço não ativa o webhook.

## Ativar no servidor

1. Use o domínio público `https://leadger.teltech.com.br`. O Nginx existente já
   encaminha `/api/` para a API; mantenha o HTTPS no proxy público.
2. Selecione o workspace, projeto/produto e a conta bancária de recebimento.
   Os UUIDs podem ser consultados nas respostas autenticadas de `/api/auth/me`,
   `/api/projects` e `/api/finance/accounts`, ou no banco. A tela Configurações >
   Integrações mostra o UUID do workspace quando não há integrações configuradas.
3. Gere um segredo aleatório próprio por sistema:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. Configure `INBOUND_WEBHOOK_INTEGRATIONS` no serviço `api` do Docker/Portainer.
   É um array JSON em uma única linha, sem segredos no Git:

   ```json
   [{"source":"sistema-amigo","name":"Sistema do amigo","secret":"SEU_SEGREDO_ALEATORIO","workspaceId":"UUID_WORKSPACE","projectId":"UUID_PROJETO","accountId":"UUID_CONTA_RECEBIMENTO"}]
   ```

   `source=sistema-amigo` corresponde à URL definida acima. Secret e UUIDs são
   placeholders e precisam ser substituídos. `source` aceita minúsculas, dígitos, `_`
   e `-`, até 60 caracteres; começa com letra/dígito. `secret` tem pelo menos
   32 caracteres. UUIDs devem ser reais, do mesmo workspace. `accountId` pode
   ser null: nesse caso baixas entram nos relatórios, sem crédito em saldo
   bancário até que se vincule uma conta à fatura. A configuração não é enviada
   para o navegador. Vazio deixa o receptor desativado (503).

5. Faça backup e implante as imagens atualizadas. A migração aditiva é
   `lib/db/migrations/2026-10-10_inbound_webhooks.sql`. O entrypoint Docker
   existente também sincroniza o schema pelo Drizzle. Fora de Docker, aplique
   essa migração no PostgreSQL antes de iniciar a API nova.
6. Confira Configurações > Integrações, copie a URL e entregue URL, source,
   segredo (por canal privado) e o TXT ao desenvolvedor do emissor.

O código preexistente de `seed.ts` contém um reset financeiro one-off, atualmente
com ID `2026-10-05_reset_financial_module_v4`. Antes do deploy, confira o ID vigente
na função `runOneTimeFinancialReset` e confirme que ele já está
registrado em `system_migrations` no seu banco: se estiver pendente, a inicialização
existente pode limpar o financeiro. Este trabalho não executa seed/reset nem
acessa o banco da aplicação.

## Clientes e contratos já cadastrados

Antes de ativar uma carga inicial, concilie a lista atual dos dois sistemas.
CPF/CNPJ normalizado e e-mail permitem reutilizar um cliente de forma automática
quando há um único cadastro consistente. Nome/telefone não autorizam associação
automática; uma correspondência nesses campos bloqueia criação por segurança.

Para identificação explícita, use Configurações > Integrações > Vincular cliente
já cadastrado: selecione o cliente interno e informe o ID externo. Se já houver
mensalidade, selecione também o contrato e informe o ID da base. O vínculo muda
a origem de geração dessa mensalidade para externa. O emissor passa a mandar
todas as novas faturas; o Leadger conserva as cobranças históricas.

Administradores (`owner/admin/ceo/cto`) também podem fazer o vínculo autenticado:

```http
POST /api/integrations/webhooks/sistema-amigo/link
Authorization: Bearer TOKEN_DO_ADMIN
X-Workspace-Id: UUID_WORKSPACE
Content-Type: application/json

{"clientExternalId":"cli-123","clientId":"UUID_CLIENTE","baseExternalId":"base-456","saleItemId":"UUID_ITEM_MENSALIDADE"}
```

Para vincular apenas o cliente, omita `baseExternalId` e `saleItemId` juntos.
Não associe IDs externos pertencentes a pessoas ou contratos diferentes.
O mesmo ID externo não pode ser redirecionado para outro registro por esse endpoint.

Faturas de um contrato vinculado são associadas pela competência quando valor,
vencimento e status correspondem. Duplicidade ou divergência inicial retorna 409
e exige conciliação; pagamentos existentes não são creditados novamente.
Contratos legados em `client_contracts` são detectados e bloqueiam criação
automática de um segundo contrato, mas sua migração para vendas não é automática.
Reconcile/migre esses casos antes de integrar, mantendo suas cobranças históricas.

## Comportamento e operação

- `base.upsert`: cadastra/reutiliza cliente, cria/atualiza venda com mensalidade
  e grava faturas no mesmo commit. Uma base nova não vinculada exige fatura inicial.
- `client.upsert`: altera apenas cadastro, usando IDs/versões externos.
- `invoice.upsert`: grava/atualiza cobrança e processa pagamento/correção/estorno.
- A fonte externa envia competências futuras; o agendador do Leadger gera apenas
  as mensalidades de origem `ledger`. Contratos locais continuam funcionando.
- O valor do contrato muda imediatamente. Reajuste de valor positivo recalcula
  abertas com vencimento a partir de `effectiveDate`; pagas exigem uma alteração
  explícita de fatura. Datas e cancelamentos de faturas também exigem esse evento.
- Clientes importados não ganham consentimento WhatsApp automaticamente. Os
  recibos respeitam configuração e consentimento já existentes. Telefone alterado
  revoga o consentimento anterior.
- Reenvios exigem o mesmo corpo e eventId com timestamp/assinatura novos. Version
  antiga é ignorada; conflito de mesmo eventId/versão devolve 409.
- `/api/integrations/webhooks/revision` é autenticado e expõe só o contador de
  eventos confirmados do workspace. O navegador verifica a cada 10 segundos e
  atualiza Financeiro e clientes da barra lateral quando o contador muda.
- `/api/integrations/webhooks` é administrativo e mostra configuração sem segredo
  e o último evento confirmado. Falhas também têm códigos HTTP e logs sem payload
  de cliente/segredo; o emissor deve manter as pendências na sua fila.

O receptor serializa os eventos por workspace no PostgreSQL, entre todas as
réplicas da API, para impedir duplicações durante o primeiro vínculo. Limite
atual: 120 eventos por minuto por source/instância, 256 KiB por corpo, 60 faturas
por base.upsert. Uma carga inicial grande deve ser paginada. IDs e histórico de
idempotência não devem ser apagados enquanto o emissor puder reenviar eventos.

## Foto do cliente: cópia armazenada no Leadger

**Implementado nesta versão do código; requer deploy e migração para ativar.**
O campo opcional `photo: { sourceUrl, version }` é aceito no cliente de
`client.upsert` e de `base.upsert`, mantendo `schemaVersion: 1`. Receptores
anteriores à implementação não aceitam o campo. `photo` omitido preserva a
foto; `photo: null` remove explicitamente, com versão maior do cliente.

O backend baixa uma imagem JPEG/PNG/WebP de até 5 MiB e 16 milhões de pixels,
valida o conteúdo, remove metadados e salva uma cópia WebP de até 1024x1024.
Animações e outros formatos são rejeitados. O download tem limite de 8 segundos
mais até 2 segundos para DNS. Não segue redirecionamentos, bloqueia endereços
privados e fixa no socket TLS um IP público previamente verificado.

Configure na integração os hosts HTTPS exatos de origem das fotos:

```json
{"photoAllowedHosts":["cdn.sistema-amigo.com.br"]}
```

Adicione esse campo ao objeto já existente em `INBOUND_WEBHOOK_INTEGRATIONS`.
O domínio é exemplo e precisa ser substituído pelo host real informado pelo
outro desenvolvedor. Não inclua protocolo, caminho ou wildcard. Sem hosts
configurados, eventos que tentam gravar uma foto recebem 422
`photo_host_not_allowed`; eventos sem foto continuam funcionando.

A migração aditiva é `lib/db/migrations/2026-10-10_client_photos.sql`.
As imagens ficam em `public/uploads/client-photos` e usam o volume
`teltech_uploads` já previsto no Docker/Portainer. Inclua esse volume nos backups.
A URL no cliente é local (`/uploads/client-photos/...`); o cadastro, o modal e
a barra lateral exibem somente a cópia do Leadger, sem consultar a origem.

`photo.version` é crescente; também incremente `client.version` nas mudanças.
Mesma versão de foto evita novo download; versão anterior é ignorada. A remoção
mantém a última versão de foto para impedir restauração por evento antigo.
A imagem só pode ser gerenciada pela integração que a gravou inicialmente.

HTTP 200 com `photo.status: stored` confirma a cópia antes do commit do evento.
Também há estados `removed`, `unchanged` e `stale`. Falhas preservam a imagem
anterior e não confirmam o evento. Prefira enviar a foto em `client.upsert`
separado, após a base/faturas, para que problemas de imagem não atrasem o financeiro.

Após commit, arquivos antigos substituídos/removidos são excluídos. Uma falha de
banco com resultado incerto pode deixar arquivo não referenciado: a implementação
o conserva para não apagar uma cópia cujo commit pode ter ocorrido. Esses arquivos
podem ser reconciliados com o banco na manutenção do armazenamento.

O envio por link assinado funciona sem login interativo; renove links expirados
com novo evento e nova versão de cliente. Não há upload direto/Base64 nesse
contrato. Limites, erros e exemplos completos estão na seção 11 do TXT.



## Verificação

```sh
pnpm run typecheck:libs
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/teltech-ledger typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/teltech-ledger build
```

O teste financeiro exige PostgreSQL exclusivo chamado `webhook_test` ou
`*_webhook_test`, schema aplicado e `INBOUND_WEBHOOK_TEST_DATABASE_URL` definido.
Nunca use o banco da aplicação. No Windows, o script abaixo cria seu próprio
cluster em `scratch`, aplica schema, executa testes e encerra o servidor:

```powershell
./scripts/test-inbound-webhook.ps1
# Outra versão/pasta do PostgreSQL:
./scripts/test-inbound-webhook.ps1 -PostgresBin 'C:\Program Files\PostgreSQL\18\bin' -TestPort 55439
```

Os dados/logs temporários ficam preservados em scratch para diagnóstico. Os
testes cobrem rollback, evento duplicado concorrente, versões, saldo/estorno,
identificação de cliente manual, vínculo administrativo e reutilização de
contrato/fatura paga sem crédito duplicado.
