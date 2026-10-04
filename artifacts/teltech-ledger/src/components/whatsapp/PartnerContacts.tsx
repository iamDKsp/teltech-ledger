import { useState } from "react";
import { BellRing, Coins, HandCoins, Link2, Pencil, Phone, Plus, Send, Trash2, UserRound, Users, X } from "lucide-react";
import { toast } from "sonner";
import { API } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { WhatsAppContact, WhatsAppSettings, WorkspaceMemberOption } from "./types";
import { Badge, Btn, Card, Field, formatPhone, SelectInput, TextInput, Tip, ToggleRow } from "./ui";
import { Switch } from "@/components/ui/switch";

interface FormState {
  name: string;
  nickname: string;
  roleLabel: string;
  phone: string;
  userId: string;
  notifyWithdrawals: boolean;
  notifyPayments: boolean;
}

const emptyForm: FormState = { name: "", nickname: "", roleLabel: "", phone: "", userId: "", notifyWithdrawals: true, notifyPayments: false };

const roleNames: Record<string, string> = { owner: "Dono", admin: "Admin", ceo: "CEO", cto: "CTO", cmo: "CMO", member: "Membro", viewer: "Leitor" };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

export function PartnerContacts({
  contacts,
  members,
  settings,
  onSettings,
  onContactsChange,
}: {
  contacts: WhatsAppContact[];
  members: WorkspaceMemberOption[];
  settings: WhatsAppSettings;
  onSettings: (patch: Partial<WhatsAppSettings>) => void;
  onContactsChange: (contacts: WhatsAppContact[]) => void;
}) {
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patchForm = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const open = (contact?: WhatsAppContact) => {
    setError(null);
    if (contact) {
      setEditing(contact.id);
      setForm({
        name: contact.name,
        nickname: contact.nickname ?? "",
        roleLabel: contact.roleLabel ?? "",
        phone: formatPhone(contact.phone),
        userId: contact.userId ?? "",
        notifyWithdrawals: contact.notifyWithdrawals,
        notifyPayments: contact.notifyPayments,
      });
    } else {
      setEditing("new");
      setForm(emptyForm);
    }
  };

  const close = () => {
    setEditing(null);
    setError(null);
  };

  const replace = (contact: WhatsAppContact) =>
    onContactsChange(contacts.some((item) => item.id === contact.id) ? contacts.map((item) => (item.id === contact.id ? contact : item)) : [...contacts, contact]);

  const submit = async () => {
    if (form.name.trim().length < 2) return setError("Informe o nome do sócio.");
    if (form.phone.replace(/\D/g, "").length < 10) return setError("Informe o WhatsApp com DDD.");
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      nickname: form.nickname.trim() || null,
      roleLabel: form.roleLabel.trim() || null,
      phone: form.phone,
      userId: form.userId || null,
      notifyWithdrawals: form.notifyWithdrawals,
      notifyPayments: form.notifyPayments,
    };
    try {
      const result =
        editing === "new"
          ? await API.post<{ contact: WhatsAppContact }>("/whatsapp/contacts", payload)
          : await API.put<{ contact: WhatsAppContact }>(`/whatsapp/contacts/${editing}`, payload);
      replace(result.contact);
      toast.success(editing === "new" ? "Sócio adicionado." : "Sócio atualizado.");
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o sócio.");
    } finally {
      setSaving(false);
    }
  };

  const update = async (contact: WhatsAppContact, patch: Partial<Pick<WhatsAppContact, "active" | "notifyWithdrawals" | "notifyPayments">>) => {
    setBusyId(contact.id);
    try {
      const result = await API.put<{ contact: WhatsAppContact }>(`/whatsapp/contacts/${contact.id}`, patch);
      replace(result.contact);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível atualizar o sócio.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (contact: WhatsAppContact) => {
    if (!window.confirm(`Remover ${contact.name}? Ele deixará de receber avisos.`)) return;
    setBusyId(contact.id);
    try {
      await API.delete(`/whatsapp/contacts/${contact.id}`);
      onContactsChange(contacts.filter((item) => item.id !== contact.id));
      toast.success("Sócio removido.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível remover o sócio.");
    } finally {
      setBusyId(null);
    }
  };

  const sendTest = async (contact: WhatsAppContact) => {
    setBusyId(contact.id);
    try {
      await API.post("/whatsapp/test", { kind: "withdrawal_alert", target: "contact", contactId: contact.id });
      toast.success(`Teste enviado para ${contact.callName}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível enviar o teste.");
    } finally {
      setBusyId(null);
    }
  };

  const pickMember = (userId: string) => {
    const member = members.find((item) => item.id === userId);
    patchForm({
      userId,
      ...(member && !form.name.trim() ? { name: member.name } : {}),
      ...(member?.phone && !form.phone.trim() ? { phone: formatPhone(member.phone) } : {}),
    });
  };

  const legacy = contacts.filter((contact) => contact.name.startsWith("Contato interno"));

  return (
    <div className="space-y-6">
      <Card
        icon={<BellRing size={19} />}
        tone="success"
        title="Avisos internos"
        description="Escolha o que o Nexus conta para a sociedade. Cada aviso vai para os sócios cadastrados abaixo, com saudação pelo nome."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <ToggleRow
            icon={<HandCoins size={18} />}
            title="Retiradas de sócios"
            description="Avisa quando uma retirada ou pró-labore é liquidado no caixa."
            help="Inclui valor, conta, saldo depois da retirada e quem registrou."
            checked={settings.withdrawalAlertsEnabled}
            onChange={(value) => onSettings({ withdrawalAlertsEnabled: value })}
          />
          <ToggleRow
            icon={<Coins size={18} />}
            title="Pagamentos de clientes"
            description="Avisa quando o pagamento de uma parcela é confirmado."
            help="Ex.: “Olá Lucas, aqui é o Nexus. O pagamento do cliente X foi confirmado.”"
            checked={settings.paymentAlertsEnabled}
            onChange={(value) => onSettings({ paymentAlertsEnabled: value })}
          />
        </div>
      </Card>

      <Card
        icon={<Users size={19} />}
        title="Sócios e destinatários"
        description="Cada número pertence a uma pessoa. O Nexus a chama pelo nome e sabe quando a retirada é dela mesma."
        action={
          <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => open()} disabled={editing !== null} tip="Cadastrar um novo sócio ou destinatário de avisos.">
            Adicionar sócio
          </Btn>
        }
      >
        {legacy.length > 0 && (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
            <Link2 size={14} className="mt-0.5 shrink-0 text-primary" />
            Trouxemos {legacy.length === 1 ? "o número que já estava cadastrado" : `os ${legacy.length} números que já estavam cadastrados`}. Clique em editar e informe o nome de cada pessoa para o Nexus poder chamá-la.
          </p>
        )}

        {editing !== null && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="animate-fade-up mb-5 rounded-xl border border-primary/30 bg-primary/[0.05] p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{editing === "new" ? "Novo sócio" : "Editar sócio"}</h3>
              <Btn variant="ghost" size="icon" onClick={close} tip="Fechar sem salvar" aria-label="Fechar">
                <X size={15} />
              </Btn>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo" help="Nome usado nos registros e no campo {socio} das mensagens.">
                <TextInput value={form.name} onChange={(event) => patchForm({ name: event.target.value })} placeholder="Ex: Lucas Almeida" autoFocus />
              </Field>
              <Field label="Como o Nexus deve chamar" help="Opcional. Se vazio, usa o primeiro nome." hint="Ex: “Lu”, “Dr. Lucas”.">
                <TextInput value={form.nickname} onChange={(event) => patchForm({ nickname: event.target.value })} placeholder="Primeiro nome" maxLength={40} />
              </Field>
              <Field label="WhatsApp" help="Número com DDD que receberá os avisos.">
                <TextInput value={form.phone} onChange={(event) => patchForm({ phone: event.target.value })} placeholder="(14) 99999-9999" inputMode="tel" />
              </Field>
              <Field label="Função (opcional)" help="Só para organização: Sócio, Financeiro, Diretoria…">
                <TextInput value={form.roleLabel} onChange={(event) => patchForm({ roleLabel: event.target.value })} placeholder="Sócio" maxLength={40} />
              </Field>
              <Field
                label="Vincular a um usuário do sistema"
                help="Quando a retirada for desta pessoa, o aviso dela dirá “(você)”. Também preenche nome e telefone."
                className="sm:col-span-2"
              >
                <SelectInput value={form.userId} onChange={(event) => pickMember(event.target.value)}>
                  <option value="">Sem vínculo</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} · {roleNames[member.role] ?? member.role}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ToggleRow title="Avisar retiradas" checked={form.notifyWithdrawals} onChange={(value) => patchForm({ notifyWithdrawals: value })} />
              <ToggleRow title="Avisar pagamentos de clientes" checked={form.notifyPayments} onChange={(value) => patchForm({ notifyPayments: value })} />
            </div>
            {error && (
              <p role="alert" className="animate-shake mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Btn onClick={close}>Cancelar</Btn>
              <Btn type="submit" variant="primary" loading={saving}>
                {editing === "new" ? "Adicionar" : "Salvar sócio"}
              </Btn>
            </div>
          </form>
        )}

        {contacts.length === 0 && editing === null ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <UserRound className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nenhum sócio cadastrado</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Cadastre cada sócio com o próprio número para que o Nexus o chame pelo nome nos avisos.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {contacts.map((contact) => {
              const busy = busyId === contact.id;
              return (
                <li
                  key={contact.id}
                  className={cn("flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-border bg-background/40 p-4 transition hover:border-primary/30", !contact.active && "opacity-60")}
                >
                  <div className="flex min-w-[14rem] flex-1 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/15 text-sm font-bold text-primary">{initials(contact.name)}</div>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 truncate text-sm font-semibold text-foreground">
                        {contact.name}
                        {contact.roleLabel && <Badge tone="muted">{contact.roleLabel}</Badge>}
                        {contact.userId && (
                          <Tip content="Vinculado a um usuário do sistema.">
                            <span>
                              <Badge tone="primary"><Link2 size={10} /> usuário</Badge>
                            </span>
                          </Tip>
                        )}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Phone size={12} /> {formatPhone(contact.phone)}</span>
                        <span>Nexus chama de <strong className="text-foreground">{contact.callName}</strong></span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <Tip content="Receber aviso quando uma retirada de sócio for liquidada.">
                      <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                        <Switch checked={contact.notifyWithdrawals} disabled={busy} onCheckedChange={(value) => void update(contact, { notifyWithdrawals: value })} aria-label={`Avisar retiradas para ${contact.name}`} />
                        Retiradas
                      </label>
                    </Tip>
                    <Tip content="Receber aviso quando um cliente pagar uma parcela.">
                      <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                        <Switch checked={contact.notifyPayments} disabled={busy} onCheckedChange={(value) => void update(contact, { notifyPayments: value })} aria-label={`Avisar pagamentos para ${contact.name}`} />
                        Pagamentos
                      </label>
                    </Tip>
                    <Tip content={contact.active ? "Pausar: esta pessoa deixa de receber qualquer aviso." : "Reativar os avisos desta pessoa."}>
                      <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                        <Switch checked={contact.active} disabled={busy} onCheckedChange={(value) => void update(contact, { active: value })} aria-label={`Ativar ${contact.name}`} />
                        Ativo
                      </label>
                    </Tip>
                  </div>

                  <div className="flex items-center gap-1">
                    <Btn variant="ghost" size="icon" disabled={busy || !contact.active} onClick={() => void sendTest(contact)} tip={`Envia um aviso de teste para ${contact.callName} agora.`} aria-label={`Enviar teste para ${contact.name}`}>
                      <Send size={15} />
                    </Btn>
                    <Btn variant="ghost" size="icon" disabled={busy || editing !== null} onClick={() => open(contact)} tip="Editar nome, apelido, número e avisos." aria-label={`Editar ${contact.name}`}>
                      <Pencil size={15} />
                    </Btn>
                    <Btn variant="ghost" size="icon" disabled={busy} onClick={() => void remove(contact)} tip="Remover este sócio." aria-label={`Remover ${contact.name}`} className="hover:text-destructive">
                      <Trash2 size={15} />
                    </Btn>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
