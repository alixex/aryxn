/**
 * Encryption helpers moved here so crypto package owns all crypto operations.
 * Exports: encryptStringForStorage, decryptStringFromStorage, deriveKey
 */

async function getCrypto(): Promise<any> {
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as any).crypto &&
    (globalThis as any).crypto.subtle
  ) {
    return (globalThis as any).crypto
  }
  try {
    const nodeCrypto = await import("crypto")
    return nodeCrypto
  } catch (e) {
    console.log("No crypto available:", e)
    throw new Error("No crypto available")
  }
}

function cryptoRandom(len: number): Uint8Array {
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as any).crypto &&
    (globalThis as any).crypto.getRandomValues
  ) {
    const a = new Uint8Array(len)
    ;(globalThis as any).crypto.getRandomValues(a)
    return a
  }
  const crypto = require("crypto")
  return new Uint8Array(crypto.randomBytes(len))
}

function bufferToBase64(buf: Uint8Array | Buffer) {
  if (typeof Buffer !== "undefined" && buf instanceof Buffer)
    return buf.toString("base64")
  return Buffer.from(buf).toString("base64")
}

function base64ToBuffer(s: string): Uint8Array {
  if (typeof Buffer !== "undefined")
    return new Uint8Array(Buffer.from(s, "base64"))
  const bin = atob(s)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const c = await getCrypto()
  if ((c as any).subtle) {
    const enc = new TextEncoder()
    const baseKey = await (c as any).subtle.importKey(
      "raw",
      enc.encode(passphrase),
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    )
    const key = await (c as any).subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    )
    return key
  }
  const crypto = await import("crypto")
  const keyBuf = crypto.pbkdf2Sync(
    passphrase,
    Buffer.from(salt),
    100000,
    32,
    "sha256",
  )
  return keyBuf
}

export async function encryptStringForStorage(
  plain: string,
  passphrase: string,
) {
  const salt = cryptoRandom(16)
  const iv = cryptoRandom(12)
  const c = await getCrypto()
  if ((c as any).subtle) {
    const key = await deriveKey(passphrase, salt)
    const enc = new TextEncoder()
    const cipher = await (c as any).subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(plain),
    )
    return {
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
      data: bufferToBase64(new Uint8Array(cipher)),
    }
  }
  const crypto = await import("crypto")
  const keyBuf = (await deriveKey(passphrase, salt)) as Buffer
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuf, iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    tag: bufferToBase64(tag),
    data: bufferToBase64(ct),
  }
}

export async function decryptStringFromStorage(obj: any, passphrase: string) {
  const salt = base64ToBuffer(obj.salt)
  const iv = base64ToBuffer(obj.iv)
  const c = await getCrypto()
  if ((c as any).subtle) {
    const key = await deriveKey(passphrase, salt)
    const cipherBuf = base64ToBuffer(obj.data)
    const plainBuf = await (c as any).subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherBuf,
    )
    const dec = new TextDecoder()
    return dec.decode(plainBuf)
  }
  const crypto = await import("crypto")
  const keyBuf = (await deriveKey(passphrase, salt)) as Buffer
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuf, iv)
  if (obj.tag) decipher.setAuthTag(base64ToBuffer(obj.tag))
  const pt = Buffer.concat([
    decipher.update(base64ToBuffer(obj.data)),
    decipher.final(),
  ])
  return pt.toString("utf8")
}
