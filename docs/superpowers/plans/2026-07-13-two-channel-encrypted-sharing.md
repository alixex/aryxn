# Two-Channel Encrypted Sharing — Implementation Plan

> **For agentic workers:** implement task-by-task; each step is bite-sized; steps use `- [ ]`.

**Goal:** Add an OPTIONAL password mode to encrypted uploads so access requires BOTH the link (random `R` in the fragment) AND an out-of-band password (Argon2id). Default plain mode (random key in fragment) is unchanged.

**Spec:** `docs/superpowers/specs/2026-07-12-two-channel-encrypted-sharing-design.md` (crypto-reviewed — read §2/§3/§5/§10 for the exact construction and test list).

**Branch:** `feature/encrypted-sharing` (off `feature/multi-account`; depends on the `pages/` restructure).

**Tech:** libsodium `crypto_pwhash` (Argon2id13) + `crypto_generichash` (BLAKE2b). Construction: `K = BLAKE2b(R ‖ P)`, `P = Argon2id(NFC(pw), salt)`, `R` random 32B, `salt` random 16B. Plain payload = standard `base64(K)`; password payload = `p1.<base64url(R)>.<base64url(salt)>`.

**Note on Argon2id in tests:** MODERATE limits ≈ 256 MiB / ~0.5–1 s per hash. Keep Argon2id-exercising tests minimal (1–2). If a test OOMs/hangs in happy-dom, report it — do NOT silently weaken; we may pin `p1` to INTERACTIVE (the spec's documented fallback) instead.

---

## Task E1: `@alixex/crypto` primitives

**Files:** Modify `packages/crypto/src/index.ts`; Test `packages/crypto/src/argon.test.ts` (new — check if the crypto package has a test runner; if not, add these tests under `apps/link` instead and note it, OR add vitest to the crypto package mirroring apps/link's setup).

- [ ] **Step 1: Add the primitives to `packages/crypto/src/index.ts`** (uses the existing `initSodium`):
```ts
/** Argon2id13 key derivation at the pinned `p1` limits (MODERATE). salt must be 16 bytes. */
export const deriveArgon2idKey = async (password: string, salt: Uint8Array): Promise<Uint8Array> => {
  const s = await initSodium()
  return s.crypto_pwhash(
    32,
    password.normalize("NFC"),
    salt,
    s.crypto_pwhash_OPSLIMIT_MODERATE,
    s.crypto_pwhash_MEMLIMIT_MODERATE,
    s.crypto_pwhash_ALG_ARGON2ID13,
  )
}

/** Combine the link-half R and password-half P into the file key K = BLAKE2b(R‖P). */
export const combineKeyHalves = async (r: Uint8Array, p: Uint8Array): Promise<Uint8Array> => {
  const s = await initSodium()
  const buf = new Uint8Array(r.length + p.length)
  buf.set(r, 0)
  buf.set(p, r.length)
  return s.crypto_generichash(32, buf)
}

/** URL-safe base64 without padding (for R/salt in the URL fragment). */
export const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

export const fromBase64Url = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
```

- [ ] **Step 2: Tests** — create the test file (fast tests first):
```ts
import { describe, it, expect } from "vitest"
import { combineKeyHalves, toBase64Url, fromBase64Url, deriveArgon2idKey } from "../src/index"

describe("base64url", () => {
  it("round-trips arbitrary bytes without padding chars", async () => {
    const b = new Uint8Array([251, 239, 190, 0, 1, 2, 3])
    const s = toBase64Url(b)
    expect(s).not.toMatch(/[+/=]/)
    expect([...fromBase64Url(s)]).toEqual([...b])
  })
})

describe("combineKeyHalves", () => {
  it("is deterministic and order-sensitive", async () => {
    const r = new Uint8Array(32).fill(1)
    const p = new Uint8Array(32).fill(2)
    const k1 = await combineKeyHalves(r, p)
    const k2 = await combineKeyHalves(r, p)
    expect(k1.length).toBe(32)
    expect([...k1]).toEqual([...k2])
    const swapped = await combineKeyHalves(p, r)
    expect([...swapped]).not.toEqual([...k1]) // R‖P ≠ P‖R
  })
})

describe("deriveArgon2idKey", () => {
  it("same password+salt → same key; NFC-normalizes (slow: runs Argon2id)", async () => {
    const salt = new Uint8Array(16).fill(7)
    const a = await deriveArgon2idKey("café", salt) // decomposed vs precomposed below
    const b = await deriveArgon2idKey("café", salt) // e + combining acute → NFC "café"
    expect(a.length).toBe(32)
    expect([...a]).toEqual([...b])
  }, 20000) // generous timeout — Argon2id MODERATE is ~0.5–1s x2
})
```
If the crypto package has no vitest, place these under `apps/link/src/argon.test.ts` importing from `@alixex/crypto`, and say so.

- [ ] **Step 3: Verify + commit** — run the crypto tests + `pnpm --filter=@alixex/link type-check`. Commit `feat(crypto): Argon2id key derivation, key combiner, base64url helpers`.

---

## Task E2: `storage.ts` — password mode in encryptFile/decryptAsset

**Files:** Modify `apps/link/src/storage.ts` (`UploadOpts`, `encryptFile`, `decryptAsset`, the two upload call sites); Test `apps/link/src/storage.test.ts` (append).

- [ ] **Step 1: `UploadOpts` gains `password?: string`** (near line 34):
```ts
  /** Optional password → two-channel mode (link half in fragment + password out-of-band). */
  password?: string
```

- [ ] **Step 2: `encryptFile(file, password?)` → `{ data, payload }`** — keep the metadata envelope + `encryptData`; only derive K + encode payload by mode. Import `deriveArgon2idKey, combineKeyHalves, toBase64Url` from `@alixex/crypto` (alongside existing imports):
```ts
export async function encryptFile(
  file: File,
  password?: string,
): Promise<{ data: Uint8Array; payload: string }> {
  const raw = new Uint8Array(await file.arrayBuffer())
  const meta = new TextEncoder().encode(
    JSON.stringify({ n: file.name, t: file.type || "application/octet-stream" }),
  )
  const plain = new Uint8Array(4 + meta.length + raw.length)
  new DataView(plain.buffer).setUint32(0, meta.length)
  plain.set(meta, 4)
  plain.set(raw, 4 + meta.length)

  let key: Uint8Array
  let payload: string
  if (password) {
    const r = crypto.getRandomValues(new Uint8Array(32))
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const p = await deriveArgon2idKey(password, salt)
    key = await combineKeyHalves(r, p)
    payload = `p1.${toBase64Url(r)}.${toBase64Url(salt)}`
  } else {
    key = crypto.getRandomValues(new Uint8Array(32))
    payload = toBase64(key) // standard base64 — unchanged plain mode
  }
  const { ciphertext, nonce } = await encryptData(plain, key)
  const blob = new Uint8Array(nonce.length + ciphertext.length)
  blob.set(nonce, 0)
  blob.set(ciphertext, nonce.length)
  return { data: blob, payload }
}
```

- [ ] **Step 3: Update the two upload call sites** — both `uploadArweave` and `uploadIrys` currently do `const enc = await encryptFile(file); ...; encKey = enc.keyB64`. Change to `const enc = await encryptFile(file, opts.password); ...; encKey = enc.payload`. (Grep for `encryptFile(file)` — there are exactly two call sites.)

- [ ] **Step 4: `decryptAsset(chain, txId, payload, password?)`** — parse + validate + derive. Import `deriveArgon2idKey, combineKeyHalves, fromBase64Url` too:
```ts
export async function decryptAsset(
  chain: Chain,
  txId: string,
  payload: string,
  password?: string,
): Promise<{ bytes: Uint8Array; fileName: string; contentType: string }> {
  let key: Uint8Array
  const raw = decodeURIComponent(payload)
  if (raw.startsWith("p1.")) {
    const parts = raw.split(".")
    if (parts.length !== 3) throw new Error("MALFORMED_LINK")
    const r = fromBase64Url(parts[1])
    const salt = fromBase64Url(parts[2])
    if (r.length !== 32 || salt.length !== 16) throw new Error("MALFORMED_LINK")
    if (!password) throw new Error("PASSWORD_REQUIRED")
    const p = await deriveArgon2idKey(password, salt)
    key = await combineKeyHalves(r, p)
  } else {
    key = fromBase64(raw) // plain: standard base64, unchanged
  }
  const res = await fetch(`${chainGateway(chain)}/${txId}`)
  if (!res.ok) throw new Error(`fetch ${res.status}`)
  const blob = new Uint8Array(await res.arrayBuffer())
  const nonce = blob.slice(0, NONCE_LEN)
  const ciphertext = blob.slice(NONCE_LEN)
  const decrypted = await decryptData(ciphertext, nonce, key) // wrong pw → throws (Poly1305)
  const metaLen = new DataView(decrypted.buffer, decrypted.byteOffset, 4).getUint32(0)
  const meta = JSON.parse(new TextDecoder().decode(decrypted.subarray(4, 4 + metaLen))) as {
    n?: string
    t?: string
  }
  return {
    bytes: decrypted.subarray(4 + metaLen),
    fileName: meta.n || txId,
    contentType: meta.t || "application/octet-stream",
  }
}
```
Note: validation happens BEFORE the network fetch so a MALFORMED_LINK/PASSWORD_REQUIRED fails fast.

- [ ] **Step 5: Tests** (append to storage.test.ts; mock `fetch`). Cover: plain roundtrip unchanged; password roundtrip recovers bytes+meta (mock fetch to return the `data` from encryptFile); wrong password throws (not MALFORMED); `PASSWORD_REQUIRED` when a `p1.` payload has no password; `MALFORMED_LINK` for bad part-count / wrong R length / wrong salt length. Keep the Argon2id-exercising roundtrip+wrong-pw to 2 tests total. Example skeleton:
```ts
import { encryptFile, decryptAsset } from "./storage"
// helper: stub fetch to return a given Uint8Array body
function stubFetch(body: Uint8Array) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) })))
}
it("password roundtrip recovers bytes + metadata (slow)", async () => {
  const file = new File([new TextEncoder().encode("secret bytes")], "s.txt", { type: "text/plain" })
  const { data, payload } = await encryptFile(file, "hunter2")
  expect(payload.startsWith("p1.")).toBe(true)
  stubFetch(data)
  const out = await decryptAsset("arweave", "TX", payload, "hunter2")
  expect(new TextDecoder().decode(out.bytes)).toBe("secret bytes")
  expect(out.fileName).toBe("s.txt")
}, 20000)
it("wrong password throws, not MALFORMED", async () => {
  const { data, payload } = await encryptFile(new File([new Uint8Array([1,2,3])], "f"), "right")
  stubFetch(data)
  await expect(decryptAsset("arweave", "TX", payload, "wrong")).rejects.toThrow()
}, 20000)
it("PASSWORD_REQUIRED / MALFORMED_LINK", async () => {
  await expect(decryptAsset("arweave", "TX", "p1.AAAA.BBBB")).rejects.toThrow("PASSWORD_REQUIRED")  // no pw
  await expect(decryptAsset("arweave", "TX", "p1.onlytwo", "x")).rejects.toThrow("MALFORMED_LINK")
})
```
(For the MALFORMED length checks, note `p1.AAAA.BBBB` decodes R/salt to <32/<16 bytes → the length guard should also fire; order the checks so PASSWORD_REQUIRED vs MALFORMED match the code path — the code validates length BEFORE the password check, so `p1.AAAA.BBBB` with no password throws MALFORMED first. Adjust the test's expected error to match the actual code order, or feed a validly-sized R/salt for the PASSWORD_REQUIRED case. Make the tests match the implementation's check order exactly.)

- [ ] **Step 6: Verify + commit** — full suite + type-check + build green. Commit `feat(storage): optional password (two-channel) mode for encrypted uploads`.

---

## Task E3: viewer password prompt

**Files:** Modify `apps/link/src/pages/viewer.ts`.

- [ ] **Step 1:** In `renderViewer`, detect password mode: `const raw = decodeURIComponent(payload); const needsPw = raw.startsWith("p1.")`. If `needsPw`, do NOT auto-decrypt — render a password `r-input` + an "Open" button; on submit call `decryptAsset(chain, txId, payload, pw)` and handle the result (download + optional image preview, same as the plain path). If not, keep the current auto-decrypt behavior.
- [ ] **Step 2: Error handling** — map thrown errors to messages: `MALFORMED_LINK` → `t("view.malformed")`; `PASSWORD_REQUIRED` (shouldn't happen once we prompt, but guard) → prompt; a decrypt failure with a password present → `t("view.wrongPassword")` with the input kept for retry; a `crypto_pwhash` memory failure → `t("view.lowMemory")`. Plain-mode decrypt failure keeps the existing generic error.
- [ ] **Step 3: locales** — add `view.password` (field label), `view.open`, `view.wrongPassword`, `view.malformed`, `view.lowMemory` to `en.ts` + `zh-CN.ts`.
- [ ] **Step 4: Verify + commit** — type-check + build; the viewer isn't unit-tested (DOM) — verify by building. Commit `feat(viewer): password prompt for two-channel encrypted links`.

---

## Task E4: upload UI — optional password + security warning

**Files:** Modify `apps/link/src/pages/home.ts`; `apps/link/index.html` (small CSS); locales.

- [ ] **Step 1:** In the file panel (where the `encrypt` checkbox lives), when `encrypt()` is true, reveal an OPTIONAL password `r-input` (placeholder `t("upload.passwordOptional")`) plus a **security warning** block (`t("upload.encWarning")`) and a minimum-length hint (`t("upload.pwHint")`). Store the value in a signal `encPassword`. Empty → plain mode; non-empty → password mode.
- [ ] **Step 2:** In `doUpload`, pass the password: add `password: encPassword() || undefined` to the `UploadOpts` for BOTH the Arweave and Irys upload calls (they already pass `{ onProgress, encrypt: encrypt() }`).
- [ ] **Step 3:** When showing the result for a password-mode upload, add a note (`t("upload.pwReminder")`: "You'll need this password to open it later, too — we can't recover it.").
- [ ] **Step 4: CSS** — a `.enc-warning` block using semantic tokens (muted bg, small text) and layout for the password field; follow existing `.ctl-row`/`.muted` patterns. No non-token colors.
- [ ] **Step 5: locales** — `upload.passwordOptional`, `upload.encWarning`, `upload.pwHint`, `upload.pwReminder` in en + zh.
- [ ] **Step 6: Verify + commit** — type-check + test + build; screenshot the encrypt-on state (headless). Commit `feat(upload): optional two-channel password + security warning`.

---

## Task E5: verification

- [ ] **Step 1:** `pnpm --filter=@alixex/link type-check && pnpm --filter=@alixex/link test && pnpm --filter=@alixex/link build` — all green (incl. crypto tests).
- [ ] **Step 2: backward compat** — construct a plain-mode link (`encryptFile(file)` → `toBase64(K)` payload) and confirm `decryptAsset(chain, txId, payload)` (no password) still decrypts (a test already covers this; re-confirm).
- [ ] **Step 3: e2e (manual/headless)** — upload with a password → open the resulting `#/view/...p1...` link → password prompt appears → correct pw decrypts, wrong pw shows a retryable error. Note the mobile-memory caveat (Argon2id MODERATE ~256 MiB) for a real-device check.
- [ ] **Step 4:** Commit any verification tweaks.

---

## Self-Review
- **Spec coverage:** §2 construction → E1+E2; §3 fragment format + backward compat → E2 (payload encode/parse) + E5 step 2; §4 Argon2id params → E1 (pinned MODERATE); §5 interfaces → E1/E2/E3/E4; §6 owner re-open → E2 (encKey = payload, no K in password mode) + E4 step 3 reminder; §7 warning → E4; §8 security → construction in E1/E2; §10 tests → E1/E2 test steps; §11 sequencing → task order.
- **Type consistency:** `deriveArgon2idKey`, `combineKeyHalves`, `toBase64Url`/`fromBase64Url`, `encryptFile(file, password?) → {data, payload}`, `decryptAsset(chain, txId, payload, password?)`, `UploadOpts.password`, error strings `MALFORMED_LINK`/`PASSWORD_REQUIRED` used consistently.
- **No placeholders:** all steps have concrete code or exact instructions.
