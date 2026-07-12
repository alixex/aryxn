# Two-Channel Encrypted Sharing (Hybrid) — Design

- **Date**: 2026-07-12
- **Status**: Draft (design), pending review
- **Scope**: `@alixex/crypto`, `apps/link` (storage, viewer, upload UI). Independent of the account model.
- **Relation**: extends the existing encrypted-link feature; companion to
  [multi-account-design.md](./2026-07-12-multi-account-design.md). Schedules AFTER the routing/viewer/home
  restructure (multi-account Tasks 8–11), since it edits `pages/viewer.ts` and the home upload UI those create.

---

## 1. Problem & threat model

Encrypted uploads today use a **random 256-bit key placed in the URL fragment** (`#/view/<chain>/<txId>/<Kb64>`).
The fragment is never sent to a server, so gateways/hosts never see the key. Strengths and the gap:

- **Aryxn ciphertexts are publicly listable** — anyone can GraphQL-list `App-Name: Aryxn` transactions and fetch
  any encrypted blob. So confidentiality rests entirely on the key material, which is not in the ciphertext.
- **Plain mode** (random key in fragment): the key is 256-bit → unbreakable. But _possession of the link = access_:
  the key rides in browser history, screenshots, screen-shares, and whatever channel the link is shared through;
  and there is **no revocation/expiry** (permanent storage).

**Goal:** an **optional** password mode where access requires **both** the link **and** an out-of-band password —
neither alone suffices — while keeping the publicly-listable ciphertext safe from mass offline attack. The default
stays plain mode (unchanged).

Why hybrid (not pure password): a pure password-derived key would let _anyone who lists the ciphertext_ run an
unlimited offline brute-force against the password — no link required. The hybrid keeps a 256-bit random half in the
link, so a mass-lister without the link faces 256-bit entropy; only someone who obtains the link can then attempt the
(Argon2id-hardened) password.

---

## 2. Cryptographic construction

The file is encrypted with a 32-byte key `K` using the existing primitive (XChaCha20-Poly1305 `crypto_secretbox`
over the metadata envelope — unchanged; `K` is just derived differently by mode).

**Plain mode (default, unchanged):**

```
K   = random 32 bytes
fragment payload = base64(K)               // STANDARD base64, exactly as today — plain path unchanged
```

**Password mode (new, opt-in):**

```
R    = random 32 bytes                      // the "link half"
salt = random 16 bytes                      // MUST be 16 (crypto_pwhash_SALTBYTES) — libsodium throws otherwise
P    = Argon2id(NFC(password), salt, ALG=Argon2id13, ops=MODERATE, mem=MODERATE) → 32 bytes  // crypto_pwhash
K    = BLAKE2b( R ‖ P, 32 bytes )           // crypto_generichash — secure combiner of both halves
fragment payload = "p1." + base64url(R) + "." + base64url(salt)     // R/salt base64url, no padding
```

- `K` encrypts the file exactly as in plain mode. Password travels **out-of-band** (the sharer tells the recipient
  separately).
- The password is **NFC-normalized** (`password.normalize("NFC")`) before UTF-8 encoding, so a password typed on a
  different keyboard/device (combining marks) derives the same `P` instead of reading as "wrong".
- **Wrong password** → wrong `P` → wrong `K` → Poly1305 authentication fails on decrypt → a single "wrong password"
  error. No decryption oracle beyond pass/fail (secretbox is AEAD — no padding oracle; verify is constant-time).

Why `K = BLAKE2b(R ‖ P)`: both halves are required. Without `R` (the link) a password-holder cannot derive `K`
(`R` is 256-bit). Without the password, a link-holder must brute-force `P` (Argon2id-hardened). `R` and `P` are each
fixed 32 bytes, so the concatenation is unambiguous; BLAKE2b has a finalization step (no length-extension) and is a
standard collision-resistant combiner; `salt` already feeds `P`, so it need not be re-bound. *(Keyed BLAKE2b
`crypto_generichash(32, P, key=R)` is an equivalent, marginally more principled substitute — pin whichever the `p1`
version uses so encoder/decoder agree.)*

---

## 3. Fragment format & backward compatibility

The **viewer stays on the hash route** (`#/view/...`) even after the app moves to history routing — the fragment is
what keeps the key/`R` off the wire. The payload after the last `/` is self-describing:

