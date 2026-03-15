import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { getFileByOwnerAndTxId, syncFileByTxIdFromArweave } from "@/lib/file"
import type { FileIndex } from "@/lib/file"
import { getCachedResource, upsertCachedResource } from "@/lib/file"
import { RPCs } from "@aryxn/chain-constants"
import { deriveKey, decryptData, fromBase64 } from "@aryxn/crypto"
import type { UploadRecord } from "@/lib/utils"
import { useWallet } from "@/hooks/account-hooks"
import { VAULT_SALT_LEGACY } from "@/hooks/vault-hooks/use-vault"
import { getTransactionMetadata } from "@/components/history-table/download-data"
import { decodeTransactionTags } from "@/components/history-table/transaction-tags"
import { processFileData } from "@/components/history-table/process-data"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Lock } from "lucide-react"

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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  }) as Promise<T>
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function downloadEncryptedData(
  txId: string,
  storageType: string,
  expectedSize: number,
): Promise<Uint8Array> {
  const gateways =
    storageType === "irys"
      ? ["https://gateway.irys.xyz"]
      : [RPCs.ARWEAVE_BASE, "https://ar-io.net", "https://arweave.live"]

  let lastError: unknown = null

  for (const gateway of gateways) {
    try {
      const response = await fetchWithTimeout(`${gateway}/${txId}`, 20000)
      if (!response.ok) {
        throw new Error(`Gateway ${gateway} failed: ${response.status}`)
      }

      const data = new Uint8Array(await response.arrayBuffer())
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

export default function ResourceByOwnerTx() {
  const { ownerAddress = "", txId = "" } = useParams()
  const wallet = useWallet()
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [password, setPassword] = useState("")
  const [decrypting, setDecrypting] = useState(false)
  const [decryptError, setDecryptError] = useState<string | null>(null)
  const [decryptStatus, setDecryptStatus] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [decryptStage, setDecryptStage] = useState<DecryptStage>("idle")
  const [errorCategory, setErrorCategory] = useState<string | null>(null)

  const openBlobResource = useCallback(
    (payload: Uint8Array, mimeType: string) => {
      const blob = new Blob([payload.buffer.slice(0) as BlobPart], {
        type: mimeType || "application/octet-stream",
      })
      const objectUrl = URL.createObjectURL(blob)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
      window.location.replace(objectUrl)
    },
    [],
  )

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
        const cached = await getCachedResource(
          state.file.owner_address,
          state.file.tx_id,
        )

        if (cancelled) return

        if (cached && !cached.isEncrypted) {
          openBlobResource(
            cached.payload,
            state.file.mime_type || "application/octet-stream",
          )
          return
        }

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

        if (cancelled) return

        openBlobResource(
          downloaded,
          state.file.mime_type || "application/octet-stream",
        )
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
  }, [openBlobResource, state])

  const handleDecryptAndOpen = async (file: FileIndex) => {
    if (!password.trim()) {
      setDecryptError("Password is required.")
      return
    }

    if (!wallet.internal.systemSalt) {
      setDecryptError("Vault is still initializing. Please retry in a moment.")
      return
    }

    setDecrypting(true)
    setDecryptError(null)
    setErrorCategory(null)
    setDecryptStage("verifying")
    setDecryptStatus("Validating password...")

    try {
      const salt = wallet.internal.systemSalt || VAULT_SALT_LEGACY
      const key = await deriveKey(password, salt)

      // Stage 1: password verification gate.
      if (wallet.internal.vaultId) {
        const derivedVaultId = await getVaultIdFromKey(key)
        if (derivedVaultId !== wallet.internal.vaultId) {
          throw new Error("Incorrect password")
        }
      }
      setDecryptStage("verified")
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

      setDecryptStage("downloading")
      setDecryptStatus("Checking local cache...")

      const localCached = await getCachedResource(
        file.owner_address,
        file.tx_id,
      )
      let encryptedData: Uint8Array | null =
        localCached?.isEncrypted === true ? localCached.payload : null

      let decodedTags: Array<{ name: string; value: string }> = []

      if (!encryptedData) {
        setDecryptStage("metadata")
        setDecryptStatus("Loading resource metadata...")
        const { transaction, expectedDataSize } = await withTimeout(
          getTransactionMetadata(file.tx_id),
          15000,
          "Metadata request timed out. Please retry.",
        )
        decodedTags = decodeTransactionTags((transaction as any)?.tags)

        setDecryptStage("downloading")
        setDecryptStatus("Downloading encrypted resource...")
        encryptedData = await downloadEncryptedData(
          file.tx_id,
          file.storage_type,
          expectedDataSize,
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
        setDecryptStage("decrypting")
        setDecryptStatus("Decrypting resource...")
        decrypted = await processFileData(
          encryptedData,
          record,
          decodedTags,
          key,
          true,
        )
      } catch {
        // Fallback path for legacy records with DB-only nonce.
        const params = JSON.parse(file.encryption_params || "{}") as {
          nonce?: string
        }
        if (!params.nonce) {
          throw new Error("Missing encryption nonce.")
        }
        decrypted = await decryptData(
          encryptedData,
          fromBase64(params.nonce),
          key,
        )
      }

      setDecryptStage("opening")
      setDecryptStatus("Opening resource...")
      openBlobResource(decrypted, file.mime_type || "application/octet-stream")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to decrypt resource. Check password."
      setDecryptError(message)
      setErrorCategory(classifyDecryptError(message))
      setDecryptStage("idle")
      setDecryptStatus(null)
    } finally {
      setDecrypting(false)
    }
  }

  if (state.status === "found") {
    if (state.file.encryption_algo === "none") {
      return null
    }

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
                Enter password to verify and display this resource.
              </CardDescription>
            </CardHeader>
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
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
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
          </Card>
        </div>
      </main>
    )
  }

  if (state.status === "loading") {
    return (
      <main className="p-4 text-sm text-neutral-600">Loading resource...</main>
    )
  }

  return (
    <main className="p-4 text-sm text-neutral-700">
      Resource not found.
      {state.reason ? ` ${state.reason}` : ""}
    </main>
  )
}
