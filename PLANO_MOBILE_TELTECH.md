# Plano de desenvolvimento — mesmo site Teltech Ledger, responsivo para iPhone

**Escopo confirmado:** evoluir **o site existente** em `artifacts/teltech-ledger` para funcionar muito bem em celular e ser instalável pela Tela de Início do iPhone. Manter o produto de computador como está visual e funcionalmente. **Não criar outro aplicativo, outro projeto ou uma pasta separada para a versão mobile.** O diretório `artifacts/teltech-mobile` (Expo), já existente no repositório, fica fora deste trabalho.

## Resultado esperado

- Mesma URL, mesma aplicação React/Vite, mesma API, mesmas contas, projetos e dados no computador e no iPhone.
- Layout adaptativo: o desktop conserva sua composição atual; em tela pequena, navegação, conteúdo, modais, tabelas e ações passam a ter apresentação e interação adequadas ao toque.
- Instalação pela Tela de Início como **web app/PWA**, com ícone e abertura em modo independente. Isso dá experiência semelhante à de um app no iPhone, embora não seja um aplicativo distribuído pela App Store.
- Paridade funcional com as áreas que já funcionam no desktop. A aba Cronologia, que hoje é `ComingSoon`, não deve aparecer como concluída no mobile.

## 1. O que já existe e deve ser aproveitado

| Parte | Evidência no código | Como evoluir |
| --- | --- | --- |
| App web | `artifacts/teltech-ledger/src/App.tsx` e `src/TeltechLedger.tsx` | continuar no mesmo produto; não duplicar regras ou criar app paralelo |
| Detecção de largura | `src/hooks/use-mobile.tsx`, usado em `TeltechLedger.tsx` | estabilizar detecção inicial e cobrir telefone em paisagem |
| Navegação mobile | `MobileBottomNav` e `MobileDrawer` já presentes em `TeltechLedger.tsx` | completar estados, toque, acessibilidade, rotas e área segura; evitar reconstruir do zero |
| PWA | `index.html` e `public/manifest.webmanifest`; `src/main.tsx` registra `sw.js` nas alterações locais atuais | validar instalação, ícones, atualização e cache; preservar alterações já em andamento |
| UI desktop | páginas e componentes em `src/pages/` e `src/components/` | acrescentar variantes responsivas no mesmo projeto, protegendo os estilos desktop |
| Dados | `src/lib/api.ts`, API Express e PostgreSQL | mesmas chamadas e dados nas duas larguras; melhorar contratos/erros onde necessário |

**Estado do repositório:** na auditoria havia alterações não commitadas em `TeltechLedger.tsx`, `ProjectModal.tsx`, API de projetos, manifest, ícones e service worker. A IA desenvolvedora deve examinar e preservar esse trabalho antes de editar esses arquivos.

## 2. Diagnóstico do site atual

### Arquitetura

- Monorepo pnpm/TypeScript; frontend React/Vite em `artifacts/teltech-ledger`, backend Express em `artifacts/api-server`, banco PostgreSQL/Drizzle em `lib/db`.
- `TeltechLedger.tsx` concentra shell, sidebar, cabeçalho, rotas por `wouter` e quadro. `FinanceiroPage.tsx` concentra grande parte da interface financeira. O uso extenso de estilos inline limita a adaptação por media queries isoladas.
- Áreas atuais: login, Início, Painel, Minhas Tarefas, Projetos (Visão Geral, Lista, Quadros, Calendário, Canais, Arquivos), Membros, Financeiro, Metas, Configurações e reuniões.

### Lacunas para o iPhone

