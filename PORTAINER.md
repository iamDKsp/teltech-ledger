# 🚀 Guia de Implantação no Portainer - Teltech Ledger

Este guia detalha o passo a passo completo para executar o **Teltech Ledger** em contêineres Docker gerenciados pelo **Portainer**.

---

## 🏗️ 1. Arquitetura do Stack

O sistema está organizado em **3 serviços integrados**:

1. **`db` (`postgres:16-alpine`)**:
   - Banco de dados PostgreSQL 16 oficial e otimizado.
   - Volume persistente: `teltech_postgres_data`.
   - Healthcheck ativo para garantir inicialização ordenada.

2. **`api` (`Dockerfile.api`)**:
   - Backend Express 5 + Node.js 22 + Drizzle ORM.
   - Aguarda o PostgreSQL ficar pronto, sincroniza automaticamente o schema (`push-force`), cria os usuários padrão (seed) e inicia a API na porta interna `5000`.
   - Volume persistente: `teltech_uploads` (armazena avatares de perfis e anexos de tarefas).

3. **`web` (`Dockerfile.web` + `nginx.conf`)**:
   - Frontend React 19 + Vite compilado servido pelo Nginx Alpine de alta performance.
   - Roteamento SPA nativo (`try_files $uri $uri/ /index.html`).
   - Proxy reverso automático para `/api/` e `/uploads/` direto para o container da API.
   - **Zero problemas de CORS** e uma única porta pública para acessar todo o sistema!

---

## 🛠️ 2. Como Implantar no Portainer

### Método A: Via Repositório Git (Recomendado)

Se o código do projeto estiver versionado em um repositório Git (GitHub, GitLab, Gitea):

1. Acesse o seu painel do **Portainer**.
2. Vá em **Stacks** no menu lateral esquerdo.
3. Clique em **+ Add stack**.
4. Defina o nome da stack: `teltech-ledger`.
5. Em **Build method**, selecione **Repository**.
6. Preencha os dados do repositório:
   - **Repository URL**: `https://github.com/seu-usuario/seu-repositorio.git`
   - **Repository reference**: `refs/heads/main` (ou a sua branch padrão)
   - **Compose path**: `docker-compose.yml`
7. *(Opcional)* Ative **Automatic updates** (Webhook) para atualizar automaticamente o contêiner sempre que fizer um `git push`.
8. Na seção **Environment variables**, clique em **Add environment variable** (ou modo texto avançado) e configure:
   ```env
   WEB_PORT=8080
   JWT_SECRET=sua_chave_secreta_super_segura_2026
   POSTGRES_USER=teltech
   POSTGRES_PASSWORD=sua_senha_do_banco_forte!
   POSTGRES_DB=teltech_ledger
   ```
9. Clique no botão **Deploy the stack**. O Portainer irá clonar o repositório, compilar as imagens e iniciar os 3 serviços.

---

### Método B: Via Servidor Local / Terminal + Portainer

Se você preferir clonar e compilar direto no servidor:

1. No terminal do seu servidor onde o Docker/Portainer está rodando:
   ```bash
   git clone <url-do-repositorio> teltech-ledger
   cd teltech-ledger
   cp .env.example .env
   # Edite o .env se desejar alterar senhas ou porta
   docker compose up -d --build
   ```
2. Após executar o comando, o stack aparecerá automaticamente na lista de contêineres e stacks do seu Portainer!

---

## 🌐 3. Acesso ao Sistema

Uma vez iniciado o stack, o Teltech Ledger estará disponível no seu navegador:

```
http://<IP_DO_SEU_SERVIDOR>:8080
```
*(Se você alterou `WEB_PORT` no `.env`, utilize a porta configurada).*

### Credenciais Padrão Pré-cadastradas:
- **Tarcísio**: `tarcisio@teltech.com.br` | Senha: `123`
- **Lucas**: `lucas@teltech.com.br` | Senha: `123`

---

## 🔒 4. Uso com Nginx Proxy Manager / Traefik / SSL HTTPS

Se você já possui um Proxy Reverso (como **Nginx Proxy Manager** ou **Traefik**) gerenciando seus domínios e certificados SSL no Portainer:

1. Aponte o domínio desejado (ex: `crm.suaempresa.com.br`) para o IP do servidor.
2. No Nginx Proxy Manager, crie um **Proxy Host**:
   - **Domain Names**: `crm.suaempresa.com.br`
   - **Scheme**: `http`
   - **Forward Hostname / IP**: `teltech-web` (se estiver na mesma rede Docker) ou `<IP_LOCAL_DO_SERVIDOR>`
   - **Forward Port**: `8080` (ou `80` se conectado via rede interna)
   - **Cache Assets**: Ativado
   - **Block Common Exploits**: Ativado
   - **Websockets Support**: Ativado
3. Na aba **SSL**, ative o certificado Let's Encrypt gratuito com **Force SSL** e **HTTP/2 Support**.

---

## 💾 5. Gerenciamento de Dados e Backups

O stack utiliza dois volumes Docker persistentes:

| Volume | Finalidade | Onde fica salvo |
| :--- | :--- | :--- |
| `teltech_postgres_data` | Tabelas, transações, clientes, tarefas | `/var/lib/docker/volumes/teltech_postgres_data/_data` |
| `teltech_uploads` | Fotos de perfil e arquivos anexados | `/var/lib/docker/volumes/teltech_uploads/_data` |

### Como fazer backup manual do banco no Portainer:
No terminal ou console do contêiner `teltech-db`:
```bash
docker exec -t teltech-db pg_dump -U teltech teltech_ledger > backup_$(date +%Y%m%d).sql
```

### Como restaurar o banco:
```bash
docker exec -i teltech-db psql -U teltech teltech_ledger < backup_20260101.sql
```

---

## 🔍 6. Diagnóstico e Comandos Úteis

- **Ver logs da API em tempo real**:
  ```bash
  docker logs -f teltech-api
  ```
- **Ver logs do Nginx**:
  ```bash
  docker logs -f teltech-web
  ```
- **Reiniciar os serviços sem perder dados**:
  ```bash
  docker compose restart
  ```
- **Recriar e atualizar após alterações no código**:
  ```bash
  docker compose up -d --build
  ```
