import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { getFileByOwnerAndTxId, syncFileByTxIdFromArweave } from "@/lib/file"
import type { FileIndex } from "@/lib/file"
import {
  getCachedResource,
  getCachedResourceFile,
  upsertCachedResource,
} from "@/lib/file"
import { RPCs } from "@aryxn/chain-constants"
import { deriveKey } from "@aryxn/crypto"
import type { UploadRecord } from "@/lib/utils"
import { useWallet } from "@/hooks/account-hooks"
import { db } from "@/lib/database"
import { getDownloadGateways } from "@/lib/storage/gateways"
import { getTransactionMetadata } from "@/components/history-table/download-data"
import {
  decodeTransactionTags,
  type DecodedTag,
} from "@/components/history-table/transaction-tags"
import { processFileData } from "@/components/history-table/process-data"
import { decodeAuthParam } from "@/lib/resource-auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Download, Eye, EyeOff, Lock } from "lucide-react"

// ─── Inline preview ───────────────────────────────────────────────────────────

function InlinePreview({
  payload,
  mimeType,
  fileName,
}: {
  payload: Uint8Array
  mimeType: string
  fileName: string
}) {
  const url = useMemo(() => {
    const blob = new Blob([payload.buffer.slice(0) as BlobPart], {
      type: mimeType || "application/octet-stream",
    })
    return URL.createObjectURL(blob)
  }, [payload, mimeType])

  const urlRef = useRef(url)
  urlRef.current = url
  useEffect(() => {
    return () => URL.revokeObjectURL(urlRef.current)
  }, [url])

  const handleDownload = () => {
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const type = mimeType?.split(";")[0].trim() ?? ""

  return (
    <main className="mesh-gradient relative min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <p
            className="text-foreground truncate text-sm font-semibold"
            title={fileName}
          >
            {fileName}
          </p>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download
          </Button>
        </div>

        <div className="border-border/70 bg-card/80 overflow-hidden rounded-xl border shadow">
          {type.startsWith("image/") ? (
            <img
              src={url}
              alt={fileName}
              className="mx-auto block max-h-[80vh] max-w-full object-contain"
            />
          ) : type.startsWith("video/") ? (
            <video
              src={url}
              controls
              className="mx-auto block max-h-[80vh] w-full"
            />
          ) : type.startsWith("audio/") ? (
            <div className="flex items-center justify-center p-10">
              <audio src={url} controls className="w-full max-w-md" />
            </div>
          ) : type === "application/pdf" ? (
            <iframe
              src={url}
              title={fileName}
              className="h-[85vh] w-full border-0"
            />
          ) : type.startsWith("text/") ? (
            <iframe
              src={url}
              title={fileName}
              className="h-[80vh] w-full border-0"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <p className="text-muted-foreground text-sm">
                Preview not available for this file type.
              </p>
              <Button onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download {fileName}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

type LoadState =
  | { status: "loading" }
  | { status: "found"; file: FileIndex; source: "local" | "chain" }
  | { status: "missing"; reason?: string }

type DecryptStage =
  | "idle"
  | "verifying"
  | "verified"
  | "metadata"
  | "downloading"
  | "decrypting"
  | "opening"

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

async function downloadEncryptedData(
  txId: string,
  storageType: string,
  expectedSize: number,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<Uint8Array> {
  const gateways = getDownloadGateways(storageType)

  let lastError: unknown = null

  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}/${txId}`, {
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error(`Gateway ${gateway} failed: ${response.status}`)
      }

      const headerSize = response.headers.get("content-length")
      const fallbackTotal = headerSize ? Number(headerSize) : null
      const total = expectedSize > 0 ? expectedSize : fallbackTotal

      let data: Uint8Array
      if (response.body) {
        const reader = response.body.getReader()
        const chunks: Uint8Array[] = []
        let loaded = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value || value.length === 0) continue

          const safeChunk = new Uint8Array(value.length)
          safeChunk.set(value)
          chunks.push(safeChunk)
          loaded += safeChunk.length
          onProgress?.(loaded, total)
        }

        data = concatChunks(chunks, loaded)
      } else {
        data = new Uint8Array(await response.arrayBuffer())
        onProgress?.(data.length, total)
      }

      if (expectedSize > 0 && data.length !== expectedSize) {
        throw new Error(
          `Incomplete data from ${gateway}: expected ${expectedSize}, got ${data.length}`,
        )
      }

      return data
    } catch (error) {
      lastError = error
    }
  }

  throw (
    lastError ||
    new Error("Failed to download encrypted resource from gateways")
  )
}

async function getVaultIdFromKey(key: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(key))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16)
}

function classifyDecryptError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes("incorrect password") ||
    lower.includes("wrong password") ||
    lower.includes("decryption failed")
  ) {
    return "Password verification failed"
  }

  if (
    lower.includes("timeout") ||
    lower.includes("gateway") ||
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("abort")
  ) {
    return "Network issue"
  }

  if (
    lower.includes("nonce") ||
    lower.includes("incomplete") ||
    lower.includes("corrupted") ||
    lower.includes("metadata")
  ) {
    return "Resource data issue"
  }

  return "Unknown issue"
}

function classifyDecryptErrorByStage(
  message: string,
  stage: DecryptStage,
  passwordVerified: boolean,
): string {
  if (
    stage === "verifying" ||
    message.toLowerCase().includes("incorrect password")
  ) {
    return "Password verification failed"
  }

  if (passwordVerified && message.toLowerCase().includes("decryption failed")) {
    return "Resource data issue"
  }

  return classifyDecryptError(message)
}

export default function ResourceByOwnerTx() {
  const { ownerAddress = "", txId = "" } = useParams()
  const [searchParams] = useSearchParams()
  const authParam = searchParams.get("auth")

  const wallet = useWallet()
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [password, setPassword] = useState("")
  const [decrypting, setDecrypting] = useState(false)
  const [decryptError, setDecryptError] = useState<string | null>(null)
  const [decryptStatus, setDecryptStatus] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [decryptStage, setDecryptStage] = useState<DecryptStage>("idle")
  const [errorCategory, setErrorCategory] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<{
    loaded: number
    total: number | null
  }>({ loaded: 0, total: null })
  const [previewPayload, setPreviewPayload] = useState<{
    data: Uint8Array
    mimeType: string
    fileName: string
  } | null>(null)

  const normalized = useMemo(
    () => ({
      ownerAddress: ownerAddress.trim(),
      txId: txId.trim(),
    }),
    [ownerAddress, txId],
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!normalized.ownerAddress || !normalized.txId) {
        if (!cancelled) {
          setState({ status: "missing" })
        }
        return
      }

      setState({ status: "loading" })

      try {
        // 1) 本地 DB 优先
        const local = await getFileByOwnerAndTxId(
          normalized.ownerAddress,
          normalized.txId,
        )
        if (local) {
          if (!cancelled) {
            setState({ status: "found", file: local, source: "local" })
          }
          return
        }

        // 2) 本地无数据，链上回源并写入本地永久缓存
        const fromChain = await syncFileByTxIdFromArweave(
          normalized.ownerAddress,
          normalized.txId,
        )
        if (fromChain) {
          if (!cancelled) {
            setState({ status: "found", file: fromChain, source: "chain" })
          }
          return
        }

        // 3) 本地和链上都无，展示兜底
        if (!cancelled) {
          setState({ status: "missing" })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "missing",
            reason: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [normalized.ownerAddress, normalized.txId])

  useEffect(() => {
    if (state.status !== "found" || state.file.encryption_algo !== "none") {
      return
    }

    let cancelled = false

    const openPlainResource = async () => {
      try {
        const cachedFile = await getCachedResourceFile(
          state.file.owner_address,
          state.file.tx_id,
        )

        if (cancelled) return

        let payload: Uint8Array
        if (cachedFile) {
          payload = new Uint8Array(await cachedFile.arrayBuffer())
        } else {
          const downloaded = await downloadEncryptedData(
            state.file.tx_id,
            state.file.storage_type,
            Number(state.file.file_size || 0),
          )

          if (cancelled) return

          await upsertCachedResource({
            ownerAddress: state.file.owner_address,
            txId: state.file.tx_id,
            mimeType: state.file.mime_type,
            storageType: state.file.storage_type,
            isEncrypted: false,
            payload: downloaded,
          })
          payload = downloaded
        }

        if (cancelled) return

        setPreviewPayload({
          data: payload,
          mimeType: state.file.mime_type || "application/octet-stream",
          fileName: state.file.file_name,
        })
      } catch (error) {
        console.error("Failed to open uncached resource locally:", error)
        const target = `${RPCs.ARWEAVE_BASE}/${state.file.tx_id}`
        if (typeof window !== "undefined" && window.location.href !== target) {
          window.location.replace(target)
        }
      }
    }

    void openPlainResource()

    return () => {
      cancelled = true
    }
  }, [state])

  const handleDecryptAndOpen = async (
    file: FileIndex,
    precomputedKey?: Uint8Array,
  ) => {
    // If a key was provided (e.g. from auth param), skip password entry
    if (!precomputedKey) {
      if (!password.trim()) {
        setDecryptError("Password is required.")
        return
      }

      if (!wallet.internal.systemSalt) {
        setDecryptError(
          "Vault is still initializing. Please retry in a moment.",
        )
        return
      }
    }

    setDecrypting(true)
    setDecryptError(null)
    setErrorCategory(null)
    setDownloadProgress({ loaded: 0, total: null })
    setDecryptStage("verifying")
    setDecryptStatus("Validating password...")
    let currentStage: DecryptStage = "verifying"
    let passwordVerified = false

    try {
      const salt = wallet.internal.systemSalt
      const key = precomputedKey ?? (await deriveKey(password, salt!))

      // Stage 1: password verification gate (skip when key is precomputed from auth).
      if (!precomputedKey && wallet.internal.vaultId) {
        const derivedVaultId = await getVaultIdFromKey(key)
        if (derivedVaultId !== wallet.internal.vaultId) {
          throw new Error("Incorrect password")
        }
      }
      passwordVerified = true
      setDecryptStage("verified")
      currentStage = "verified"
      setDecryptStatus("Password verified. Entering next stage...")

      const record: UploadRecord = {
        id: undefined,
        txId: file.tx_id,
        fileName: file.file_name,
        fileHash: file.file_hash,
        fileSize: Number(file.file_size),
        mimeType: file.mime_type,
        storageType: file.storage_type as "arweave",
        ownerAddress: file.owner_address,
        encryptionAlgo: file.encryption_algo,
        encryptionParams: file.encryption_params,
        createdAt: Number(file.created_at),
      }

      setDecryptStage("metadata")
      currentStage = "metadata"
      setDecryptStatus("Loading local metadata...")
      const expectedDataSize = Number(file.file_size || 0)
      let decodedTags: DecodedTag[] = []

      const hydrateTagsForNonceRepair = async () => {
        if (decodedTags.length > 0) return

        const { transaction } = await getTransactionMetadata(file.tx_id)
        const hydrated = decodeTransactionTags((transaction as any)?.tags)
        decodedTags = hydrated

        const encryptionParamsTag = hydrated.find(
          (tag) => tag.name === "Encryption-Params" && tag.value,
        )

        if (!encryptionParamsTag) return

        // Write back repaired metadata so future opens stay local-first.
        await db.run(
          `UPDATE file_indexes
           SET encryption_params = ?, updated_at = ?
           WHERE tx_id = ? AND owner_address = ?`,
          [
            encryptionParamsTag.value,
            Date.now(),
            file.tx_id,
            file.owner_address,
          ],
        )
      }

      const decryptPayload = async (
        payload: Uint8Array,
      ): Promise<Uint8Array> => {
        const zeroKey = new Uint8Array(32)

        const tryDecryptWithKey = async (
          candidateKey: Uint8Array,
        ): Promise<Uint8Array | null> => {
          try {
            return await processFileData(
              payload,
              record,
              decodedTags,
              candidateKey,
              true,
            )
          } catch {
            return null
          }
        }

        setDecryptStage("decrypting")
        currentStage = "decrypting"
        setDecryptStatus("Decrypting resource...")

        // 1) Local metadata + primary key
        const primaryLocal = await tryDecryptWithKey(key)
        if (primaryLocal) {
          return primaryLocal
        }

        // 2) Local metadata + legacy zero key
        setDecryptStatus("Primary key failed. Checking legacy key format...")
        const legacyLocal = await tryDecryptWithKey(zeroKey)
        if (legacyLocal) {
          return legacyLocal
        }

        // 3) Chain metadata + primary/legacy key (on-demand self-healing)
        setDecryptStage("metadata")
        currentStage = "metadata"
        setDecryptStatus("Verifying encryption metadata from chain...")
        await hydrateTagsForNonceRepair()

        setDecryptStage("decrypting")
        currentStage = "decrypting"
        setDecryptStatus("Retrying with verified metadata...")

        const primaryChain = await tryDecryptWithKey(key)
        if (primaryChain) {
          return primaryChain
        }

        const legacyChain = await tryDecryptWithKey(zeroKey)
        if (legacyChain) {
          return legacyChain
        }

        throw new Error(
          "Password verified, but no supported key/metadata combination could decrypt this resource.",
        )
      }

      setDecryptStage("downloading")
      currentStage = "downloading"
      setDecryptStatus("Checking local cache...")

      const localCached = await getCachedResource(
        file.owner_address,
        file.tx_id,
      )
      let encryptedData: Uint8Array | null =
        localCached?.isEncrypted === true ? localCached.payload : null
      let loadedFromCache = encryptedData !== null

      if (!encryptedData) {
        setDecryptStage("downloading")
        currentStage = "downloading"
        setDecryptStatus("Downloading encrypted resource...")
        encryptedData = await downloadEncryptedData(
          file.tx_id,
          file.storage_type,
          expectedDataSize,
          (loaded, total) => {
            setDownloadProgress({ loaded, total })
          },
        )

        await upsertCachedResource({
          ownerAddress: file.owner_address,
          txId: file.tx_id,
          mimeType: file.mime_type,
          storageType: file.storage_type,
          isEncrypted: true,
          payload: encryptedData,
        })
      }

      let decrypted: Uint8Array

      // Fast path: reuse file decrypt pipeline with tag-first parameters.
      try {
        decrypted = await decryptPayload(encryptedData)
      } catch {
        if (loadedFromCache) {
          setDecryptStatus("Cached data failed. Retrying from chain...")
          const redownloaded = await downloadEncryptedData(
            file.tx_id,
            file.storage_type,
            expectedDataSize,
            (loaded, total) => {
              setDownloadProgress({ loaded, total })
            },
          )

          await upsertCachedResource({
            ownerAddress: file.owner_address,
            txId: file.tx_id,
            mimeType: file.mime_type,
            storageType: file.storage_type,
            isEncrypted: true,
            payload: redownloaded,
          })

          try {
            decrypted = await decryptPayload(redownloaded)
          } catch {
            throw new Error(
              "Password verified, but resource payload/metadata mismatch prevented decryption.",
            )
          }
        } else {
          throw new Error(
            "Password verified, but resource payload/metadata mismatch prevented decryption.",
          )
        }
      }

      setDecryptStage("opening")
      currentStage = "opening"
      setDecryptStatus("Opening preview...")
      setPreviewPayload({
        data: decrypted,
        mimeType: file.mime_type || "application/octet-stream",
        fileName: file.file_name,
      })
    } catch (error) {
      let message =
        error instanceof Error
          ? error.message
          : "Failed to decrypt resource. Check password."
      const category = classifyDecryptErrorByStage(
        message,
        currentStage,
        passwordVerified,
      )

      if (
        category === "Resource data issue" &&
        message.toLowerCase().includes("decryption failed")
      ) {
        message =
          "Password verified, but resource decryption still failed. The cached or remote encrypted payload may be inconsistent with encryption metadata."
      }

      setDecryptError(message)
      setErrorCategory(category)
      setDecryptStage("idle")
      setDecryptStatus(null)
    } finally {
      setDecrypting(false)
    }
  }

  // ── Auth-param auto-decrypt ─────────────────────────────────────────────────

  useEffect(() => {
    if (
      !authParam ||
      state.status !== "found" ||
      state.file.encryption_algo === "none"
    )
      return

    let cancelled = false

    const openWithAuth = async () => {
      try {
        const key = await decodeAuthParam(authParam, normalized.txId)
        if (cancelled) return
        await handleDecryptAndOpen(state.file, key)
      } catch (error) {
        if (cancelled) return
        console.warn("Auth param failed:", error)
        setDecryptError(
          "The access link could not be verified. Please enter the password manually.",
        )
        setErrorCategory("Auth failed")
      }
    }

    void openWithAuth()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authParam, state, normalized.txId])

  if (previewPayload) {
    return (
      <InlinePreview
        payload={previewPayload.data}
        mimeType={previewPayload.mimeType}
        fileName={previewPayload.fileName}
      />
    )
  }

  if (state.status === "found") {
    if (state.file.encryption_algo === "none") {
      return (
        <main className="mesh-gradient relative flex min-h-screen items-center justify-center p-4">
          <p className="text-muted-foreground text-sm">Loading preview...</p>
        </main>
      )
    }

    const autoAuthPending = !!authParam && decrypting

    return (
      <main className="mesh-gradient relative min-h-screen px-4 py-8">
        <div className="mx-auto mt-[8vh] w-full max-w-md">
          <Card className="border-border/70 bg-card/92 overflow-hidden shadow-lg">
            <div className="bg-primary h-1.5 w-full" />
            <CardHeader className="pt-7 text-center">
              <div className="bg-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                <Lock className="text-foreground h-5 w-5" />
              </div>
              <CardTitle className="text-xl">Encrypted Resource</CardTitle>
              <CardDescription>
                {autoAuthPending
                  ? "Verifying access link..."
                  : "Enter password to verify and preview this resource."}
              </CardDescription>
            </CardHeader>
            {autoAuthPending && (
              <CardContent className="pb-6">
                <div className="space-y-3">
                  {decryptStage === "downloading" && (
                    <div className="space-y-2">
                      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full transition-all duration-200"
                          style={{
                            width:
                              downloadProgress.total &&
                              downloadProgress.total > 0
                                ? `${Math.min(100, (downloadProgress.loaded / downloadProgress.total) * 100)}%`
                                : "35%",
                          }}
                        />
                      </div>
                      <p className="text-muted-foreground text-center text-xs">
                        {downloadProgress.total && downloadProgress.total > 0
                          ? `${((downloadProgress.loaded / downloadProgress.total) * 100).toFixed(1)}%`
                          : "Downloading..."}
                      </p>
                    </div>
                  )}
                  {decryptStatus ? (
                    <p className="text-muted-foreground text-center text-sm">
                      {decryptStatus}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            )}
            {!autoAuthPending && (
              <CardContent className="pb-6">
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleDecryptAndOpen(state.file)
                  }}
                >
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoFocus
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password"
                      className="h-11 pr-11"
                      disabled={decrypting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      disabled={decrypting}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full"
                    disabled={decrypting}
                  >
                    {decrypting ? "Decrypting..." : "View Resource"}
                  </Button>

                  {decryptStatus ? (
                    <p className="text-muted-foreground text-xs">
                      {decryptStatus}
                    </p>
                  ) : null}
                  {decrypting ? (
                    <p className="text-muted-foreground text-xs">
                      Stage: {decryptStage}
                    </p>
                  ) : null}
                  {decryptStage === "downloading" ? (
                    <div className="space-y-2">
                      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full transition-all duration-200"
                          style={{
                            width:
                              downloadProgress.total &&
                              downloadProgress.total > 0
                                ? `${Math.min(100, (downloadProgress.loaded / downloadProgress.total) * 100)}%`
                                : "35%",
                          }}
                        />
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {downloadProgress.total && downloadProgress.total > 0
                          ? `${((downloadProgress.loaded / downloadProgress.total) * 100).toFixed(1)}% (${downloadProgress.loaded.toLocaleString()}/${downloadProgress.total.toLocaleString()} bytes)`
                          : `${downloadProgress.loaded.toLocaleString()} bytes downloaded`}
                      </p>
                    </div>
                  ) : null}
                  {decryptError ? (
                    <div className="space-y-1">
                      {errorCategory ? (
                        <p className="text-xs text-red-700">
                          Category: {errorCategory}
                        </p>
                      ) : null}
                      <p className="text-xs text-red-600">{decryptError}</p>
                    </div>
                  ) : null}
                </form>
              </CardContent>
            )}
          </Card>
        </div>
      </main>
    )
  }

  if (state.status === "loading") {
    return (
      <main className="mesh-gradient relative flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Loading resource...</p>
      </main>
    )
  }

  return (
    <main className="p-4 text-sm text-neutral-700">
      Resource not found.
      {state.status === "missing" && state.reason ? ` ${state.reason}` : ""}
    </main>
  )
}
