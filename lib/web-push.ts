/**
 * Minimal Web Push (RFC 8291 / RFC 8292) implementation using Node.js built-in
 * crypto — no external `web-push` package required.
 *
 * Supports the VAPID authentication scheme and AES-GCM message encryption.
 */

import { createSign, createECDH, randomBytes, createCipheriv } from "crypto";

export interface PushSubscription {
  endpoint: string;
  p256dh: string; // base64url-encoded client public key
  auth: string;   // base64url-encoded 16-byte auth secret
}

export interface VapidKeys {
  publicKey: string;  // base64url-encoded uncompressed P-256 public key (65 bytes)
  privateKey: string; // base64url-encoded P-256 private key (32 bytes)
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64url(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(pad), "base64");
}

/**
 * Build a VAPID Authorization header value.
 */
function buildVapidAuthHeader(
  audience: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600; // 12 hours

  const header = base64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = base64url(
    Buffer.from(JSON.stringify({ aud: audience, exp, sub: subject }))
  );
  const signingInput = `${header}.${payload}`;

  // Sign with ES256 (ECDSA P-256 + SHA-256)
  const privateKeyDer = fromBase64url(vapidPrivateKey);
  const sign = createSign("SHA256");
  sign.update(signingInput);

  // Node's createSign with EC key needs a PEM or KeyObject
  // We construct a SEC1 PEM from the raw 32-byte private key scalar
  const seq = Buffer.concat([
    Buffer.from("3077020101042", "hex").slice(0, -1), // incomplete — see below
  ]);
  // Build raw DER for EC PRIVATE KEY (SEC1) manually
  const ecPrivKeyDer = buildSec1Der(privateKeyDer, fromBase64url(vapidPublicKey));
  const pem = `-----BEGIN EC PRIVATE KEY-----\n${ecPrivKeyDer
    .toString("base64")
    .match(/.{1,64}/g)!
    .join("\n")}\n-----END EC PRIVATE KEY-----`;

  const signer = createSign("SHA256");
  signer.update(signingInput);
  const derSig = signer.sign(pem);

  // Convert DER-encoded ECDSA signature to raw R||S (64 bytes) then base64url
  const rawSig = derToRaw(derSig);
  const signature = base64url(rawSig);

  const token = `${signingInput}.${signature}`;
  return `vapid t=${token}, k=${vapidPublicKey}`;
}

/**
 * Build a minimal SEC1 DER structure for a P-256 private key.
 */
function buildSec1Der(privateKey: Buffer, publicKey: Buffer): Buffer {
  // ECPrivateKey ::= SEQUENCE {
  //   version        INTEGER { ecPrivkeyVer1(1) }
  //   privateKey     OCTET STRING
  //   parameters [0] OID (P-256)
  //   publicKey  [1] BIT STRING
  // }
  const p256OidBytes = Buffer.from("06082a8648ce3d030107", "hex"); // OID 1.2.840.10045.3.1.7
  const oidTagged = Buffer.concat([
    Buffer.from([0xa0, p256OidBytes.length]),
    p256OidBytes,
  ]);
  const pubKeyBitString = Buffer.concat([
    Buffer.from([0x00]), // no unused bits
    publicKey,
  ]);
  const pubKeyTagged = Buffer.concat([
    Buffer.from([0xa1]),
    derLen(pubKeyBitString.length + 2),
    Buffer.from([0x03]),
    derLen(pubKeyBitString.length),
    pubKeyBitString,
  ]);
  const privOctet = Buffer.concat([
    Buffer.from([0x04]),
    derLen(privateKey.length),
    privateKey,
  ]);
  const versionInt = Buffer.from([0x02, 0x01, 0x01]); // INTEGER 1

  const body = Buffer.concat([versionInt, privOctet, oidTagged, pubKeyTagged]);
  return Buffer.concat([Buffer.from([0x30]), derLen(body.length), body]);
}

