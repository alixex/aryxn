import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { getFileByOwnerAndTxId, syncFileByTxIdFromArweave } from "@/lib/file"
import type { FileIndex } from "@/lib/file"
import { getCachedResource, upsertCachedResource } from "@/lib/file"
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
import { GlobalDownloadBar } from "@/components/layout/GlobalDownloadBar"
import { useDownloadTaskStore } from "@/lib/store/download-task"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CheckCircle, Download, Eye, EyeOff, Lock } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadState =
  | { status: "loading" }
  | { status: "found"; file: FileIndex; source: "local" | "chain" }
  | { status: "missing"; reason?: string }

type DownloadStage =
  | "idle"
  | "verifying"
  | "verified"
  | "metadata"
  | "downloading"
  | "decrypting"
  | "saving"
  | "done"

const GATEWAY_TIMEOUT_MS = 10000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

async function downloadRawData(
  txId: string,
  storageType: string,
  expectedSize: number,
  onProgress?: (loaded: number, total: number | null) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const gateways = getDownloadGateways(storageType)
  let lastError: unknown = null

  for (const gateway of gateways) {
    const gatewayController = new AbortController()
    const abortFromParent = () => gatewayController.abort()
    signal?.addEventListener("abort", abortFromParent, { once: true })

    try {
      const response = await fetch(`${gateway}/${txId}`, {
        cache: "no-store",
        signal: gatewayController.signal,
      })
      if (!response.ok)
        throw new Error(`Gateway ${gateway} failed: ${response.status}`)

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
          const safe = new Uint8Array(value.length)
          safe.set(value)
          chunks.push(safe)
          loaded += safe.length
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
    } finally {
      signal?.removeEventListener("abort", abortFromParent)
    }
  }

  throw lastError || new Error("Failed to download resource from gateways")
}

async function getVaultIdFromKey(key: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(key))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16)
}

