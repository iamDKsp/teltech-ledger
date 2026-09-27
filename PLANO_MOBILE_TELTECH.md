# Plano de desenvolvimento — mesmo site Teltech Ledger, responsivo para iPhone

**Escopo confirmado:** evoluir **o site existente** em `artifacts/teltech-ledger` para funcionar muito bem em celular e ser instalável pela Tela de Início do iPhone. Manter o produto de computador como está visual e funcionalmente. **Não criar outro aplicativo, outro projeto ou uma pasta separada para a versão mobile.** O diretório `artifacts/teltech-mobile` (Expo), já existente no repositório, fica fora deste trabalho.

## Resultado esperado

- Mesma URL, mesma aplicação React/Vite, mesma API, mesmas contas, projetos e dados no computador e no iPhone.
- Layout adaptativo: o desktop conserva sua composição atual; em tela pequena, navegação, conteúdo, modais, tabelas e ações passam a ter apresentação e interação adequadas ao toque.
- Instalação pela Tela de Início como **web app/PWA**, com ícone e abertura em modo independente. Isso dá experiência semelhante à de um app no iPhone, embora não seja um aplicativo distribuído pela App Store.
- Paridade funcional com as áreas que já funcionam no desktop. A Cronologia já está implementada, mas sua composição atual ainda é inadequada ao iPhone e precisa de uma apresentação própria para tela estreita, dentro do mesmo componente/projeto.

## 1. O que já existe e deve ser aproveitado

| Parte | Evidência no código | Como evoluir |
| --- | --- | --- |
| App web | `artifacts/teltech-ledger/src/App.tsx` e `src/TeltechLedger.tsx` | continuar no mesmo produto; não duplicar regras ou criar app paralelo |
| Detecção de largura | `src/hooks/use-mobile.tsx`, usado em `TeltechLedger.tsx` | estabilizar detecção inicial e cobrir telefone em paisagem |
| Navegação mobile | `MobileBottomNav` e `MobileDrawer` já presentes em `TeltechLedger.tsx` | completar estados, toque, acessibilidade, rotas e área segura; evitar reconstruir do zero |
| PWA | `index.html`, `public/manifest.webmanifest` e registro de `sw.js` em `src/main.tsx` | validar instalação, ícones, atualização, cache e áreas seguras no iPhone |
| UI desktop | páginas e componentes em `src/pages/` e `src/components/` | acrescentar variantes responsivas no mesmo projeto, protegendo os estilos desktop |
| Dados | `src/lib/api.ts`, API Express e PostgreSQL | mesmas chamadas e dados nas duas larguras; melhorar contratos/erros onde necessário |

**Estado do repositório:** durante esta revisão surgiram alterações não commitadas em configuração, API, Financeiro, Configurações e integração WhatsApp. São trabalho em andamento no mesmo repositório. A IA desenvolvedora deve conferir o estado no início de cada entrega, preservar essas mudanças e evitar misturar essa integração com os PRs de responsividade. As referências de linha abaixo são aproximadas e devem ser confirmadas no código atual.

## 2. Diagnóstico do site atual

### Arquitetura

- Monorepo pnpm/TypeScript; frontend React/Vite em `artifacts/teltech-ledger`, backend Express em `artifacts/api-server`, banco PostgreSQL/Drizzle em `lib/db`.
- `TeltechLedger.tsx` concentra shell, sidebar, cabeçalho, rotas por `wouter` e quadro. `FinanceiroPage.tsx` concentra grande parte da interface financeira. O uso extenso de estilos inline limita a adaptação por media queries isoladas.
- Áreas atuais: login, Início, Painel, Minhas Tarefas, Projetos (Visão Geral, Lista, Quadros, Cronologia, Calendário, Canais, Arquivos), Membros, Financeiro, Metas, Configurações e reuniões.

### Lacunas para o iPhone