| Achado | Impacto | Trabalho necessário |
| --- | --- | --- |
| Shell ainda usa `100vw/100vh` e `overflow:hidden` em `TeltechLedger.tsx` | barras do iOS/teclado podem ocultar conteúdo | altura dinâmica, rolagem correta e `safe-area-inset` |
| Quadro usa `mousedown/mousemove/mouseup` | tarefa não pode depender de mouse para abrir/mover | toque para abrir e ação visível “Mover para…” |
| `TaskModal.tsx:442` fixa largura de 900 px; outros diálogos também têm largura fixa | diálogo pode ficar cortado | no celular, ocupar tela/sheet rolável; desktop conserva medidas atuais |
| Painel, Metas, Membros, Calendário e Financeiro usam grades, painéis ou tabelas pensadas para desktop | rolagem horizontal e controles pequenos | cards/listas e detalhes progressivos no celular |
| `FinanceiroPage.tsx:592-624` carrega 11 endpoints juntos | abertura custosa em rede móvel | carregar dados por área/aba e paginar listas |
| `index.html:5` usa `maximum-scale=1` | restringe zoom/acessibilidade | permitir zoom e validar campos/teclado |
| Service worker local usa network-first genérico e não pré-cacheia uma tela offline | instalação não garante uso offline | política explícita para shell estático, atualização e estados sem conexão |

### Riscos de base que afetam os dois tamanhos de tela

1. **Autorização:** várias rotas validam JWT, mas não confirmam workspace/papel do recurso solicitado. Projetos (`api-server/src/routes/projects.ts`), tarefas (`routes/tasks.ts`), reuniões (`routes/meetings.ts`), membros (`routes/members.ts`) e aprovação financeira (`routes/finance.ts`) exigem revisão abrangente. Uma alteração local já protege um `PUT` de projeto, mas não cobre os demais endpoints.
2. **Credenciais:** `pages/login.tsx:65-81,103-107` grava a senha do “lembre-se de mim” em texto puro no `localStorage`; `FinanceiroPage.tsx:655-659` coloca JWT na URL de exportação. O endpoint de exportação exige cabeçalho Bearer (`finance.ts:1159`), então esse fluxo pode falhar. Corrigir sem mudar a aparência do login desktop.
3. **Uploads e segredos:** `routes/upload.ts` aceita arquivos sem validação adequada; `app.ts` e `nginx.conf` servem uploads publicamente; há segredos padrão em `lib/auth.ts`/Compose. Anexos financeiros e dados corporativos precisam de autorização.
4. **Operação:** `docker-entrypoint.sh` usa `drizzle-kit push --force` ao iniciar. Migrar com segurança antes de ampliar o uso, com backup e restauração testados.
5. **Qualidade:** typechecks diretos do site e da API passaram em 27/09/2026. O pipeline atual prioriza build Docker; faltam testes automatizados dos fluxos de autorização e da interface em telefone/desktop.

## 3. Regras de implementação

1. **Uma aplicação, layouts adaptativos:** alterar os componentes existentes ou extrair componentes compartilhados dentro de `artifacts/teltech-ledger/src/`. Não criar pacote, aplicativo ou árvore de telas paralela para mobile. Toda ação usa o mesmo estado, URL e API.
2. **Desktop protegido:** registrar capturas e fluxos de referência antes de editar. Usar estilos responsivos delimitados por breakpoint e evitar alterações globais desnecessárias. A interface do PC deve manter sidebar, header, densidade, modais e quadro atuais.
3. **Mobile pensado para toque:** a navegação inferior/drawer existentes são a base. Não depender de hover, mouse, botão minúsculo ou arrastar para ação essencial. Toda ação precisa de rótulo, foco e alvo confortável.
4. **Identidade Teltech:** aplicar `.agents/skills/teltech-brand-guidelines/SKILL.md` às adaptações, usando dark mode, tokens e cores oficiais. `src/index.css` ainda contém tokens `red` de placeholder; corrigir de modo controlado e verificar desktop.
5. **Sem números ou ações simuladas:** no mobile, toda tela deve continuar refletindo a API real. Estados vazio/erro/offline devem ser explícitos; nenhuma operação pode aparentar sucesso após falha de rede.
6. **Privacidade do PWA:** cachear apenas shell/arquivos estáticos por padrão. Não cachear indiscriminadamente API autenticada ou dados financeiros; limpar estado sensível ao sair. Escritas offline só se existir fila e resolução de conflito demonstradas.

## 4. Plano de execução para a IA desenvolvedora

### Fase 0 — mapa, linha de base e critérios