function derLen(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes = [];
  let n = len;
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/** Convert DER-encoded ECDSA signature to raw R||S (64 bytes each) */
function derToRaw(der: Buffer): Buffer {
  let offset = 2; // skip SEQUENCE tag + length
  if (der[1] & 0x80) offset += der[1] & 0x7f;
  // R
  offset++; // INTEGER tag
  const rLen = der[offset++];
  const r = der.slice(offset, offset + rLen);
  offset += rLen;
  // S
  offset++; // INTEGER tag
  const sLen = der[offset++];
  const s = der.slice(offset, offset + sLen);

  const pad = (buf: Buffer, len = 32) => {
    if (buf.length === len) return buf;
    if (buf.length > len) return buf.slice(buf.length - len); // strip leading 0x00
    return Buffer.concat([Buffer.alloc(len - buf.length), buf]);
  };
  return Buffer.concat([pad(r), pad(s)]);
}

/**
 * Encrypt a push message payload using ECDH + AES-128-GCM (RFC 8291).
 */
async function encryptPayload(
  plaintext: string,
  clientPublicKeyB64: string,
  authSecretB64: string
): Promise<{ ciphertext: Buffer; salt: Buffer; serverPublicKey: Buffer }> {
  const clientPublicKey = fromBase64url(clientPublicKeyB64);
  const authSecret = fromBase64url(authSecretB64);

  // Generate ephemeral server key pair
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublicKey = ecdh.getPublicKey() as Buffer;
  const sharedSecret = ecdh.computeSecret(clientPublicKey) as Buffer;

  const salt = randomBytes(16);

  // HKDF for auth secret
  const authInfo = Buffer.from("Content-Encoding: auth\0");
  const prk = await hkdf(authSecret, sharedSecret, authInfo, 32);

  // HKDF for content encryption key + nonce
  const context = Buffer.concat([
    Buffer.from("P-256\0"),
    Buffer.from([0x00, clientPublicKey.length]),
    clientPublicKey,
    Buffer.from([0x00, serverPublicKey.length]),
    serverPublicKey,
  ]);
  const cekInfo = Buffer.concat([Buffer.from("Content-Encoding: aesgcm\0"), context]);
  const nonceInfo = Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), context]);

  const cek = await hkdf(salt, prk, cekInfo, 16);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);

  // Encrypt
  const paddedText = Buffer.concat([Buffer.alloc(2), Buffer.from(plaintext, "utf8")]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(paddedText), cipher.final()]);
  const tag = (cipher as any).getAuthTag() as Buffer;
  const ciphertext = Buffer.concat([encrypted, tag]);

  return { ciphertext, salt, serverPublicKey };
}

/** HKDF expand (single step, max 32 bytes) */
async function hkdf(
  salt: Buffer,
  ikm: Buffer,
  info: Buffer,
  length: number
): Promise<Buffer> {
  const { createHmac } = await import("crypto");
  const prk = createHmac("sha256", salt).update(ikm).digest();
  const t = createHmac("sha256", prk)
    .update(Buffer.concat([info, Buffer.from([0x01])]))
    .digest();
  return t.slice(0, length);
}

/**
 * Send a web push notification to a single subscription.
 * Returns true on success, false on gone (410/404 — subscription expired).
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapidKeys: VapidKeys,
  subject: string // mailto: or https: contact URL for VAPID
): Promise<boolean> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const vapidHeader = buildVapidAuthHeader(
    audience,
    vapidKeys.publicKey,
    vapidKeys.privateKey,
    subject
  );

  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    payload,
    subscription.p256dh,
    subscription.auth
  );

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidHeader,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      Encryption: `salt=${base64url(salt)}`,
      "Crypto-Key": `dh=${base64url(serverPublicKey)}; p256ecdsa=${vapidKeys.publicKey}`,
      TTL: "86400",
    },
    body: ciphertext as unknown as BodyInit,
  });

  if (res.status === 410 || res.status === 404) {
    return false; // subscription gone
  }
  if (!res.ok) {
    console.error(`[web-push] Push failed: ${res.status} ${await res.text()}`);
  }
  return res.ok;
}
