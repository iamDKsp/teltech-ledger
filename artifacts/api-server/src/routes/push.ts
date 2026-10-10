import { Router, type Request, type Response } from "express";
import webpush from "web-push";
import { requireAuth } from "../middlewares/auth";
import {
  getOrCreateVapidKeys,
  getVapidPublicKey,
  removePushSubscription,
  savePushSubscription,
  sendPushNotificationToWorkspace,
} from "../services/push-notification";
import { getWorkspaceId, getUserInfo } from "./finance";
import { logger } from "../lib/logger";

const router = Router();

// Retorna a chave pública VAPID para permitir a inscrição do navegador / PWA no iPhone/celular
router.get("/vapid-public-key", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const publicKey = await getVapidPublicKey(workspaceId);
    res.json({ publicKey });
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, "Erro ao obter chave pública VAPID");
    try {
      const fallbackKey = await getVapidPublicKey("global");
      res.json({ publicKey: fallbackKey });
    } catch {
      const generated = webpush.generateVAPIDKeys();
      res.json({ publicKey: generated.publicKey });
    }
  }
});

// Salva uma inscrição push para o usuário atual e workspace
router.post("/subscribe", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const userInfo = await getUserInfo(req, workspaceId);
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: "Dados de inscrição inválidos (endpoint, p256dh e auth são obrigatórios)" });
      return;
    }

    const userAgent = req.headers["user-agent"] as string | undefined;
    const subscription = await savePushSubscription(
      workspaceId || "default",
      userInfo?.userId ?? null,
      { endpoint, keys },
      userAgent,
    );

    res.status(201).json({ ok: true, subscriptionId: subscription.id });
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, "Erro ao salvar inscrição push");
    res.status(500).json({ error: "Erro ao registrar notificação push", message: err?.message });
  }
});

// Remove uma inscrição push
router.post("/unsubscribe", requireAuth, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      res.status(400).json({ error: "Endpoint obrigatório" });
      return;
    }

    await removePushSubscription(endpoint);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Erro ao desinscrever push");
    res.status(500).json({ error: "Erro ao desinscrever push", message: err?.message });
  }
});

// Envia uma notificação push de teste para o celular
router.post("/test", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) {
      res.status(403).json({ error: "Workspace não encontrado" });
      return;
    }

    const result = await sendPushNotificationToWorkspace(workspaceId, {
      title: "Teltech Ledger · Nexus 🤖",
      body: "Notificações no celular ativadas com sucesso! Você receberá avisos quando clientes enviarem mensagens.",
      icon: "/apple-touch-icon.png",
      badge: "/favicon-32x32.png",
      tag: "test-push",
      data: { url: "/monitoramento" },
    });

    res.json({ ok: true, sent: result.sent, failed: result.failed });
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, "Erro ao enviar teste push");
    res.status(500).json({ error: "Erro ao enviar teste push", message: err?.message });
  }
});

export default router;
