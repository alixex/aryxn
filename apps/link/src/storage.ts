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

/** Encrypt a file → `nonce || ciphertext` blob + a random base64 key. */
async function encryptFile(
  file: File,
): Promise<{ data: Uint8Array; keyB64: string }> {
  const raw = new Uint8Array(await file.arrayBuffer())
  const key = crypto.getRandomValues(new Uint8Array(32))
  const { ciphertext, nonce } = await encryptData(raw, key)
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
    tags["File-Type"] = file.type || "application/octet-stream"
  }
  const { txId, finalSize } = await uploadToArweave(
    data,
    file.name,
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
    { name: "Content-Type", value: contentType },
    { name: "File-Name", value: file.name },
  ]
  if (opts.encrypt) {
    const enc = await encryptFile(file)
    data = enc.data
    encKey = enc.keyB64
    tags[1] = { name: "Content-Type", value: "application/octet-stream" }
    tags.push(
      { name: "Encrypted", value: "1" },
      { name: "File-Type", value: contentType },
    )
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

/**
 * List a wallet's previously uploaded Aryxn assets from Arweave (backward
 * compatible: this is exactly how the old app persisted files — App-Name tag).
 */
export async function listArweaveByOwner(
  address: string,
  limit = 100,
): Promise<AssetRecord[]> {
  const query = {
    query: `query($owner:[String!]!,$app:[String!]!,$n:Int!){
      transactions(owners:$owner, tags:[{name:"App-Name", values:$app}], first:$n, sort:HEIGHT_DESC){
        edges{ node{ id tags{ name value } data{ size } block{ timestamp } } }
      }
    }`,
    variables: { owner: [address], app: [APP_NAME], n: limit },
  }
  const res = await fetch(AR_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  })
  if (!res.ok) throw new Error(`Arweave GraphQL ${res.status}`)
  const json = await res.json()
  const edges: Array<{ node: GqlNode }> = json?.data?.transactions?.edges ?? []
  return edges.map(({ node }) => {
    const tag = (n: string) => node.tags.find((t) => t.name === n)?.value ?? ""
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
  })
}

interface IrysNode {
  id: string
  timestamp: number | null
  tags: Array<{ name: string; value: string }>
}

/**
 * List a wallet's previously uploaded Aryxn assets from Irys (by the paying EVM
 * address). Same tag contract; Irys `timestamp` is already in milliseconds.
 */
export async function listIrysByOwner(
  address: string,
  limit = 100,
): Promise<AssetRecord[]> {
  const query = {
    query: `query($owner:[String!]!,$app:[String!]!,$n:Int!){
      transactions(owners:$owner, tags:[{name:"App-Name", values:$app}], first:$n){
        edges{ node{ id timestamp tags{ name value } } }
      }
    }`,
    variables: { owner: [address], app: [APP_NAME], n: limit },
  }
  const res = await fetch(IRYS_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  })
  if (!res.ok) throw new Error(`Irys GraphQL ${res.status}`)
  const json = await res.json()
  const edges: Array<{ node: IrysNode }> = json?.data?.transactions?.edges ?? []
  return edges.map(({ node }) => {
    const tag = (n: string) => node.tags.find((t) => t.name === n)?.value ?? ""
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
  })
}

/** Best-effort fetch of File-Name / original File-Type tags (for download naming). */
async function fetchAssetMeta(
  chain: Chain,
  txId: string,
): Promise<{ fileName: string; contentType: string }> {
  const isIrys = chain === "irys"
  const query = isIrys
    ? {
        query: `query($id:[String!]!){ transactions(ids:$id, first:1){ edges{ node{ tags{ name value } } } } }`,
        variables: { id: [txId] },
      }
    : {
        query: `query($id:ID!){ transaction(id:$id){ tags{ name value } } }`,
        variables: { id: txId },
      }
  try {
    const res = await fetch(isIrys ? IRYS_GRAPHQL : AR_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    })
    const json = await res.json()
    const tags: Array<{ name: string; value: string }> = isIrys
      ? (json?.data?.transactions?.edges?.[0]?.node?.tags ?? [])
      : (json?.data?.transaction?.tags ?? [])
    const tag = (n: string) => tags.find((t) => t.name === n)?.value ?? ""
    return {
      fileName: tag("File-Name") || txId,
      contentType: tag("File-Type") || "application/octet-stream",
    }
  } catch {
    return { fileName: txId, contentType: "application/octet-stream" }
  }
}

/** Fetch an encrypted asset's ciphertext and decrypt it with the fragment key. */
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
  const bytes = await decryptData(ciphertext, nonce, key)
  const meta = await fetchAssetMeta(chain, txId)
  return { bytes, ...meta }
}