| Achado | Impacto | Trabalho necessário |
| --- | --- | --- |
| O shell já usa `100dvh`, mas o `Header` mobile tem apenas `padding: 8px 12px`, sem aplicar a área segura superior (`TeltechLedger.tsx`, perto de 2141) | no app instalado, horário, bateria e recorte podem cobrir o cabeçalho | reservar `env(safe-area-inset-top)` e respiro adicional, sem afetar desktop |
| A barra inferior usa `position: fixed; bottom: 0` e altura/padding com `safe-area-inset-bottom` (`TeltechLedger.tsx`, perto de 1707), enquanto o conteúdo também reserva altura e algumas páginas somam padding inferior | a captura passa sensação de barra suspensa e há risco de espaço duplicado ou conteúdo escondido | medir no iPhone real em Safari e PWA; ancorar fundo até a borda física e reservar a área do indicador de início somente para os controles |
| `ProjectTimeline.tsx` mantém controles largos em linha e painel esquerdo com `width/minWidth: 320` ao lado do Gantt | Cronologia fica cortada e a linha do tempo quase desaparece no telefone, inclusive vazia | variante mobile de fluxo único; rolagem horizontal só dentro do Gantt |
| `FinanceiroPage.tsx` usa `gridTemplateColumns: "2fr 1fr"` no cockpit (perto de 1339), cards com mínimos de 260/320 px e ações em linha | gráfico e Central de Pendências ficam lado a lado e cortados, como na imagem enviada | empilhar seções/cards, adaptar toolbar e preservar rolagem apenas na faixa de abas |
| O quadro já recebeu toque para abrir e ação “Mover para…” | a interação móvel precisa ser verificada de ponta a ponta | testar toque, mover, persistência e rolagem sem regressão do arrastar no desktop |
| `TaskModal.tsx` já troca os 900 px do desktop por tela cheia mobile e protege o topo, mas outros diálogos e ações internas ainda precisam de verificação | teclado, rodapé ou confirmações podem cobrir ações | aproveitar a variante existente; completar e testar cada modal/sheet |
| Painel, Metas, Membros, Calendário e Financeiro usam grades, painéis ou tabelas pensadas para desktop | rolagem horizontal e controles pequenos | cards/listas e detalhes progressivos no celular |
| `FinanceiroPage.tsx:592-624` carrega 11 endpoints juntos | abertura custosa em rede móvel | carregar dados por área/aba e paginar listas |
| `index.html` já usa `viewport-fit=cover` e não bloqueia zoom, mas isso exige compensação explícita no layout | áreas superior/inferior ficam disponíveis ao conteúdo sem proteção automática | aplicar `safe-area-inset-*` nos elementos corretos e validar zoom, teclado e rotação |
| Existe service worker, mas o comportamento offline e de atualização precisa de verificação funcional | instalação não comprova que os fluxos funcionem sem rede | política explícita para shell estático, atualização e estados sem conexão |

### Riscos de base que afetam os dois tamanhos de tela

1. **Autorização:** `routes/projects.ts` já usa `getProjectAccess` para verificar vínculo ao workspace; completar uma auditoria de permissões por recurso e papel nas rotas aninhadas de projetos, tarefas, reuniões, membros, metas, finanças e arquivos. Os testes precisam provar isolamento entre workspaces.
2. **Sessão e exportação:** o login atual remove a chave legada que guardava senha e preserva apenas o e-mail; a exportação financeira já usa `fetch` com Bearer e `Blob`. Validar persistência da sessão e download/compartilhamento do CSV no Safari e no PWA, sem recolocar segredo em URL ou armazenamento de senha.
3. **Uploads e segredos:** `routes/upload.ts` já limita tamanho, MIME e extensão, mas `nginx.conf` serve `/uploads/` publicamente; revisar o tratamento de anexos privados e validação do conteúdo. Compose ainda traz `JWT_SECRET` de fallback; exigir segredo forte em produção.
4. **Operação:** `docker-entrypoint.sh` usa `drizzle-kit push --force` ao iniciar. Migrar com segurança antes de ampliar o uso, com backup e restauração testados.
5. **Qualidade:** typechecks diretos do site e da API passaram em uma auditoria anterior. Isso não valida layout no Safari, áreas seguras, fluxos reais de dados ou regressão desktop; criar cobertura direcionada.

## 3. Regras de implementação

