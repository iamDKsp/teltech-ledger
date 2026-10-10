import { API } from "./api";

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushSupportStatus {
  supported: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | "unsupported";
}

export function checkPushSupport(): PushSupportStatus {
  if (typeof window === "undefined") {
    return { supported: false, isIOS: false, isStandalone: false, permission: "unsupported" };
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const isStandalone = 
    ("standalone" in window.navigator && Boolean((window.navigator as unknown as { standalone: boolean }).standalone)) ||
    window.matchMedia("(display-mode: standalone)").matches;

  const hasServiceWorker = "serviceWorker" in navigator;
  const hasPushManager = "PushManager" in window;
  const hasNotification = "Notification" in window;

  const supported = hasServiceWorker && hasPushManager && hasNotification;

  return {
    supported,
    isIOS,
    isStandalone,
    permission: hasNotification ? Notification.permission : "unsupported",
  };
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.error("Erro ao verificar inscrição push:", err);
    return null;
  }
}

export async function subscribeToPushNotifications(): Promise<{
  ok: boolean;
  reason?: string;
  subscription?: PushSubscription;
}> {
  const status = checkPushSupport();

  if (!status.supported) {
    if (status.isIOS && !status.isStandalone) {
      return {
        ok: false,
        reason: "No iPhone, toque em Compartilhar e 'Adicionar à Tela de Início' para ativar notificações nativas.",
      };
    }
    return { ok: false, reason: "Seu navegador não suporta notificações push." };
  }

  try {
    // 1. Solicita permissão do usuário
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        reason: "Permissão de notificações não foi concedida pelo usuário.",
      };
    }

    // 2. Aguarda o Service Worker estar pronto
    const registration = await navigator.serviceWorker.ready;

    // 3. Obtém a chave pública VAPID do servidor
    const res = await API.get<{ publicKey: string }>("/push/vapid-public-key");
    if (!res?.publicKey) {
      return { ok: false, reason: "Chave VAPID não configurada no servidor." };
    }

    // 4. Inscreve o navegador no Push Manager
    const convertedVapidKey = urlB64ToUint8Array(res.publicKey);
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });
    }

    // 5. Envia os dados para a API salvar no banco
    const subJSON = subscription.toJSON();
    if (!subJSON.endpoint || !subJSON.keys?.p256dh || !subJSON.keys?.auth) {
      return { ok: false, reason: "Dados de chave push incompletos gerados pelo navegador." };
    }

    await API.post("/push/subscribe", {
      endpoint: subJSON.endpoint,
      keys: {
        p256dh: subJSON.keys.p256dh,
        auth: subJSON.keys.auth,
      },
    });

    return { ok: true, subscription };
  } catch (err: any) {
    console.error("Erro ao ativar notificações push:", err);
    return {
      ok: false,
      reason: err?.message || "Falha ao registrar notificação push no dispositivo.",
    };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const subscription = await getCurrentPushSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await API.post("/push/unsubscribe", { endpoint });
    }
    return { ok: true };
  } catch (err: any) {
    console.error("Erro ao desativar notificações push:", err);
    return { ok: false, reason: err?.message || "Falha ao desativar notificações." };
  }
}

export async function testPushNotification(): Promise<{ ok: boolean; sent?: number; failed?: number }> {
  try {
    return await API.post<{ ok: boolean; sent: number; failed: number }>("/push/test", {});
  } catch (err) {
    console.error("Erro ao testar push notification:", err);
    throw err;
  }
}