- Ler alterações locais e preservar trabalho não commitado. Registrar captura e comportamento do desktop em 1280, 1440 e 1920 px: login, Início, Painel, projetos, tarefa, Financeiro, Membros, Metas e Configurações.
- Criar matriz por tela: rota, componentes, dados, ações de leitura/escrita, papel permitido, estado no iPhone e teste de aceite.
- Definir breakpoints por espaço disponível; testar iPhone retrato e paisagem, tamanho pequeno/grande e teclado aberto. Não detectar modelo por user agent.
- Desenhar rapidamente a navegação mobile sobre **a navegação já existente**: Início, Tarefas, Projetos, Financeiro e Mais; listar o destino de todas as áreas em “Mais”.

**Aceite:** matriz e capturas de referência prontas; plano de telas sem funcionalidades omitidas; nenhum trabalho local apagado.

### Fase 1 — corrigir segurança compartilhada antes de liberar o mobile

- Criar checagem central de membership/workspace e matriz de permissões por papel; aplicar a todas as rotas de projetos, tarefas, membros, reuniões, metas, finanças e arquivos, tanto leitura quanto escrita.
- Remover senha em texto puro do `localStorage` e limpar chave legada; definir sessão persistente segura para web/PWA. Corrigir exportação para `fetch` autenticado com download/compartilhamento por `Blob`, sem token na URL.
- Exigir segredos fortes em produção, restringir endpoint público de usuários/registro conforme política da empresa, validar upload e proteger download de anexos privados.
- Substituir `push-force` por migrações versionadas com backup/rollback.
- Criar testes com dois workspaces e papéis distintos: um usuário não lê/edita recursos do outro, e membro comum não administra contas nem aprova despesas sem direito.

**Aceite:** isolamento e papéis comprovados no servidor; login/exportação legítimos continuam funcionando no desktop; nenhuma regressão visual.

### Fase 2 — shell, navegação e instalação no mesmo site

- Melhorar `useIsMobile` para evitar flash de layout inicial e manter comportamento correto em orientação paisagem. Não montar dois conjuntos de telas ou disparar buscas duplicadas.
- Finalizar bottom nav e drawer existentes: seleção correta pela URL, voltar/avançar, recarregamento, links diretos, projeto ativo e indicação da área atual.
- Ajustar container para `100dvh`/fallback adequado, `env(safe-area-inset-*)`, rolagem por tela, barra inferior fixa e teclado sem esconder campos/botões. Evitar rolagem horizontal da página inteira.
- Rever PWA existente: manifest, ícones, `display: standalone`, instalação, escopo, atualização do service worker, shell offline e HTTPS. Criar instrução curta de “Adicionar à Tela de Início” quando apropriado.
- Manter `lang="pt-BR"`, ajustar viewport para permitir zoom e validar campos com fonte que não provoque zoom inesperado no iPhone.

**Aceite:** mesma URL abre desktop no PC e layout mobile no iPhone; instalado pela Tela de Início, abre sem barra do navegador; voltar/recarregar conservam contexto; conteúdo não fica atrás da barra inferior ou teclado.

### Fase 3 — produtividade no celular

| Área | Adaptação no mesmo projeto | Aceite |
| --- | --- | --- |
| Login/perfil | cartão, campos e perfil ajustados a tela/teclado; foco e rolagem corretos | entrar, persistir sessão, editar perfil e sair |
| Início/Painel | cards em uma coluna, indicadores legíveis, acesso a detalhes | valores iguais aos do PC |
| Minhas Tarefas | filtros roláveis, lista confortável, estados vazios e ações visíveis | filtrar/abrir/concluir sem hover |
| Projetos | lista/busca/favoritos, seletor em drawer/sheet, visão geral | navegar/criar/editar e voltar corretamente |
| Quadros/Lista | colunas como etapas navegáveis ou lista por etapa; “Mover para…” por toque | mudança persiste na API e no PC |
| Detalhe da tarefa | modal vira tela/sheet no celular: descrição, subtarefas, responsáveis, tags, prazo, comentários, anexos, timer | todas as ações atuais funcionam com toque |
| Calendário/Canais/Arquivos | calendário em agenda/lista quando a grade ficar estreita; chat e arquivos adaptados | leitura, envio e upload/download no iPhone |

No quadro, manter interação desktop de arrastar intacta e adicionar interação de toque no celular. Reduzir o padrão de uma requisição de timer por tarefa em `TeltechLedger.tsx` ao carregar board, sem mudar resultados.