1. **Uma aplicação, layouts adaptativos:** alterar os componentes existentes ou extrair componentes compartilhados dentro de `artifacts/teltech-ledger/src/`. Não criar pacote, aplicativo ou árvore de telas paralela para mobile. Toda ação usa o mesmo estado, URL e API.
2. **Desktop protegido:** registrar capturas e fluxos de referência antes de editar. Usar estilos responsivos delimitados por breakpoint e evitar alterações globais desnecessárias. A interface do PC deve manter sidebar, header, densidade, modais e quadro atuais.
3. **Mobile pensado para toque:** a navegação inferior/drawer existentes são a base. Não depender de hover, mouse, botão minúsculo ou arrastar para ação essencial. Toda ação precisa de rótulo, foco e alvo confortável.
4. **Identidade Teltech:** aplicar `.agents/skills/teltech-brand-guidelines/SKILL.md` às adaptações, reutilizando o dark mode e os tokens oficiais já presentes em `src/index.css`. Qualquer ajuste global exige comparação visual do desktop.
5. **Sem números ou ações simuladas:** no mobile, toda tela deve continuar refletindo a API real. Estados vazio/erro/offline devem ser explícitos; nenhuma operação pode aparentar sucesso após falha de rede.
6. **Privacidade do PWA:** cachear apenas shell/arquivos estáticos por padrão. Não cachear indiscriminadamente API autenticada ou dados financeiros; limpar estado sensível ao sair. Escritas offline só se existir fila e resolução de conflito demonstradas.
7. **Um contrato de áreas seguras:** reservar a área do relógio/recorte no topo do cabeçalho e do drawer; deixar o fundo da navegação inferior chegar à borda do aparelho e posicionar os controles acima do indicador Home. Reservar a altura da barra no conteúdo **uma vez só**. Não espalhar compensações diferentes por página.
8. **Tela pronta significa uso real:** largura correta não basta. Texto legível, valores completos, filtros e ações por toque, rolagem vertical natural, teclado sem encobrir campo ou botão, estados vazio/erro e ausência de corte lateral são obrigatórios.

## 4. Plano de execução para a IA desenvolvedora

### Fase 0 — mapa, linha de base e critérios

- Conferir novamente o estado do repositório e preservar trabalho não commitado. Registrar captura e comportamento do desktop em 1280, 1440 e 1920 px: login, Início, Painel, projetos, tarefa, Financeiro, Membros, Metas e Configurações.
- Criar matriz por tela: rota, componente, largura mínima que funciona, dados, ações de leitura/escrita, papel permitido, estado vazio, defeito mobile, solução proposta e teste de aceite. Incluir **todas as abas**, modais e drawers; não encerrar a auditoria nas telas das imagens.
- Usar as capturas desta solicitação como casos P0: Cronologia com painel lateral de 320 px e Gantt comprimido; cockpit financeiro com duas colunas e cartões cortados; cabeçalho sob status bar; distância visual excessiva da navegação inferior.
- Definir breakpoints pelo espaço disponível; conferir 320, 375, 390 e 430 px de largura CSS, além de retrato/paisagem e teclado aberto. Não detectar modelo por user agent.
- Desenhar rapidamente a navegação mobile sobre **a navegação já existente**: Início, Tarefas, Projetos, Financeiro e Mais; listar o destino de todas as áreas em “Mais”.

**Aceite:** matriz e capturas de referência prontas; problemas das duas imagens registrados como falhas reproduzíveis; nenhuma funcionalidade ou alteração local omitida.

### Trilha paralela — segurança compartilhada, obrigatória antes de publicar

- Aproveitar `getProjectAccess` já existente e verificar cobertura de workspace/papel em projetos, tarefas, membros, reuniões, metas, finanças e arquivos, tanto leitura quanto escrita.
- Manter a remoção da senha legada e a exportação autenticada já implementadas; testar sessão e CSV no iPhone. Não introduzir senha armazenada ou JWT em URL.
- Exigir segredos fortes em produção, revisar endpoint público de usuários/registro conforme política da empresa, validar conteúdo de upload e proteger download de anexos privados.
- Substituir `push-force` por migrações versionadas com backup/rollback.
- Criar testes com dois workspaces e papéis distintos: um usuário não lê/edita recursos do outro, e membro comum não administra contas nem aprova despesas sem direito.

Essa trilha pode avançar **em paralelo** às fases visuais P0, mas é bloqueio para publicação em produção. **Aceite:** isolamento e papéis comprovados no servidor; login/exportação legítimos funcionam no iPhone e desktop; nenhuma regressão visual.

### Fase 1 — corrigir cabeçalho, barra inferior e rolagem no iPhone (P0)

