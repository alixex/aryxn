import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getFileByOwnerAndTxId, syncFileByTxIdFromArweave } from "@/lib/file"
import type { FileIndex } from "@/lib/file"
import { RPCs } from "@aryxn/chain-constants"

type LoadState =
  | { status: "loading" }
  | { status: "found"; file: FileIndex; source: "local" | "chain" }
  | { status: "missing"; reason?: string }

export default function ResourceByOwnerTx() {
  const { ownerAddress = "", txId = "" } = useParams()
  const [state, setState] = useState<LoadState>({ status: "loading" })

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

  if (state.status === "loading") {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Loading Resource</CardTitle>
              <CardDescription>
                Checking local database first, then trying on-chain source.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    )
  }

  if (state.status === "missing") {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-3xl px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>Resource Not Found</CardTitle>
              <CardDescription>
                This resource was not found in local cache or on-chain for the
                provided owner and transaction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border p-3 text-sm break-all">
                Owner: {normalized.ownerAddress || "-"}
                <br />
                Tx: {normalized.txId || "-"}
              </div>
              {state.reason ? (
                <p className="text-muted-foreground text-xs break-all">
                  Error: {state.reason}
                </p>
              ) : null}
              <Button asChild>
                <Link to="/">Back Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    )
  }

  const { file, source } = state

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Resource Detail</CardTitle>
            <CardDescription>
              Loaded from {source === "local" ? "local DB" : "on-chain"}
              {source === "chain"
                ? " and cached to local DB permanently"
                : " (permanent cache)"}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm">
              <p className="break-all">
                <span className="text-muted-foreground">Owner:</span>{" "}
                {file.owner_address}
              </p>
              <p className="break-all">
                <span className="text-muted-foreground">Tx:</span> {file.tx_id}
              </p>
              <p>
                <span className="text-muted-foreground">Name:</span>{" "}
                {file.file_name}
              </p>
              <p>
                <span className="text-muted-foreground">Type:</span>{" "}
                {file.mime_type}
              </p>
              <p>
                <span className="text-muted-foreground">Size:</span>{" "}
                {Number(file.file_size).toLocaleString()} bytes
              </p>
            </div>

            <div className="flex gap-2">
              <Button asChild>
                <a
                  href={`${RPCs.ARWEAVE_BASE}/${file.tx_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Resource
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">Back Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
