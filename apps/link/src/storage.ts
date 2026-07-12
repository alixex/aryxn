// Storage abstraction over the two supported permanent chains: Arweave & Irys.
// Both paths write the SAME tag contract so old and new uploads stay queryable
// by the existing `App-Name: Aryxn` scheme (backward compatible with prior users).

import { uploadToArweave, type ArweaveJWK } from "@alixex/arweave"
import { encryptData, decryptData, toBase64, fromBase64 } from "@alixex/crypto"

export const APP_NAME = "Aryxn"
export const AR_GATEWAY = "https://arweave.net"
export const AR_GRAPHQL = "https://arweave.net/graphql"
export const IRYS_GATEWAY = "https://gateway.irys.xyz"
export const IRYS_GRAPHQL = "https://uploader.irys.xyz/graphql"

/** XChaCha20-Poly1305 nonce length (libsodium crypto_secretbox). */
const NONCE_LEN = 24

export type Chain = "arweave" | "irys"

export interface AssetRecord {
  txId: string
  fileName: string
  contentType: string
  size: number
  timestamp: number
  chain: Chain
  url: string
  encrypted?: boolean
  /** Base64 symmetric key, kept locally so the owner can re-open; never on-chain. */
  encKey?: string
  /** The address that uploaded this asset — AR address for arweave, EVM address for irys. */
  owner: string
}

export interface UploadOpts {
  onProgress?: (p: { stage: string; progress: number }) => void
  /** Client-side encrypt before upload (fragment-key model). */
  encrypt?: boolean
}

function chainGateway(chain: Chain): string {
  return chain === "irys" ? IRYS_GATEWAY : AR_GATEWAY
}

export function gatewayUrl(txId: string): string {
  return `${AR_GATEWAY}/${txId}`
}

/**
 * Shareable link carrying the decryption key in the URL fragment — the fragment
 * is never sent to a server, so only holders of the full link can decrypt. Opened
 * by this app's viewer (fetches ciphertext from the gateway, decrypts client-side).
 */
export function viewerLink(chain: Chain, txId: string, keyB64: string): string {
  const base = import.meta.env.BASE_URL || "/"
  return `${location.origin}${base}#/view/${chain}/${txId}/${encodeURIComponent(keyB64)}`
}

/**
 * Encrypt a file into a `nonce || ciphertext` blob. The plaintext is an envelope
 * `[4-byte metaLen][meta JSON][file bytes]`, so the original name/type travel
 * INSIDE the ciphertext — never as public on-chain tags. Only holders of the
 * fragment key can recover them. Returns the blob + a random base64 key.
 * Exported for the roundtrip test.
 */
export async function encryptFile(
  file: File,
): Promise<{ data: Uint8Array; keyB64: string }> {
  const raw = new Uint8Array(await file.arrayBuffer())
  const meta = new TextEncoder().encode(
    JSON.stringify({ n: file.name, t: file.type || "application/octet-stream" }),
  )
  const plain = new Uint8Array(4 + meta.length + raw.length)
  new DataView(plain.buffer).setUint32(0, meta.length) // big-endian meta length
  plain.set(meta, 4)
  plain.set(raw, 4 + meta.length)
  const key = crypto.getRandomValues(new Uint8Array(32))
  const { ciphertext, nonce } = await encryptData(plain, key)
  const blob = new Uint8Array(nonce.length + ciphertext.length)
  blob.set(nonce, 0)
  blob.set(ciphertext, nonce.length)
  return { data: blob, keyB64: toBase64(key) }
}

function makeRecord(
  chain: Chain,
  txId: string,
  file: File,
  size: number,
  owner: string,
  encKey?: string,
): AssetRecord {
  return {
    txId,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    size,
    timestamp: Date.now(),
    chain,
    url: encKey
      ? viewerLink(chain, txId, encKey)
      : `${chainGateway(chain)}/${txId}`,
    encrypted: !!encKey,
    encKey,
    owner,
  }
}

/**
 * Upload a file to Arweave via the connected external wallet (Wander/ArConnect).
 * Public, uncompressed, unencrypted — a plain permanent link. Tag contract kept.
 */