- Melhorar `useIsMobile` para evitar flash de layout inicial e manter comportamento correto em orientação paisagem. Não montar dois conjuntos de telas ou disparar buscas duplicadas.
- Finalizar bottom nav e drawer existentes: seleção correta pela URL, voltar/avançar, recarregamento, links diretos, projeto ativo e indicação da área atual.
- O shell autenticado já usa `100dvh`. Manter essa base e oferecer fallback onde necessário; revisar `overflow:hidden` e os contêineres roláveis para que a área útil acompanhe Safari, PWA instalado, rotação e teclado. Usar `visualViewport` somente se a validação mostrar que CSS não resolve.
- Aplicar `env(safe-area-inset-top)` **no cabeçalho mobile e no drawer**, somado a um pequeno respiro visual. Conferir seletor de projeto, avatar, menus e faixa de abas quando o iPhone tem recorte/Ilha Dinâmica. Não acrescentar esse espaço ao cabeçalho desktop.
- Medir a barra inferior na captura e no aparelho: o código já usa `bottom: 0` e seu fundo parece tocar a borda; os ícones precisam ficar acima do indicador Home. Ajustar a composição visual da faixa sem colocar controles na área de gesto. Em Safari e PWA instalado, fundo até a borda e ícones confortavelmente próximos dela.
- Eliminar a **reserva inferior duplicada** entre o shell (`TeltechLedger.tsx`, `paddingBottom` do conteúdo) e `.responsive-page-pad` aplicada a Início, Painel e Minhas Tarefas. Definir uma única variável/contrato para altura da navegação e espaço de rolagem, inclusive em páginas com botão fixo.
- Proteger topo e rodapé do drawer, modais e sheets com os insets apropriados. Campos focados e ações principais devem permanecer alcançáveis com teclado aberto; evitar rolagem horizontal do documento.
- Rever PWA existente: manifest, ícones, `display: standalone`, instalação, escopo, atualização do service worker, shell offline e HTTPS. Manter `lang="pt-BR"` e viewport com zoom permitido; validar tamanho de fonte dos campos.

**Aceite:** relógio/bateria jamais cobrem controles; o drawer também respeita o recorte; fundo da barra inferior termina na borda física, com ícones acima do indicador Home; não há faixa vazia extra nem conteúdo escondido. Validar na mesma URL em Safari e PWA instalado, com teclado e rotação.

### Fase 2 — corrigir as telas das capturas (P0)

**Cronologia (`src/components/ProjectTimeline.tsx`).** Manter o Gantt completo do desktop. Em largura de telefone, substituir a divisão simultânea de painel 320 px + régua por uma apresentação legível: lista/agenda de tarefas por etapa com datas e progresso; oferecer acesso à linha do tempo em área própria ou alternância clara entre lista e Gantt. Se houver Gantt mobile, a rolagem horizontal deve ocorrer **dentro dele**, nunca na página inteira. Redesenhar o switch “Linha do Tempo/Roadmap”, agrupamento, busca, prioridade, zoom e “Hoje” para caberem em linhas controladas ou filtros em sheet. O estado com zero tarefas também deve ocupar a largura correta e explicar como criar/visualizar itens. Preservar abertura de tarefa e marcos por toque.

**Financeiro (`src/pages/FinanceiroPage.tsx`).** No cockpit, transformar KPIs e grade `2fr 1fr` em uma coluna na largura estreita; gráfico, Central de Pendências e ações rápidas devem aparecer inteiros, na ordem de importância, com rótulos e valores legíveis. Reorganizar título, mês, Exportar CSV e Novo Lançamento sem corte ou botões minúsculos. A faixa das oito abas pode rolar horizontalmente de forma explícita; o conteúdo da aba não deve herdar essa largura. Revisar os `minmax(260px/320px)`, mínimos de cards e cabeçalhos/gráficos. Manter o Livro Caixa mobile já existente. Na fase 4, concluir a adaptação detalhada das outras sete áreas e dos formulários.

**Aceite:** reproduzir as duas capturas em viewport equivalente e demonstrar que a Cronologia e o cockpit cabem no iPhone, sem painel/cartão cortado; filtros, tarefas, gráfico, pendências e ações principais são alcançáveis por toque. A versão desktop deve comparar visualmente com a linha de base.

### Fase 3 — produtividade no celular