function triggerFileSave(data: Uint8Array, mimeType: string, fileName: string) {
  const blob = new Blob([data.buffer.slice(0) as BlobPart], {
    type: mimeType || "application/octet-stream",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  loaded,
  total,
}: {
  loaded: number
  total: number | null
}) {
  const pct = total && total > 0 ? Math.min(100, (loaded / total) * 100) : null

  return (
    <div className="space-y-1.5">
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-150"
          style={{ width: pct != null ? `${pct}%` : "40%" }}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {pct != null
          ? `${pct.toFixed(1)}% — ${loaded.toLocaleString()} / ${total!.toLocaleString()} bytes`
          : `${loaded.toLocaleString()} bytes downloaded`}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DownloadPage() {
  const { ownerAddress = "", txId = "" } = useParams()
  const [searchParams] = useSearchParams()
  const authParam = searchParams.get("auth")

  const wallet = useWallet()
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [stage, setStage] = useState<DownloadStage>("idle")
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<{
    loaded: number
    total: number | null
  }>({ loaded: 0, total: null })
  const startTask = useDownloadTaskStore((s) => s.startTask)
  const updateProgress = useDownloadTaskStore((s) => s.updateProgress)
  const setTaskStatus = useDownloadTaskStore((s) => s.setStatus)
  const finishTask = useDownloadTaskStore((s) => s.finishTask)

  const normalized = useMemo(
    () => ({ ownerAddress: ownerAddress.trim(), txId: txId.trim() }),
    [ownerAddress, txId],
  )

  // ── Load file metadata ─────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!normalized.ownerAddress || !normalized.txId) {
        if (!cancelled) setState({ status: "missing" })
        return
      }
      setState({ status: "loading" })
      try {
        const local = await getFileByOwnerAndTxId(
          normalized.ownerAddress,
          normalized.txId,
        )
        if (local) {
          if (!cancelled)
            setState({ status: "found", file: local, source: "local" })
          return
        }
        const fromChain = await syncFileByTxIdFromArweave(
          normalized.ownerAddress,
          normalized.txId,
        )
        if (fromChain) {
          if (!cancelled)
            setState({ status: "found", file: fromChain, source: "chain" })
          return
        }
        if (!cancelled) setState({ status: "missing" })
      } catch (err) {
        if (!cancelled)
          setState({
            status: "missing",
            reason: err instanceof Error ? err.message : String(err),
          })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [normalized.ownerAddress, normalized.txId])

  // ── Core download pipeline ─────────────────────────────────────────────────

  const runDownload = async (file: FileIndex, key?: Uint8Array) => {
    const controller = new AbortController()

    setStage("verifying")
    setStatusMsg("Preparing download…")
    setError(null)
    setDownloadProgress({ loaded: 0, total: null })

    let currentStage: DownloadStage = "verifying"

    try {
      const isEncrypted = file.encryption_algo !== "none"

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

      setStage("verified")
      currentStage = "verified"

      const expectedDataSize = Number(file.file_size || 0)
      startTask({
        txId: file.tx_id,
        fileName: file.file_name,
        total: expectedDataSize > 0 ? expectedDataSize : null,
        controller,
      })
      setTaskStatus("downloading", "Preparing download")

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
        await db.run(
          `UPDATE file_indexes SET encryption_params = ?, updated_at = ?
           WHERE tx_id = ? AND owner_address = ?`,
          [
            encryptionParamsTag.value,
            Date.now(),
            file.tx_id,
            file.owner_address,
          ],
        )
      }

      // ── Fetch raw data ────────────────────────────────────────────────────

      setStage("downloading")
      currentStage = "downloading"
      setStatusMsg("Checking local cache…")

      const localCached = await getCachedResource(
        file.owner_address,
        file.tx_id,
      )
      let rawData: Uint8Array | null =
        isEncrypted && localCached?.isEncrypted === true
          ? localCached.payload
          : !isEncrypted && localCached?.isEncrypted === false
            ? localCached.payload
            : null
      const fromCache = rawData !== null

      if (!rawData) {
        setStatusMsg("Downloading from network…")
        setTaskStatus("downloading", "Downloading from network")
        rawData = await downloadRawData(
          file.tx_id,
          file.storage_type,
          expectedDataSize,
          (loaded, total) => {
            setDownloadProgress({ loaded, total })
            updateProgress(loaded, total)
          },
          controller.signal,
        )
        await upsertCachedResource({
          ownerAddress: file.owner_address,
          txId: file.tx_id,
          mimeType: file.mime_type,
          storageType: file.storage_type,
          isEncrypted,
          payload: rawData,
        })
      }

      // ── Decrypt if needed ─────────────────────────────────────────────────

      let finalData: Uint8Array

      if (!isEncrypted || !key) {
        finalData = rawData
      } else {
        const tryDecrypt = async (
          payload: Uint8Array,
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

        const decryptPayload = async (
          payload: Uint8Array,
        ): Promise<Uint8Array> => {
          const zeroKey = new Uint8Array(32)
          setStage("decrypting")
          currentStage = "decrypting"
          setStatusMsg("Decrypting file…")
          setTaskStatus("processing", "Decrypting file")

          const r1 = await tryDecrypt(payload, key)
          if (r1) return r1

          setStatusMsg("Trying legacy key format…")
          const r2 = await tryDecrypt(payload, zeroKey)
          if (r2) return r2

          setStage("metadata")
          currentStage = "metadata"
          setStatusMsg("Verifying encryption metadata from chain…")
          await hydrateTagsForNonceRepair()

          setStage("decrypting")
          currentStage = "decrypting"
          setStatusMsg("Retrying with verified metadata…")

          const r3 = await tryDecrypt(payload, key)
          if (r3) return r3

          const r4 = await tryDecrypt(payload, zeroKey)
          if (r4) return r4

          throw new Error(
            "No supported key or metadata combination could decrypt this file.",
          )
        }

        try {
          finalData = await decryptPayload(rawData)
        } catch {
          if (fromCache) {
            setStatusMsg("Cached data failed. Retrying from network…")
            setTaskStatus("downloading", "Retrying download")
            const redownloaded = await downloadRawData(
              file.tx_id,
              file.storage_type,
              expectedDataSize,
              (loaded, total) => {
                setDownloadProgress({ loaded, total })
                updateProgress(loaded, total)
              },
              controller.signal,
            )
            await upsertCachedResource({
              ownerAddress: file.owner_address,
              txId: file.tx_id,
              mimeType: file.mime_type,
              storageType: file.storage_type,
              isEncrypted: true,
              payload: redownloaded,
            })
            finalData = await decryptPayload(redownloaded)
          } else {
            throw new Error(
              "File payload/metadata mismatch prevented decryption.",
            )
          }
        }
      }

      // ── Save file ─────────────────────────────────────────────────────────

      setStage("saving")
      currentStage = "saving"
      setStatusMsg("Saving file…")
      setTaskStatus("processing", "Saving file")
      triggerFileSave(
        finalData,
        file.mime_type || "application/octet-stream",
        file.file_name,
      )

      setStage("done")
      currentStage = "done"
      setStatusMsg(null)
      finishTask("completed", "Download completed")
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        finishTask("cancelled", "Download cancelled")
        setError("Download cancelled.")
        setStage("idle")
        setStatusMsg(null)
        return
      }

      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setStage("idle")
      setStatusMsg(null)
      finishTask("failed", msg)
      console.error(`[DownloadPage] Download failed at ${currentStage}:`, err)
    }
  }

  // ── Auto-download public files ─────────────────────────────────────────────

  useEffect(() => {
    if (state.status !== "found" || state.file.encryption_algo !== "none")
      return
    if (stage !== "idle") return
    void runDownload(state.file)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // ── Auto-download via auth param ───────────────────────────────────────────

  useEffect(() => {
    if (
      !authParam ||
      state.status !== "found" ||
      state.file.encryption_algo === "none"
    )
      return
    if (stage !== "idle") return

    let cancelled = false

    const run = async () => {
      try {
        const key = await decodeAuthParam(authParam, normalized.txId)
        if (cancelled) return
        await runDownload(state.file, key)
      } catch (err) {
        if (cancelled) return
        console.warn("Auth param failed:", err)
        setError(
          "The access link could not be verified. Please enter the password manually.",
        )
      }
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authParam, state, normalized.txId])

  // ── Manual password submit ─────────────────────────────────────────────────

  const handlePasswordSubmit = async (file: FileIndex) => {
    if (!password.trim()) {
      setError("Password is required.")
      return
    }
    if (!wallet.internal.systemSalt) {
      setError("Vault is still initializing. Please retry in a moment.")
      return
    }

    const key = await deriveKey(password, wallet.internal.systemSalt)

    if (wallet.internal.vaultId) {
      const derivedVaultId = await getVaultIdFromKey(key)
      if (derivedVaultId !== wallet.internal.vaultId) {
        setError("Incorrect password.")
        return
      }
    }

    await runDownload(file, key)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isWorking =
    stage === "downloading" ||
    stage === "decrypting" ||
    stage === "verifying" ||
    stage === "verified" ||
    stage === "metadata" ||
    stage === "saving"

  // Derive file name/size for display
  const fileInfo = useMemo(() => {
    if (state.status !== "found") return null
    return {
      name: state.file.file_name,
      isEncrypted: state.file.encryption_algo !== "none",
    }
  }, [state])

  if (state.status === "loading") {
    return (
      <main className="mesh-gradient relative flex min-h-screen items-center justify-center p-4">
        <GlobalDownloadBar topOffsetClassName="top-3" compact />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    )
  }

  if (state.status === "missing") {
    return (
      <main className="p-4 text-sm text-neutral-700">
        <GlobalDownloadBar topOffsetClassName="top-3" compact />
        File not found.
        {state.reason ? ` ${state.reason}` : ""}
      </main>
    )
  }

  if (stage === "done") {
    return (
      <main className="mesh-gradient relative flex min-h-screen items-center justify-center px-4">
        <GlobalDownloadBar topOffsetClassName="top-3" compact />
        <Card className="border-border/70 bg-card/92 w-full max-w-sm overflow-hidden shadow-lg">
          <div className="bg-primary h-1.5 w-full" />
          <CardHeader className="pt-7 text-center">
            <div className="bg-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <CheckCircle className="text-foreground h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Download Complete</CardTitle>
            <CardDescription className="mt-1 truncate" title={fileInfo?.name}>
              {fileInfo?.name}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  // Public file: just show progress (auto-starts)
  if (!fileInfo?.isEncrypted) {
    return (
      <main className="mesh-gradient relative flex min-h-screen items-center justify-center px-4">
        <GlobalDownloadBar topOffsetClassName="top-3" compact />
        <Card className="border-border/70 bg-card/92 w-full max-w-sm overflow-hidden shadow-lg">
          <div className="bg-primary h-1.5 w-full" />
          <CardHeader className="pt-7 text-center">
            <div className="bg-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <Download className="text-foreground h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Downloading</CardTitle>
            <CardDescription
              className="mt-1 truncate"
              title={fileInfo?.name ?? ""}
            >
              {fileInfo?.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            {isWorking ? (
              <div className="space-y-3">
                <ProgressBar
                  loaded={downloadProgress.loaded}
                  total={downloadProgress.total}
                />
                {statusMsg ? (
                  <p className="text-muted-foreground text-xs">{statusMsg}</p>
                ) : null}
              </div>
            ) : null}
            {error ? (
              <p className="mt-2 text-xs text-red-600">{error}</p>
            ) : null}
          </CardContent>
        </Card>
      </main>
    )
  }

  // Encrypted file: show password form (or auth-pending spinner)
  const autoAuthPending = !!authParam && isWorking

  return (
    <main className="mesh-gradient relative min-h-screen px-4 py-8">
      <GlobalDownloadBar topOffsetClassName="top-3" compact />
      <div className="mx-auto mt-[8vh] w-full max-w-md">
        <Card className="border-border/70 bg-card/92 overflow-hidden shadow-lg">
          <div className="bg-primary h-1.5 w-full" />
          <CardHeader className="pt-7 text-center">
            <div className="bg-secondary mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <Lock className="text-foreground h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Encrypted File</CardTitle>
            <CardDescription>
              {autoAuthPending
                ? "Verifying access link…"
                : "Enter password to download this file."}
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-6">
            {autoAuthPending ? (
              <div className="space-y-3">
                {stage === "downloading" && (
                  <ProgressBar
                    loaded={downloadProgress.loaded}
                    total={downloadProgress.total}
                  />
                )}
                {statusMsg ? (
                  <p className="text-muted-foreground text-center text-sm">
                    {statusMsg}
                  </p>
                ) : null}
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (state.status === "found") {
                    void handlePasswordSubmit(state.file)
                  }
                }}
              >
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="h-11 pr-11"
                    disabled={isWorking}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    disabled={isWorking}
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
                  disabled={isWorking}
                >
                  {isWorking ? (
                    <>
                      <Download className="mr-2 h-4 w-4 animate-pulse" />
                      {stage === "downloading"
                        ? "Downloading…"
                        : stage === "decrypting"
                          ? "Decrypting…"
                          : "Processing…"}
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download File
                    </>
                  )}
                </Button>

                {isWorking && stage === "downloading" ? (
                  <ProgressBar
                    loaded={downloadProgress.loaded}
                    total={downloadProgress.total}
                  />
                ) : null}

                {statusMsg && isWorking ? (
                  <p className="text-muted-foreground text-xs">{statusMsg}</p>
                ) : null}

                {error ? <p className="text-xs text-red-600">{error}</p> : null}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
