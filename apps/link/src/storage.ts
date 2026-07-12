// Storage abstraction over the two supported permanent chains: Arweave & Irys.
// Both paths write the SAME tag contract so old and new uploads stay queryable
// by the existing `App-Name: Aryxn` scheme (backward compatible with prior users).

import { uploadToArweave } from "@alixex/arweave"

export const APP_NAME = "Aryxn"
export const AR_GATEWAY = "https://arweave.net"
export const AR_GRAPHQL = "https://arweave.net/graphql"

export type Chain = "arweave" | "irys"

export interface AssetRecord {
  txId: string
  fileName: string
  contentType: string
  size: number
  timestamp: number
  chain: Chain
  url: string
}

export interface UploadOpts {
  onProgress?: (p: { stage: string; progress: number }) => void
}

export function gatewayUrl(txId: string): string {
  return `${AR_GATEWAY}/${txId}`
}

/**
 * Upload a file to Arweave via the connected external wallet (Wander/ArConnect).
 * Public, uncompressed, unencrypted — a plain permanent link. Tag contract kept.
 */
export async function uploadArweave(
  file: File,
  ownerAddress: string,
  opts: UploadOpts = {},
): Promise<AssetRecord> {
  const data = new Uint8Array(await file.arrayBuffer())
  const { txId, finalSize } = await uploadToArweave(
    data,
    file.name,
    file.type || "application/octet-stream",
    null, // key: null → use external wallet
    undefined, // no encryption (public link)
    true, // useExternalWallet (ArConnect / Wander)
    false, // no compression
    ownerAddress,
    { "App-Name": APP_NAME },
    opts.onProgress,
  )
  return {
    txId,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    size: finalSize,
    timestamp: Date.now(),
    chain: "arweave",
    url: gatewayUrl(txId),
  }
}

export const IRYS_GATEWAY = "https://gateway.irys.xyz"
export const IRYS_GRAPHQL = "https://uploader.irys.xyz/graphql"

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

  const data = new Uint8Array(await file.arrayBuffer())
  const tags = [
    { name: "App-Name", value: APP_NAME },
    { name: "Content-Type", value: file.type || "application/octet-stream" },
    { name: "File-Name", value: file.name },
  ]
  opts.onProgress?.({ stage: "上传到 Irys…", progress: 60 })
  const receipt = await irys.upload(Buffer.from(data), { tags })
  opts.onProgress?.({ stage: "完成", progress: 100 })

  return {
    txId: receipt.id,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    size: data.length,
    timestamp: Date.now(),
    chain: "irys",
    url: `${IRYS_GATEWAY}/${receipt.id}`,
  }
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
    const tag = (n: string) =>
      node.tags.find((t) => t.name === n)?.value ?? ""
    return {
      txId: node.id,
      fileName: tag("File-Name") || node.id,
      contentType: tag("Content-Type") || "application/octet-stream",
      size: Number(node.data?.size ?? 0),
      timestamp: (node.block?.timestamp ?? 0) * 1000,
      chain: "arweave" as const,
      url: gatewayUrl(node.id),
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
    const tag = (n: string) =>
      node.tags.find((t) => t.name === n)?.value ?? ""
    return {
      txId: node.id,
      fileName: tag("File-Name") || node.id,
      contentType: tag("Content-Type") || "application/octet-stream",
      size: 0,
      timestamp: node.timestamp ?? 0,
      chain: "irys" as const,
      url: `${IRYS_GATEWAY}/${node.id}`,
    }
  })
}
