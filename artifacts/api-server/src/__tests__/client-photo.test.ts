import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { request } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { ClientPhotoFiles, validatePhotoUrl, isPublicPhotoAddress, normalizeClientPhoto, downloadClientPhoto, MAX_CLIENT_PHOTO_BYTES } from "../services/client-photo";
import { inboundWebhookSchema } from "../services/inbound-webhook-contract";

test("foto exige HTTPS, host autorizado exato e rejeita credenciais/portas/endereço IP", () => {
  const hosts = ["cdn.example.test"];
  assert.equal(validatePhotoUrl("https://cdn.example.test/picture.png?signature=abc", hosts).hostname, hosts[0]);
  for (const value of ["http://cdn.example.test/a.png", "https://user:pass@cdn.example.test/a.png", "https://cdn.example.test:8080/a.png",
    "https://cdn.example.test/a.png#fragment", "https://127.0.0.1/a.png", "https://other.cdn.example.test/a.png", "https://cdn.example.test.evil.test/a.png"]) {
    assert.throws(() => validatePhotoUrl(value, hosts));
  }
  assert.throws(() => validatePhotoUrl("https://cdn.example.test/a.png", undefined), (e: any) => e.code === "photo_host_not_allowed");
});

test("proteção de rede rejeita endereços internos, reservados e IPv6 com IPv4 embutido", async () => {
  for (const ip of ["127.0.0.1", "10.10.1.1", "192.168.1.5", "172.16.1.5", "169.254.169.254", "100.64.1.2", "0.0.0.0", "224.0.0.1",
    "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2002:a00:1::1", "64:ff9b::a00:1"]) assert.equal(isPublicPhotoAddress(ip), false, ip);
  assert.equal(isPublicPhotoAddress("8.8.8.8"), true);
  assert.equal(isPublicPhotoAddress("2606:4700:4700::1111"), true);
  await assert.rejects(downloadClientPhoto(new URL("https://localhost/photo.png")), (e: any) => e.code === "photo_destination_blocked");
});

test("validar pixels de imagem, redimensionar e salvar WebP sem depender de extensão", async () => {
  const raw = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#8033bb" } }).png().toBuffer();
  const normalized = await normalizeClientPhoto(raw);
  const meta = await sharp(normalized).metadata();
  assert.equal(meta.format, "webp"); assert.equal(meta.width, 1024); assert.equal(meta.height, 512);
  assert.equal(meta.exif, undefined);
  for (const input of [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from("not an image")]) {
    await assert.rejects(normalizeClientPhoto(input), (e: any) => e.code === "photo_format_invalid");
  }
  await assert.rejects(normalizeClientPhoto(Buffer.alloc(MAX_CLIENT_PHOTO_BYTES + 1)), (e: any) => e.code === "photo_too_large");
});

test("download fixa o IP validado e rejeita redirect, MIME incorreto e resposta excessiva", async () => {
  const bytes = Buffer.from("picture bytes");
  const run = (status = 200, headers = { "content-type": "image/png" } as Record<string, string>, chunks = [bytes]) => {
    let requests = 0;
    const fakeRequest = ((_url: URL, options: any, callback: (res: IncomingMessage) => void) => {
      requests++;
      options.lookup("cdn.example.test", {}, (_error: unknown, address: string, family: number) => {
        assert.equal(address, "8.8.8.8"); assert.equal(family, 4);
      });
      const req = new EventEmitter() as ClientRequest;
      req.end = (() => {
        queueMicrotask(() => {
          const res = Readable.from(chunks) as IncomingMessage;
          res.statusCode = status; res.headers = headers;
          callback(res);
        });
        return req;
      }) as ClientRequest["end"];
      req.destroy = ((error?: Error) => { if (error) queueMicrotask(() => req.emit("error", error)); return req; }) as ClientRequest["destroy"];
      return req;
    }) as typeof request;
    return { result: downloadClientPhoto(new URL("https://cdn.example.test/photo.png"), {
      resolve: async () => [{ address: "8.8.8.8", family: 4 }], request: fakeRequest,
    }), requests: () => requests };
  };
  assert.deepEqual(await run().result, bytes);
  const redirect = run(302);
  await assert.rejects(redirect.result, (e: any) => e.code === "photo_download_failed"); assert.equal(redirect.requests(), 1);
  await assert.rejects(run(200, { "content-type": "text/html" }).result, (e: any) => e.code === "photo_format_invalid");
  await assert.rejects(run(200, { "content-type": "image/png", "content-length": String(MAX_CLIENT_PHOTO_BYTES + 1) }).result,
    (e: any) => e.code === "photo_too_large");
  await assert.rejects(run(200, { "content-type": "image/png" }, [Buffer.alloc(MAX_CLIENT_PHOTO_BYTES + 1)]).result,
    (e: any) => e.code === "photo_too_large");
});

test("cópia persistente, deduplicação por conteúdo e remoção apenas após commit", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "leadger-photo-test-"));
  try {
    const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#663399" } }).png().toBuffer();
    const options = { uploadRoot: root, download: async () => bytes };
    const storage = new ClientPhotoFiles(options);
    const url = new URL("https://cdn.example.test/photo.png");
    const workspace = "00000000-0000-4000-8000-000000000001", client = "00000000-0000-4000-8000-000000000002";
    const local = await storage.copy(url, workspace, client, 1);
    assert.equal(await storage.copy(url, workspace, client, 1), local);
    const target = path.join(root, local.slice("/uploads/".length));
    assert.equal((await sharp(await readFile(target)).metadata()).format, "webp");
    storage.retire(local); await storage.finish(false); await access(target);
    const laterEvent = new ClientPhotoFiles(options);
    const later = await laterEvent.copy(url, workspace, client, 2);
    assert.notEqual(later, local);
    await storage.finish(true); await assert.rejects(access(target));
    await access(path.join(root, later.slice("/uploads/".length)));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("photo opcional preserva compatibilidade: omissão, null e objeto versionado", () => {
  const payload = { schemaVersion: 1, eventId: "photo-test", occurredAt: "2026-10-10T15:00:00Z", eventType: "client.upsert", data: { externalId: "client-1", version: 2, name: "Ana" } };
  for (const photo of [undefined, null, { sourceUrl: "https://cdn.example.test/photo.png", version: 1 }]) {
    assert.equal(inboundWebhookSchema.safeParse({ ...payload, data: { ...payload.data, ...(photo !== undefined ? { photo } : {}) } }).success, true);
  }
  assert.equal(inboundWebhookSchema.safeParse({ ...payload, data: { ...payload.data, photo: { sourceUrl: "https://cdn.example.test/photo.png", version: 0 } } }).success, false);
});
