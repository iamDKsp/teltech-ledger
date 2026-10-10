// ─── Teltech WebAuthn Face ID / Biometrics Service ───────────────────────────

const BIOMETRICS_ENABLED_KEY = "teltech_biometrics_enabled";
const BIOMETRICS_CRED_ID_KEY = "teltech_biometrics_cred_id";
const BIOMETRICS_EMAIL_KEY = "teltech_biometrics_email";

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Verifica se o dispositivo e navegador possuem suporte à biometria na plataforma (Face ID, Touch ID, Windows Hello).
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return false;
  }
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return Boolean(available);
  } catch (err) {
    console.warn("isUserVerifyingPlatformAuthenticatorAvailable error:", err);
    return false;
  }
}

/**
 * Verifica se o usuário já ativou o bloqueio por Face ID / Biometria neste navegador.
 */
export function isBiometricsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(BIOMETRICS_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Retorna o email cadastrado com a biometria, se houver.
 */
export function getBiometricsEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BIOMETRICS_EMAIL_KEY);
}

/**
 * Registra a credencial biométrica (Face ID / Touch ID) no dispositivo via WebAuthn.
 */
export async function registerBiometrics(userEmail: string, userName?: string): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    throw new Error("Seu navegador não suporta autenticação biométrica (WebAuthn).");
  }

  const isAvailable = await isBiometricsAvailable();
  if (!isAvailable) {
    throw new Error("Face ID ou biometria de plataforma não está disponível neste dispositivo.");
  }

  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const userId = window.crypto.getRandomValues(new Uint8Array(16));

  const hostname = window.location.hostname;
  const isLocalOrIp = !hostname || hostname === "localhost" || hostname === "127.0.0.1" || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

  const rpConfig = isLocalOrIp
    ? { name: "Teltech Ledger" }
    : { name: "Teltech Ledger", id: hostname };

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: rpConfig,
      user: {
        id: userId,
        name: userEmail,
        displayName: userName || userEmail.split("@")[0] || "Usuário Teltech",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  }) as PublicKeyCredential | null;

  if (!credential || !credential.rawId) {
    throw new Error("Não foi possível cadastrar a biometria neste aparelho.");
  }

  const base64Id = bufferToBase64(credential.rawId);
  localStorage.setItem(BIOMETRICS_CRED_ID_KEY, base64Id);
  localStorage.setItem(BIOMETRICS_EMAIL_KEY, userEmail);
  localStorage.setItem(BIOMETRICS_ENABLED_KEY, "true");

  return true;
}

/**
 * Solicita autenticação biométrica com Face ID / Touch ID.
 * Em iPhones, ativa a animação e câmera nativa do Face ID da Apple.
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    throw new Error("Biometria não suportada neste navegador.");
  }

  const base64Id = localStorage.getItem(BIOMETRICS_CRED_ID_KEY);
  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const hostname = window.location.hostname;
  const isLocalOrIp = !hostname || hostname === "localhost" || hostname === "127.0.0.1" || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

  const allowCredentials: PublicKeyCredentialDescriptor[] = base64Id
    ? [{
        id: base64ToBuffer(base64Id),
        type: "public-key",
        transports: ["internal"],
      }]
    : [];

  const getOptions: CredentialRequestOptions = {
    publicKey: {
      challenge,
      ...(isLocalOrIp ? {} : { rpId: hostname }),
      ...(allowCredentials.length > 0 ? { allowCredentials } : {}),
      userVerification: "required",
      timeout: 60000,
    },
  };

  const assertion = await navigator.credentials.get(getOptions);
  if (!assertion) {
    throw new Error("Autenticação biométrica cancelada ou não concluída.");
  }

  return true;
}

/**
 * Desativa o bloqueio biométrico neste dispositivo.
 */
export function disableBiometrics(): void {
  try {
    localStorage.removeItem(BIOMETRICS_ENABLED_KEY);
    localStorage.removeItem(BIOMETRICS_CRED_ID_KEY);
    localStorage.removeItem(BIOMETRICS_EMAIL_KEY);
  } catch (err) {
    console.error("Erro ao desativar biometria", err);
  }
}