| Mode             | Payload                                          | Detected by     |
| ---------------- | ------------------------------------------------ | --------------- |
| Plain (existing) | `base64(K)` (standard, as today)                 | no `p1.` prefix |
| Password (new)   | `p1.` + `base64url(R)` + `.` + `base64url(salt)` | leading `p1.`   |

- Plain keeps **standard base64** (unchanged encoder/decoder path); only `R`/`salt` use **base64url without padding**
  (URL-safe). The `.` separator is in neither base64 alphabet nor base64url's, and `encodeURIComponent` leaves it
  untouched, so `p1.` can never collide with a plain key (a 43-char base64 key can start with `p`,`1` but its third
  char is never `.`). The parser asserts the `p1.` split yields exactly 3 parts.
- **Backward compatible**: existing shared plain links (`#/view/<chain>/<txId>/<Kb64>`) are unchanged and still decrypt
  — any payload lacking the `p1.` prefix is decoded as a plain standard-base64 key via the existing `fromBase64` path.
- `p1` is a **version+params tag**: it pins ALG=Argon2id13 + MODERATE limits + 16-byte salt. Changing any of those
  later → `p2` (the viewer selects params by version, so old links stay decryptable).

---

## 4. Argon2id parameters (in-browser)

- `crypto_pwhash` with `crypto_pwhash_ALG_ARGON2ID13`.
- `p1` = `crypto_pwhash_OPSLIMIT_MODERATE` / `crypto_pwhash_MEMLIMIT_MODERATE` (~256 MiB, ~0.5–1 s) — the balance of
  brute-force cost vs. browser memory/UX. Params are fixed by the `p1` version, so encoder and viewer agree without
  storing raw numbers.
