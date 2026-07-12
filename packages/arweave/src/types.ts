// Arweave JWK key shape. Inlined from the former @alixex/wallet-core so this
// package is self-contained (no multi-chain wallet dependency).
export interface ArweaveJWK {
  kty: string
  e: string
  n: string
  d?: string
  p?: string
  q?: string
  dp?: string
  dq?: string
  qi?: string
  [key: string]: unknown
}