export async function uploadArweave(
  file: File,
  ownerAddress: string,
  opts: UploadOpts = {},
  jwk: ArweaveJWK | null = null,
): Promise<AssetRecord> {
  let data: Uint8Array = new Uint8Array(await file.arrayBuffer())
  let contentType = file.type || "application/octet-stream"
  let encKey: string | undefined
  const tags: Record<string, string> = { "App-Name": APP_NAME }
  if (opts.encrypt) {
    const enc = await encryptFile(file)
    data = enc.data
    encKey = enc.keyB64
    contentType = "application/octet-stream"
    tags["Encrypted"] = "1"
    // Real name/type ride inside the ciphertext (encryptFile), not public tags.
  }
  const { txId, finalSize } = await uploadToArweave(
    data,
    opts.encrypt ? "encrypted" : file.name, // don't leak the real name on-chain
    contentType,
    jwk, // local account JWK, or null → external wallet
    undefined, // encryption done app-side (fragment-key model)
    !jwk, // useExternalWallet only when there's no local key
    false, // no compression
    ownerAddress,
    tags,
    opts.onProgress,
  )
  return makeRecord("arweave", txId, file, finalSize, ownerAddress, encKey)
}

/**
 * Irys path — new Irys L1 via @irys/web-upload, paid with an injected EVM wallet
 * (MetaMask). Same `App-Name: Aryxn` tag contract. The SDK is dynamically
 * imported so it stays out of the main bundle (only loaded on actual Irys use).
 */
export async function uploadIrys(
  file: File,
  opts: UploadOpts = {},
  evmProvider?: unknown,
): Promise<AssetRecord> {
  const eth =
    evmProvider ?? (globalThis as unknown as { ethereum?: unknown }).ethereum
  if (!eth) {
    throw new Error("未检测到 EVM 钱包（如 MetaMask）——Irys 需要它来支付上传")
  }
  opts.onProgress?.({ stage: "连接 Irys…", progress: 20 })

  // Dynamic, version-skew-prone SDK boundary → keep it loosely typed via an
  // `any[]` annotation (a type annotation, not an assertion, so linters keep it).
  const [webUpload, webEthereum, ethersAdapter, ethersLib]: any[] =
    await Promise.all([
      import("@irys/web-upload"),
      import("@irys/web-upload-ethereum"),
      import("@irys/web-upload-ethereum-ethers-v6"),
      import("ethers"),
    ])
  const WebUploader = webUpload.WebUploader
  const WebEthereum = webEthereum.default ?? webEthereum
  const EthersV6Adapter = ethersAdapter.EthersV6Adapter
  const provider = new ethersLib.ethers.BrowserProvider(eth)

  const irys = await WebUploader(WebEthereum).withAdapter(
    EthersV6Adapter(provider),
  )
  const evmAddress: string = await provider
    .getSigner()
    .then((s: any) => s.getAddress())

  let data: Uint8Array = new Uint8Array(await file.arrayBuffer())
  let encKey: string | undefined
  const contentType = file.type || "application/octet-stream"
  const tags = [
    { name: "App-Name", value: APP_NAME },
    {
      name: "Content-Type",
      value: opts.encrypt ? "application/octet-stream" : contentType,
    },
  ]
  if (opts.encrypt) {
    const enc = await encryptFile(file)
    data = enc.data
    encKey = enc.keyB64
    tags.push({ name: "Encrypted", value: "1" })
    // Real name/type ride inside the ciphertext, not public tags.
  } else {
    tags.push({ name: "File-Name", value: file.name })
  }
  opts.onProgress?.({ stage: "上传到 Irys…", progress: 60 })
  const receipt = await irys.upload(Buffer.from(data), { tags })
  opts.onProgress?.({ stage: "完成", progress: 100 })

  return makeRecord("irys", receipt.id, file, data.length, evmAddress, encKey)
}

interface GqlNode {
  id: string
  tags: Array<{ name: string; value: string }>
  data: { size: string }
  block: { timestamp: number } | null
}

/** Options shared by the paginated tag-index queries. */
export interface ListOpts {
  /** Stop once this txId is reached — the high-water mark from a prior sync. */
  until?: string
  /** Per-request page size (gateways cap at 100). */
  pageSize?: number
}

/**
 * Walk a tag-index GraphQL connection page by page (newest-first), mapping each
 * node to an AssetRecord. Stops when the gateway reports no next page, or early
 * when it reaches `opts.until` (the watermark) — so a steady-state sync is ~1
 * request while a cold start paginates the whole history.
 * See docs/resource-index-design.md.
 */
async function graphqlPages<N extends { id: string }>(
  endpoint: string,
  buildBody: (after: string | null) => object,
  toRecord: (node: N) => AssetRecord,
  opts: ListOpts,
): Promise<AssetRecord[]> {
  const out: AssetRecord[] = []
  let after: string | null = null
  for (;;) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(after)),
    })
    if (!res.ok) throw new Error(`GraphQL ${res.status}`)
    const json = await res.json()
    const conn = json?.data?.transactions
    const edges: Array<{ cursor: string; node: N }> = conn?.edges ?? []
    for (const { node } of edges) {
      if (opts.until && node.id === opts.until) return out // hit the watermark
      out.push(toRecord(node))
    }
    if (!conn?.pageInfo?.hasNextPage || edges.length === 0) return out
    after = edges[edges.length - 1].cursor
  }
}