| Área | Adaptação no mesmo projeto | Aceite |
| --- | --- | --- |
| Login/perfil | o login ainda usa `100vh`; ajustar altura/teclado e foco. Revisar perfil em tela estreita e controle de zoom | entrar, manter sessão, editar perfil e sair sem campo oculto |
| Início/Painel | aproveitar o wrap existente; eliminar bases de 320/280 px e cartões/metadados que ainda forçam largura; verificar gráficos | números iguais aos do PC, nenhum cartão cortado |
| Minhas Tarefas | filtros roláveis, lista confortável, estados vazios e ações visíveis; remover segunda reserva inferior | filtrar, abrir e concluir sem hover |
| Projetos/Visão Geral | seletor, busca e ações em drawer/sheet; adaptar as duas colunas fixas de `ProjectOverview.tsx` | navegar, criar, editar e voltar corretamente |
| Lista de Projetos | trocar a grade fixa de seis colunas de `ProjectList.tsx` por cards/linhas mobile com informação essencial e detalhe | ordenar/filtrar/abrir/editar sem rolagem da página inteira |
| Quadros | aproveitar filtro mobile por etapa e “Mover para…” já presentes; impedir que “Todas” devolva uma largura de desktop no iPhone; ajustar confirmação fixa de 380 px | abrir, mover e excluir por toque; mudança persiste na API e no PC |
| Detalhe da tarefa | `TaskModal.tsx` já tem tela cheia e área segura superior; concluir rolagem, área inferior, subtarefas, responsáveis, tags, prazo, comentários, anexos e timer | todas as ações atuais funcionam com teclado e toque |
| Calendário | substituir sete colunas rígidas por agenda/lista ou navegação por dia; em `ProjectCalendar.tsx` tocar tarefa hoje apenas chama `console.log`, então ligar ao detalhe real | tarefa abre, data muda, filtros funcionam |
| Canais | adaptar compositor, histórico, teclado e área inferior; verificar fonte de input e envio de anexos | ler e enviar mensagens sem controles cobertos |
| Arquivos | adaptar grade/lista e menus de `ProjectFiles.tsx`, sem colunas ocultas | upload, download e ações disponíveis por toque |

No quadro, manter o arrastar do desktop intacto e verificar a alternativa de toque já implementada. Reduzir o padrão de uma requisição de timer por tarefa em `TeltechLedger.tsx` ao carregar board, sem mudar resultados. `ProjectModal.tsx` já tem adaptação inicial: completar e testar em vez de duplicar.

**Aceite ponta a ponta:** entrar → escolher projeto → criar tarefa → atribuir → comentar/anexar → mover etapa → concluir → ver resultado no desktop.

### Fase 4 — concluir Financeiro e administração

- Concluir **cada uma das oito abas financeiras**: Cockpit Executivo, Livro Caixa, Clientes & Cobranças, Contas & Conciliação, DRE & Rentabilidade, Orçamentos & Metas, Governança & Alçadas e Sócios & Reembolsos. Só o Livro Caixa tem variante mobile explícita atualmente. Usar listas/cards com detalhe progressivo, filtros e ações visíveis; não comprimir tabelas desktop até ficarem ilegíveis.
- Transformar grades de cards com `minmax(320px)` e tabelas em layouts que caibam na área interna do telefone. Manter valores, contexto, status e ações sem depender de arrastar horizontalmente o documento. Gráficos precisam redimensionar, apresentar legenda e permitir leitura dos números.
- Adaptar os formulários financeiros que ainda usam duas colunas e diálogos altos para tela/sheet móvel: uma coluna, rolagem dentro do formulário, cabeçalho/ação final visíveis, teclado numérico adequado e conteúdo acima da barra inferior. Validar criar, editar, pagar, aprovar, rejeitar, exportar e compartilhar, conforme permissão.
- Carregar dados por aba/necessidade, paginar lançamentos e preservar filtros ao voltar. Confirmar operações financeiras com valor, entidade e consequência.
- **Membros:** substituir grade fixa `1fr 200px 140px 120px 160px` por cards/lista mobile; modal de 460 px deve caber e rolar. **Metas:** adaptar cabeçalho, ações e modal de 480 px. **Configurações/reuniões:** eliminar sidebar fixa de 250 px no telefone, apresentar seções navegáveis e formulários em uma coluna.
- Rever todos os diálogos, select/dropdown, popover e menu contextual. A interface mostra ações apenas para papéis permitidos, mas o servidor continua sendo a fonte de autorização.

**Aceite:** números financeiros batem com desktop; criar/editar/aprovar/exportar funciona para quem tem permissão; oito abas, Metas, Membros, Configurações e reuniões são utilizáveis no iPhone menor com teclado aberto; nenhuma tela exige rolagem horizontal do documento.

### Fase 5 — testes, desempenho e publicação

