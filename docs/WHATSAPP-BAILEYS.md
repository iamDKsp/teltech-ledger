# WhatsApp da empresa

## Ativação

1. Configure `WHATSAPP_SESSION_KEY` no ambiente da API com 64 caracteres hexadecimais. Preserve a mesma chave em cada reinício e deploy. A sessão e as chaves Signal ficam criptografadas no PostgreSQL; perder a chave exige novo pareamento.
2. Inicie a API com o schema atualizado. Em **Configurações → WhatsApp**, clique em **Conectar** e leia o QR como um dispositivo vinculado no WhatsApp da empresa.
3. Preencha a chave Pix e, se quiser avisos de retiradas, um número interno. Habilite as automações somente depois de conferir os dados.
4. Marque a autorização de WhatsApp nos clientes que realmente consentiram. Clientes antigos começam sem autorização. Faça um envio manual de teste antes de ligar as cobranças automáticas.

O número da empresa precisa de internet e a sessão deve permanecer conectada. A rotina de cobrança considera apenas receitas pendentes com cliente ativo, telefone e consentimento. O envio é interrompido quando o lançamento deixa de estar pendente ou o consentimento é removido. O histórico em Configurações permite verificar envios e falhas.

Execute somente uma instância da API com a sessão Baileys ativa. Se a API for escalada para múltiplas réplicas, será necessário eleger uma única instância para manter a conexão do WhatsApp.

## Regras financeiras

- Cada parcela é um lançamento com vencimento próprio. Os lembretes configurados antes, no dia e depois do vencimento têm identificadores únicos para evitar repetição da mesma etapa.
- A data de cobrança é interpretada como data civil em `America/Sao_Paulo`; o horário configurado também usa esse fuso.
- Um aviso interno de retirada nasce quando um lançamento de saída de sócio passa a **pago**, após o ajuste do saldo. A categoria financeira atual reúne pró-labore e outras retiradas; o texto do alerta deve tratar isso como *retirada de sócio* até que haja subtipo próprio.
- O estado **pago** reflete o registro financeiro feito por uma pessoa no sistema. Não existe conciliação bancária automática para confirmar o crédito.

## Operação e limites

Baileys é uma integração não oficial, com risco de desconexão ou restrições pelo WhatsApp. Use consentimento verificável, linguagem de lembrete de uma contratação existente e cadência moderada. Para volume alto ou cobrança crítica, considere migrar o transporte para a API oficial do WhatsApp Business, mantendo as regras de negócio e o histórico.

Referências: [documentação de conexão do Baileys](https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/socket/connecting.md), [sessões do Baileys](https://github.com/WhiskeySockets/docs/blob/main/authentication/session-management.mdx) e [política do WhatsApp Business](https://whatsappbusiness.com/pt-br/policy/).

## Nexus, Pix e sócios

- **Assistente**: todas as mensagens saem em nome do assistente (padrão *Nexus*, da empresa *Teltech*), com saudação pelo horário e o nome de quem recebe. O nome do assistente e da empresa, e o texto de cada mensagem, são editáveis em **Configurações → WhatsApp → Mensagens do Nexus** (com variáveis como `{nome}`, `{valor}`, `{vencimento}` e prévia ao vivo). Os textos padrão e as variáveis ficam em `services/whatsapp-templates.ts`.
- **Pix**: a chave aceita CPF, CNPJ, celular, e-mail ou aleatória (tipo detectado automaticamente; celular vira `+55…` no BR Code). Dois modos de entrega: *Texto + Copia e Cola* (padrão; envia a chave e uma segunda mensagem só com o código) e *Botão de Pix do WhatsApp* (experimental, mensagem interativa `review_and_pay` montada com `relayMessage`; se o envio falhar, cai sozinho para texto). O botão nativo não é um recurso oficial do Baileys: confirme em um aparelho real pela aba **Teste de envio** antes de ativar.
- **Sócios**: cada número é um contato (`whatsapp_contacts`) com nome, apelido, função e vínculo opcional a um usuário. Avisos de retirada e de pagamento de cliente são enviados por pessoa, com saudação pelo nome. Números do campo antigo `internal_alert_phone` são migrados para contatos na primeira abertura da aba.
- **Teste**: a aba *Teste de envio* confirma se o número tem WhatsApp e envia uma mensagem real e imediata (conexão, cobrança, confirmação ou aviso) com dados fictícios. Mensagens com falha ou ignoradas podem ser reenviadas pelo histórico.