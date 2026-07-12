// Lightweight browser persistence for aryxn.
// - Small encrypted state (search cache, connection flags) → localStorage + WebCrypto.
// - Lists/records (e.g. "my links" cache) → IndexedDB keyval.
// Chain (Arweave/Irys) remains the source of truth; this is only a local cache.

export { persistEncrypted, loadEncrypted } from "./encrypted-cache"
export { idbGet, idbSet, idbDel, idbKeys, idbValues, idbClear } from "./idb"