- Criar testes de integração de autorização/autenticação e testes de interface para fluxos essenciais em celular e desktop. Rodar typecheck, testes e build na CI antes de publicar.
- Automatizar uma varredura das rotas/abas principais em 320, 375, 390 e 430 px: `document.documentElement.scrollWidth` não deve exceder a área visível por causa do layout; exceções de rolagem horizontal devem ficar restritas a elementos internos intencionais, como faixa de abas ou Gantt.
- Validar em **iPhone real**, no Safari e instalado pela Tela de Início: retrato/paisagem, teclado, VoiceOver, texto ampliado, zoom, rede lenta/offline, upload, CSV, links externos e retomada após alternar apps. Testar pelo menos um aparelho com recorte/Ilha Dinâmica e comparar com o simulador em largura menor.
- Para topo/rodapé, registrar captura com relógio/bateria/indicador Home visíveis; conferir que nenhum botão ocupa essas áreas e que a barra não parece deslocada. Repetir com drawer, modal, scroll no fim da página, teclado aberto e troca de aba.
- Para as duas capturas desta solicitação, testar também com **zero tarefas** e **dados financeiros vazios**, além de dados reais/representativos: estados vazios não podem manter grades quebradas.
- Medir abertura, bundle e renderização de listas; reduzir fundos/animações pesadas em celular e respeitar `prefers-reduced-motion`.
- Publicar em staging HTTPS com dados de teste; validar backup, migrações e rollback; liberar progressivamente e monitorar erros.
- Comparar screenshots e fluxos desktop com a linha de base. Corrigir qualquer alteração visual não intencional antes do release.

**Aceite final:** um único site com todas as áreas funcionais no iPhone e desktop; PWA instalável; zero elemento sob status bar/Home indicator; nenhuma barra inferior visualmente suspensa ou reserva duplicada; nenhuma página cortada lateralmente; Cronologia e oito abas financeiras usáveis; testes verdes; desktop preservado.

## 5. Entregas revisáveis

1. **PR A:** linha de base, matriz de todas as telas e proteção de regressão desktop.
2. **PR B:** cabeçalho, drawer, navegação inferior, rolagem/teclado e PWA; demonstração em Safari e instalado.
3. **PR C:** Cronologia e cockpit financeiro das capturas corrigidos, com antes/depois e desktop preservado.
4. **PR D:** demais telas de produtividade e projetos, incluindo abertura real da tarefa no Calendário.
5. **PR E:** oito áreas financeiras, formulários, Metas, Membros, Configurações e reuniões no iPhone.
6. **PR de segurança em paralelo:** autorização, uploads, segredos, migrações e testes de isolamento; integrado antes do release.
7. **PR F:** testes em iPhone real, desempenho, staging e correções finais.

Cada entrega deve trazer capturas do iPhone e do PC, rotas/ações alteradas, testes executados, problemas conhecidos e forma de reverter. Não marcar uma tela como pronta só porque ela cabe na largura.

## 6. Instrução pronta para a IA desenvolvedora

> Execute `PLANO_MOBILE_TELTECH.md` **no mesmo site React/Vite `artifacts/teltech-ledger`**, com a API/banco compartilhados quando necessário. Não criar app, projeto ou pasta de versão mobile; não usar `artifacts/teltech-mobile` nesta entrega. Primeiro registre a linha de base do desktop. Depois corrija como P0 as quatro falhas das capturas: cabeçalho sob relógio/bateria, barra inferior visualmente alta, Cronologia/Gantt comprimida e cockpit financeiro cortado. Em seguida percorra **todas** as telas/abas e conclua cada interação no iPhone, inclusive o toque nas tarefas do Calendário. Aproveite as adaptações mobile/PWA que já existem e preserve o visual e os fluxos do PC. Entregue PRs com capturas antes/depois em iPhone e desktop, teste em Safari e PWA instalado, teclado e áreas seguras. Conduza a auditoria de autorização/segredos em paralelo e resolva seus bloqueios antes de publicar. Aplique `.agents/skills/teltech-brand-guidelines/SKILL.md`. Não considere pronta uma tela que apenas cabe na largura; valores, ações, rolagem e estados vazios devem funcionar.

## 7. Limites da auditoria

Análise estática do código, configurações e capturas fornecidas; typechecks diretos do web e da API passaram em uma auditoria anterior, mas não foram repetidos para esta revisão do plano. Não foram executados fluxos ponta a ponta com banco, Safari/iPhone real nem deploy. A impressão de barra inferior elevada precisa ser conferida no aparelho: na primeira captura, o fundo da barra parece chegar à borda, enquanto os ícones ficam acima da área de gesto. Os testes reais fazem parte do plano. Um web app instalado pela Tela de Início pode abrir em modo independente no iOS; isso não equivale a um binário da App Store. Referência: [WebKit — Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