/**
 * List a wallet's Aryxn assets from Arweave (backward compatible: the App-Name
 * tag is exactly how the old app persisted files). Paginates newest-first until
 * exhausted or `opts.until`.
 */
export function listArweaveByOwner(
  address: string,
  opts: ListOpts = {},
): Promise<AssetRecord[]> {
  const n = opts.pageSize ?? 100
  return graphqlPages<GqlNode>(
    AR_GRAPHQL,
    (after) => ({
      query: `query($owner:[String!]!,$app:[String!]!,$n:Int!,$after:String){
        transactions(owners:$owner, tags:[{name:"App-Name", values:$app}], first:$n, sort:HEIGHT_DESC, after:$after){
          pageInfo{ hasNextPage }
          edges{ cursor node{ id tags{ name value } data{ size } block{ timestamp } } }
        }
      }`,
      variables: { owner: [address], app: [APP_NAME], n, after },
    }),
    (node) => {
      const tag = (k: string) =>
        node.tags.find((t) => t.name === k)?.value ?? ""
      return {
        txId: node.id,
        fileName: tag("File-Name") || node.id,
        contentType: tag("Content-Type") || "application/octet-stream",
        size: Number(node.data?.size ?? 0),
        timestamp: (node.block?.timestamp ?? 0) * 1000,
        chain: "arweave" as const,
        url: gatewayUrl(node.id),
        encrypted: tag("Encrypted") === "1",
        owner: address,
      }
    },
    opts,
  )
}

interface IrysNode {
  id: string
  timestamp: number | null
  tags: Array<{ name: string; value: string }>
}

/**
 * List a wallet's Aryxn assets from Irys (by the paying EVM address). Same tag
 * contract; Irys `timestamp` is already ms. `order:DESC` gives newest-first so
 * the watermark stop is correct.
 */
export function listIrysByOwner(
  address: string,
  opts: ListOpts = {},
): Promise<AssetRecord[]> {
  const n = opts.pageSize ?? 100
  return graphqlPages<IrysNode>(
    IRYS_GRAPHQL,
    (after) => ({
      query: `query($owner:[String!]!,$app:[String!]!,$n:Int!,$after:String){
        transactions(owners:$owner, tags:[{name:"App-Name", values:$app}], first:$n, order:DESC, after:$after){
          pageInfo{ hasNextPage }
          edges{ cursor node{ id timestamp tags{ name value } } }
        }
      }`,
      variables: { owner: [address], app: [APP_NAME], n, after },
    }),
    (node) => {
      const tag = (k: string) =>
        node.tags.find((t) => t.name === k)?.value ?? ""
      return {
        txId: node.id,
        fileName: tag("File-Name") || node.id,
        contentType: tag("Content-Type") || "application/octet-stream",
        size: 0,
        timestamp: node.timestamp ?? 0,
        chain: "irys" as const,
        url: `${IRYS_GATEWAY}/${node.id}`,
        encrypted: tag("Encrypted") === "1",
        owner: address,
      }
    },
    opts,
  )
}

/**
 * Fetch an encrypted asset's ciphertext and decrypt it with the fragment key.
 * The name/type come from the decrypted envelope (see encryptFile) — no public
 * metadata lookup, so nothing about the file leaks on-chain.
 */
export async function decryptAsset(
  chain: Chain,
  txId: string,
  keyB64: string,
): Promise<{ bytes: Uint8Array; fileName: string; contentType: string }> {
  const res = await fetch(`${chainGateway(chain)}/${txId}`)
  if (!res.ok) throw new Error(`fetch ${res.status}`)
  const blob = new Uint8Array(await res.arrayBuffer())
  const nonce = blob.slice(0, NONCE_LEN)
  const ciphertext = blob.slice(NONCE_LEN)
  const key = fromBase64(decodeURIComponent(keyB64))
  const plain = await decryptData(ciphertext, nonce, key)
  // Envelope: [4-byte metaLen][meta JSON][file bytes] — see encryptFile.
  const metaLen = new DataView(plain.buffer, plain.byteOffset, 4).getUint32(0)
  const meta = JSON.parse(
    new TextDecoder().decode(plain.subarray(4, 4 + metaLen)),
  ) as { n?: string; t?: string }
  return {
    bytes: plain.subarray(4 + metaLen),
    fileName: meta.n || txId,
    contentType: meta.t || "application/octet-stream",
  }
}