- **Memory caveat**: MODERATE needs ~256 MiB; a low-memory mobile browser may throw. The viewer/encoder must catch a
  `crypto_pwhash` failure and surface a clear error ("This device may not have enough memory to process the
  password"). Verified on mobile during implementation; if MODERATE proves unusable on target devices, fall back to a
  documented `p1` = INTERACTIVE (~64 MiB) decision before shipping (single source of truth: the version tag).

---

## 5. Affected components & interfaces

1. **`@alixex/crypto`** — add and export:
   - `deriveArgon2idKey(password: string, salt: Uint8Array): Promise<Uint8Array>` — 32-byte Argon2id13 output at the
     `p1` limits.
   - `combineKeyHalves(r: Uint8Array, p: Uint8Array): Promise<Uint8Array>` — `crypto_generichash(32, concat(r, p))`.
     Order is `r ‖ p` — the tests must assert orientation so encoder/decoder can't silently diverge.
   - `toBase64Url` / `fromBase64Url` helpers (url-safe, **unpadded**) for `R`/`salt`. NOTE: the existing `fromBase64`
     is `atob`-only and **throws on url-safe input** — it must NOT be used for `R`/`salt`. The plain-key path keeps
     using the existing standard `toBase64`/`fromBase64` unchanged.
   - Reuse `initSodium`, `generateSalt`.
2. **`apps/link/src/storage.ts`**:
   - `encryptFile(file, password?)` — when `password` is set, run password mode and return
     `{ data, payload }` where `payload` is the mode-encoded fragment string (plain: `base64url(K)`; password:
     `p1.<R>.<salt>`). The plain path is byte-for-byte unchanged. (Rename the returned `keyB64` to `payload` to reflect
     it now carries mode.) `uploadArweave`/`uploadIrys` pass an optional `password` through `UploadOpts`.
   - `viewerLink(chain, txId, payload)` — unchanged shape; it already just embeds the payload string in
     `#/view/<chain>/<txId>/<payload>`.
   - `decryptAsset(chain, txId, payload, password?)` — parse `payload`: `p1.` prefix → split on `.`; **validate**
     (exactly 3 parts, `R` decodes to 32 bytes, `salt` decodes to 16 bytes) → else throw `MALFORMED_LINK` ("corrupt or
     incomplete link"). Then require `password` (throw `PASSWORD_REQUIRED` if absent) → `P = deriveArgon2idKey(pw, salt)`
     → `K = combineKeyHalves(R, P)`; else plain → `K = fromBase64(payload)`. Then decrypt as today. Distinct error
     mapping is required — **`MALFORMED_LINK` must be kept separate from wrong-password**: a wrong-length `R` would
     otherwise hash to a valid-looking-but-wrong `K` and be reported as "wrong password", trapping the user retyping a
     correct password forever.
3. **`apps/link/src/pages/viewer.ts`** — if the payload is password mode, render a password prompt (`r-input` +
   button) instead of auto-decrypting; on submit call `decryptAsset(..., password)`; wrong password → inline error +
   retry. Plain mode is unchanged (auto-decrypt).
4. **Home upload UI** (`pages/home.ts`, built in multi-account Task 9–11) — when the **Encrypt** toggle is on, reveal
   an **optional** password field: "Add a password — the recipient needs it to open, and you share it separately."
   Empty → plain mode; set → password mode. Show the **security warning** (§7) whenever Encrypt is on. Because a
   leaked-link file's security reduces to password entropy (Argon2id only slows guessing; storage is permanent), show
   a **minimum-length hint / strength indicator** next to the field — that is where the residual risk lives.
5. **`UploadOpts`** gains `password?: string`. The upload flow passes it to `encryptFile`.
6. **locales** (`en.ts` / `zh-CN.ts`) — password field label + hint, the security warning, viewer password prompt,
   wrong-password error, password-required error, low-memory error.

---

## 6. Owner re-open consequence (UX, by design)

`AssetRecord.encKey` (renamed conceptually to the fragment `payload`) is cached locally so the owner can re-open their
own files. In **password mode the payload is `p1.<R>.<salt>` — it does not contain `K`**, so the owner's own "my links"
entry also requires the password to open (two-channel applies to the owner too). This is inherent and correct; the UI
must warn at upload time: "You'll need this password to open the file later, too — we can't recover it." The app must
**never** store the password.

---

## 7. UX copy (security warning)

Shown whenever Encrypt is enabled:

> Anyone with this link can open the file — permanently, and it can't be revoked. The link holds the decryption key,
> so share it only through trusted channels (it also stays in your browser history). Add a password for two-channel
> sharing: the recipient then needs both the link and the password (shared separately).

---

## 8. Security properties

| Attacker has…                         | Result                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Neither link nor password             | Infeasible (256-bit `R` + password).                                                                                                   |
| **Link only** (`R`, salt, ciphertext) | Must brute-force the password — Argon2id-hardened, offline, permanent. Strong password infeasible; weak password eventually crackable. |
| **Password only** (no link)           | Infeasible — lacks the 256-bit `R`.                                                                                                    |
| Mass lister (ciphertext only)         | Infeasible — lacks `R`.                                                                                                                |
| Plain-mode link leaked                | Full access (unchanged from today — that's the mode's tradeoff).                                                                       |

Unchanged limitations: no revocation/expiry (permanent storage); plain mode's "link = access"; the honest residual
that a _weak_ password on a leaked link is brute-forceable over time.

---

## 9. Non-goals (YAGNI)

- No change to plain mode (stays the convenient default).
- No server, no key escrow, no password recovery.
- No coupling to which account uploaded — sharing is independent of the account model.
- No per-file expiry (impossible on permanent storage).

---

## 10. Testing

- **crypto**: Argon2id determinism (same pw+salt → same `P`); `combineKeyHalves` determinism; different password →
  different `K`; base64url round-trip.
- **storage**: password-mode `encryptFile` → `decryptAsset` with the correct password recovers bytes **and** the
  metadata envelope (name/type); wrong password throws a distinct error; missing password on a `p1.` payload throws
  `PASSWORD_REQUIRED`; **plain mode unchanged**; fragment payload round-trips for both modes.
- **backward compat**: an existing plain `#/view/<chain>/<txId>/<standardBase64Key>` still decrypts.
- **viewer** (manual/e2e): password prompt appears only for `p1.` links; wrong password shows a retryable error; low
  memory surfaces the clear error.

---

## 11. Sequencing

Implement as its own small plan **after** multi-account Tasks 8–11 (which create `pages/viewer.ts` and the home upload
UI this feature edits), to avoid working-tree collisions. Order within this feature: (1) `@alixex/crypto` primitives

- tests → (2) `storage.ts` `encryptFile`/`decryptAsset` + tests → (3) viewer password prompt → (4) upload UI +
  warning + locales → (5) verification incl. backward-compat and mobile memory check.
