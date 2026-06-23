// Web Push implementation compatible Cloudflare Workers (no Node.js APIs)
// Uses Web Crypto API for VAPID JWT signing and ECDH encryption

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function createVapidJwt(endpoint: string, vapidPrivateKey: string, vapidPublicKey: string): Promise<{ authorization: string; cryptoKey: string }> {
  const audience = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 3600; // 12h

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: expiration,
    sub: 'mailto:revemieux@gmail.com'
  };

  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key for signing
  const privateKeyBytes = base64urlDecode(vapidPrivateKey);
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: vapidPrivateKey,
    x: base64urlEncode(base64urlDecode(vapidPublicKey).slice(1, 33).buffer),
    y: base64urlEncode(base64urlDecode(vapidPublicKey).slice(33, 65).buffer),
  };

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format (64 bytes)
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  
  if (sigBytes.length === 64) {
    // Already raw format
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  } else {
    // DER format - parse it
    // DER: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
    let offset = 2; // skip 0x30 <len>
    offset++; // skip 0x02
    const rLen = sigBytes[offset++];
    const rRaw = sigBytes.slice(offset, offset + rLen);
    offset += rLen;
    offset++; // skip 0x02
    const sLen = sigBytes[offset++];
    const sRaw = sigBytes.slice(offset, offset + sLen);
    
    // Pad/trim to exactly 32 bytes
    r = new Uint8Array(32);
    s = new Uint8Array(32);
    r.set(rRaw.length > 32 ? rRaw.slice(rRaw.length - 32) : rRaw, 32 - Math.min(rRaw.length, 32));
    s.set(sRaw.length > 32 ? sRaw.slice(sRaw.length - 32) : sRaw, 32 - Math.min(sRaw.length, 32));
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  const jwt = `${unsignedToken}.${base64urlEncode(rawSig.buffer)}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    cryptoKey: vapidPublicKey
  };
}

// Encrypt payload using RFC 8291 (Web Push Encryption)
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array }> {
  const clientPublicKey = base64urlDecode(p256dhKey);
  const clientAuth = base64urlDecode(authSecret);

  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    'raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  // ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    serverKeys.privateKey,
    256
  );

  // Export server public key
  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeys.publicKey);
  const serverPublicKeyBytes = new Uint8Array(serverPublicKeyRaw);

  // Generate random salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Key derivation (RFC 8291)
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode('WebPush: info\0'),
    ...clientPublicKey,
    ...serverPublicKeyBytes
  ]);

  // PRK from auth secret
  const authKey = await crypto.subtle.importKey(
    'raw', clientAuth, { name: 'HKDF' }, false, ['deriveBits']
  );
  const ikm = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(sharedSecret), info: authInfo },
    authKey,
    256
  );

  // Derive content encryption key
  const prkKey = await crypto.subtle.importKey(
    'raw', new Uint8Array(ikm), { name: 'HKDF' }, false, ['deriveBits']
  );

  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    prkKey,
    128
  );

  // Derive nonce
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    prkKey,
    96
  );

  // Encrypt with AES-128-GCM
  const contentKey = await crypto.subtle.importKey(
    'raw', new Uint8Array(cekBits), { name: 'AES-GCM' }, false, ['encrypt']
  );

  // Pad the payload (add 0x02 delimiter + padding)
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // delimiter

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonceBits) },
    contentKey,
    paddedPayload
  );

  // Build aes128gcm body: salt(16) + rs(4) + keylen(1) + key(65) + ciphertext
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKeyBytes.length);
  header.set(salt, 0);
  header[16] = (rs >> 24) & 0xff;
  header[17] = (rs >> 16) & 0xff;
  header[18] = (rs >> 8) & 0xff;
  header[19] = rs & 0xff;
  header[20] = serverPublicKeyBytes.length;
  header.set(serverPublicKeyBytes, 21);

  const body = new Uint8Array(header.length + ciphertext.byteLength);
  body.set(header, 0);
  body.set(new Uint8Array(ciphertext), header.length);

  return { encrypted: body.buffer, salt };
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendWebPush(
  subscription: PushSubscription,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const payloadStr = JSON.stringify(payload);
    
    // Encrypt payload
    const { encrypted } = await encryptPayload(payloadStr, subscription.p256dh, subscription.auth);

    // Create VAPID authorization
    const { authorization } = await createVapidJwt(subscription.endpoint, vapidPrivateKey, vapidPublicKey);

    // Send to push service
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        'Urgency': 'high',
        'Topic': 'tlr-trigger'
      },
      body: encrypted
    });

    if (response.status === 201 || response.status === 200) {
      return { success: true, status: response.status };
    } else {
      const text = await response.text();
      return { success: false, status: response.status, error: text };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}
