import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";
import { createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { WebhookError } from "./inbound-webhook-contract";

export const MAX_CLIENT_PHOTO_BYTES = 5 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 8_000;
const privateIPv4 = new BlockList();
for (const [address, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) privateIPv4.addSubnet(address, bits, "ipv4");
const globalIPv6 = new BlockList(); globalIPv6.addSubnet("2000::", 3, "ipv6");
const restrictedIPv6 = new BlockList();
for (const [address, bits] of [["2001:db8::", 32], ["2001::", 32], ["2001:10::", 28], ["2001:20::", 28], ["2002::", 16]] as const) {
  restrictedIPv6.addSubnet(address, bits, "ipv6");
}

export function isPublicPhotoAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !privateIPv4.check(address, "ipv4")
    : family === 6 && globalIPv6.check(address, "ipv6") && !restrictedIPv6.check(address, "ipv6");
}

export function validatePhotoUrl(value: string, allowedHosts: string[] | undefined): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new WebhookError(422, "photo_url_invalid", "URL da foto inválida."); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443") || isIP(url.hostname)) {
    throw new WebhookError(422, "photo_url_invalid", "Use uma URL HTTPS direta, sem credenciais, fragmento ou porta alternativa.");
  }
  if (!allowedHosts?.includes(url.hostname)) {
    throw new WebhookError(422, "photo_host_not_allowed", "Domínio da foto não autorizado. Configure photoAllowedHosts no Leadger.");
  }
  return url;
}

/** DNS is checked once, then pinned on the TLS socket to prevent rebinding. */
export interface PhotoNetwork {
  resolve?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  request?: typeof request;
}
export async function downloadClientPhoto(url: URL, network: PhotoNetwork = {}): Promise<Buffer> {
  let addresses;
  try {
    addresses = await Promise.race([
      network.resolve ? network.resolve(url.hostname) : lookup(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("DNS timeout")), 2_000); timer.unref();
      }),
    ]);
  } catch { throw new WebhookError(503, "photo_download_failed", "Não foi possível resolver o servidor da foto. Reenvie o evento."); }
  if (!addresses.length || addresses.some((a) => !isPublicPhotoAddress(a.address))) {
    throw new WebhookError(422, "photo_destination_blocked", "Destino de download da foto não permitido.");
  }
  const selected = addresses[0];
  return new Promise<Buffer>((resolve, reject) => {
    let failed = false;
    const req = (network.request ?? request)(url, { family: selected.family,
      lookup: (_host, _options, cb) => cb(null, selected.address, selected.family),
      headers: { Accept: "image/jpeg, image/png, image/webp", "Accept-Encoding": "identity" },
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        req.destroy(new WebhookError(res.statusCode && res.statusCode >= 500 ? 503 : 422, "photo_download_failed",
          "A origem não retornou a foto diretamente (HTTP 200). Confira o link; redirecionamentos não são aceitos."));
        return;
      }
      const type = (res.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(type) ||
        (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")) {
        res.resume(); req.destroy(new WebhookError(422, "photo_format_invalid", "Envie JPEG, PNG ou WebP sem compressão HTTP.")); return;
      }
      if (Number(res.headers["content-length"]) > MAX_CLIENT_PHOTO_BYTES) {
        res.resume(); req.destroy(new WebhookError(422, "photo_too_large", "Foto excede o limite de 5 MiB.")); return;
      }
      const chunks: Buffer[] = []; let total = 0;
      res.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_CLIENT_PHOTO_BYTES) { failed = true; req.destroy(new WebhookError(422, "photo_too_large", "Foto excede o limite de 5 MiB.")); }
        else chunks.push(chunk);
      });
      res.on("error", () => { failed = true; req.destroy(new WebhookError(503, "photo_download_failed", "Download da foto interrompido.")); });
      res.on("end", () => { clearTimeout(deadline); if (!failed && total > 0) resolve(Buffer.concat(chunks));
        else if (total === 0) reject(new WebhookError(422, "photo_format_invalid", "Arquivo de foto vazio.")); });
    });
    const deadline = setTimeout(() => req.destroy(new WebhookError(503, "photo_download_failed", "Tempo de download da foto esgotado. Reenvie o evento.")), DOWNLOAD_TIMEOUT_MS);
    req.on("error", (error) => { failed = true; clearTimeout(deadline); reject(error instanceof WebhookError ? error : new WebhookError(503, "photo_download_failed", "Falha ao baixar a foto. Reenvie o evento.")); });
    req.on("close", () => clearTimeout(deadline));
    req.end();
  });
}

export async function normalizeClientPhoto(input: Buffer): Promise<Buffer> {
  if (!input.length || input.length > MAX_CLIENT_PHOTO_BYTES) throw new WebhookError(422, "photo_too_large", "Foto vazia ou maior que 5 MiB.");
  // Reject SVG/other decoders before metadata extraction.
  const png = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
  const webp = input.subarray(0, 4).toString() === "RIFF" && input.subarray(8, 12).toString() === "WEBP";
  if (!png && !jpeg && !webp) throw new WebhookError(422, "photo_format_invalid", "Conteúdo precisa ser JPEG, PNG ou WebP.");
  try {
    const image = sharp(input, { failOn: "warning", limitInputPixels: 16_000_000 });
    const meta = await image.metadata();
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1) throw new Error("Invalid image");
    return await image.rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).timeout({ seconds: 3 }).toBuffer();
  } catch { throw new WebhookError(422, "photo_format_invalid", "Foto inválida, animada ou acima de 16 milhões de pixels."); }
}

export interface PhotoStorageOptions { uploadRoot?: string; download?: (url: URL) => Promise<Buffer> }
export class ClientPhotoFiles {
  private obsolete: string[] = [];
  private root: string;
  constructor(private options: PhotoStorageOptions = {}) { this.root = path.resolve(options.uploadRoot ?? path.join(process.cwd(), "public", "uploads")); }

  async copy(url: URL, workspaceId: string, clientId: string) {
    const bytes = await normalizeClientPhoto(await (this.options.download ?? downloadClientPhoto)(url));
    const hash = createHash("sha256").update(bytes).digest("hex");
    const relative = `client-photos/${workspaceId}/${clientId}/${hash}.webp`;
    const target = path.join(this.root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    try { await writeFile(target, bytes, { flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    return `/uploads/${relative}`;
  }

  retire(url: string | null | undefined) {
    // Only retire files created by this service, never arbitrary upload paths.
    if (url && /^\/uploads\/client-photos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-f0-9]{64}\.webp$/.test(url)) {
      this.obsolete.push(path.join(this.root, url.slice("/uploads/".length)));
    }
  }

  async finish(committed: boolean) {
    // A lost connection during COMMIT can have an unknown outcome. Never remove
    // a new immutable file on error: it may already be referenced by the DB.
    if (!committed) return;
    await Promise.all(this.obsolete.map((target) => unlink(target).catch(() => { /* Unreferenced files can be reclaimed by storage maintenance. */ })));
  }
}