**Aceite ponta a ponta:** entrar → escolher projeto → criar tarefa → atribuir → comentar/anexar → mover etapa → concluir → ver resultado no desktop.

### Fase 4 — Financeiro, Metas, Membros e Configurações

- Adaptar **todas** as subáreas de `FinanceiroPage.tsx` com listas/cards, detalhe progressivo, filtros e formulários adequados ao toque: cockpit, lançamentos, clientes, contas, DRE, rentabilidade, orçamentos, aprovações, sócios e exportação. Não comprimir tabelas desktop até ficarem ilegíveis.
- Carregar dados por aba/necessidade, paginar lançamentos e preservar filtros ao voltar. Confirmar operações financeiras com valor, entidade e consequência.
- Adaptar Metas, Membros, reuniões e Configurações. A interface mostra ações apenas para papéis permitidos, mas o servidor continua sendo a fonte de autorização.
- Rever todos os diálogos fixos, select/dropdown, popover e menu contextual. No telefone, apresentar como sheet/tela com rolagem e ação principal alcançável acima do teclado.

**Aceite:** números financeiros batem com desktop, criar/editar/aprovar/exportar funciona para quem tem permissão, formulários cabem no iPhone, e nenhuma tela exige rolagem horizontal do documento.

### Fase 5 — testes, desempenho e publicação

- Criar testes de integração de autorização/autenticação e testes de interface para fluxos essenciais em celular e desktop. Rodar typecheck, testes e build na CI antes de publicar.
- Validar em **iPhone real**, no Safari e instalado pela Tela de Início: retrato/paisagem, teclado, VoiceOver, texto ampliado, zoom, rede lenta/offline, upload, CSV, links externos e retomada após alternar apps.
- Medir abertura, bundle e renderização de listas; reduzir fundos/animações pesadas em celular e respeitar `prefers-reduced-motion`.
- Publicar em staging HTTPS com dados de teste; validar backup, migrações e rollback; liberar progressivamente e monitorar erros.
- Comparar screenshots e fluxos desktop com a linha de base. Corrigir qualquer alteração visual não intencional antes do release.

**Aceite final:** um único site com todas as áreas funcionais no iPhone e desktop; PWA instalável; nenhum problema P0 de acesso; testes verdes; desktop preservado.

## 5. Entregas revisáveis

1. **PR A:** linha de base, matriz de telas e proteção de regressão desktop.
2. **PR B:** segurança da API, sessão, exportação, uploads e testes de permissão.
3. **PR C:** shell responsivo e PWA existente concluído.
4. **PR D:** produtividade completa no iPhone.
5. **PR E:** Financeiro e administração completos no iPhone.
6. **PR F:** testes em iPhone real, desempenho, staging e correções finais.

Cada entrega deve trazer capturas do iPhone e do PC, rotas/ações alteradas, testes executados, problemas conhecidos e forma de reverter. Não marcar uma tela como pronta só porque ela cabe na largura.

## 6. Instrução pronta para a IA desenvolvedora

> Execute `PLANO_MOBILE_TELTECH.md` **somente dentro do site existente `artifacts/teltech-ledger` e da API/banco compartilhados**. Não criar app, projeto ou pasta de versão mobile, e não usar o diretório Expo `artifacts/teltech-mobile` para esta entrega. Torne o mesmo site realmente responsivo e confortável no iPhone, aproveitando a navegação mobile e o PWA que já existem. Preserve visual e fluxos do computador. Comece pelos riscos de autorização/credenciais e pela linha de base desktop; depois adapte cada tela e ação ao toque, teclado, áreas seguras e instalação pela Tela de Início. Entregue por fases com testes e capturas em iPhone/PC. Aplique `.agents/skills/teltech-brand-guidelines/SKILL.md`. Não publique sem teste em iPhone real e sem isolamento de workspaces comprovado.

## 7. Limites da auditoria

Análise estática do código e configurações; typechecks diretos do web e da API passaram em 27/09/2026. Não foram executados fluxos ponta a ponta com banco, Safari/iPhone real nem deploy. Esses testes fazem parte do plano. Um web app instalado pela Tela de Início pode abrir em modo independente no iOS; isso não equivale a um binário da App Store. Referência: [WebKit — Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
