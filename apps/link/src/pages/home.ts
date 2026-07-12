import {
  View,
  Div,
  Span,
  signal,
  createEffect,
  createRoot,
} from "ranui/builder"
import { t } from "../i18n"
import {
  uploadArweave,
  uploadIrys,
  type AssetRecord,
  type Chain,
} from "../storage"
import { cacheAsset, cachedAssets } from "../cache"
import { syncArweaveAssets, syncIrysAssets } from "../sync"
import { discoverEvmWallets, type EvmWallet } from "../wallet-evm"
import { activeAccount, activeJwk, ASSET_CHAIN, type AccountRecord } from "../accounts"
import { navigate } from "../router"

// ── Reactive state ─────────────────────────────────────────────────────────
const [chain, setChain] = signal<Chain>("arweave")
const [links, setLinks] = signal<AssetRecord[]>([])
const [query, setQuery] = signal("")
const [encrypt, setEncrypt] = signal(false)

function filterLinks(records: AssetRecord[], q: string): AssetRecord[] {
  const s = q.trim().toLowerCase()
  return s
    ? records.filter((r) => r.fileName.toLowerCase().includes(s))
    : records
}

/** Non-blocking toast (Geist message) — falls back to alert only if unavailable. */
function toast(kind: "success" | "error" | "info", msg: string): void {
  const m = (
    window as unknown as {
      ranui?: { message?: Record<string, (s: string) => void> }
    }
  ).ranui?.message
  const fn = m?.[kind]
  if (fn) fn(msg)
  else if (kind === "error") alert(msg)
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// The upload panel is rebuilt imperatively across the async flow; kept out of the
// reactive tree (plain values, re-rendered on state change) to avoid orphaned effects.
let uploadPanel: HTMLElement
let currentFile: File | null = null

/** Build the home page once inside a reactive scope, into `host`. */
export function renderHome(host: HTMLElement): void {
  createRoot(() => {
    // ── Hero ───────────────────────────────────────────────────────────────
    const hero = Div()
      .class("hero reveal")
      .children(
        Div().class("hero-grid"),
        Span()
          .class("eyebrow")
          .text(() => t("hero.eyebrow")),
        View("h1").text(() => t("hero.title")),
        View("p").text(() => t("hero.subtitle")),
      )
      .build()

    // ── Uploader ───────────────────────────────────────────────────────────
    uploadPanel = renderDropZone()
    const uploader = Div()
      .class("uploader reveal d1")
      .children(uploadPanel)
      .build()

    const trust = Div()
      .class("trust reveal d2")
      .children(
        Span().text(() => t("feat.encrypted")),
        Span().text(() => t("feat.permanent")),
        Span().text(() => t("feat.opensource")),
      )
      .build()

    // ── My links ───────────────────────────────────────────────────────────
    const linksEl = Div().class("links").build()
    createEffect(() => renderLinks(linksEl, filterLinks(links(), query())))

    createEffect(() => {
      activeAccount() // dependency: re-scope + re-sync when the active account changes
      void refreshLinks()
    })

    const search = View<HTMLInputElement>("r-input")
      .attr("placeholder", () => t("links.search"))
      .build()
    search.addEventListener("input", (e) =>
      setQuery(
        (e as unknown as CustomEvent<{ value: string }>).detail?.value ?? "",
      ),
    )

    const linksSection = Div()
      .class("reveal d3")
      .children(
        Div()
          .class("section-head")
          .children(
            Span()
              .class("section-title")
              .text(() => t("links.title")),
            Span()
              .class("section-count")
              .text(() => {
                const n = filterLinks(links(), query()).length
                return n ? String(n) : ""
              }),
          ),
        Div().class("search-wrap").children(search),
        linksEl,
      )
      .build()

    host.replaceChildren(
      Div().class("wrap").children(hero, uploader, trust, linksSection).build(),
    )
  })
}

// ── Upload ───────────────────────────────────────────────────────────────
function renderDropZone(): HTMLElement {
  const input = View<HTMLInputElement>("input")
    .attr("type", "file")
    .class("hidden")
    .build()
  input.addEventListener("change", () => {
    if (input.files && input.files[0]) selectFile(input.files[0])
  })

  const zone = Div()
    .class("drop")
    .children(
      Div()
        .class("drop-title")
        .text(() => t("drop.title")),
      Div()
        .class("drop-hint")
        .text(() => t("drop.hint")),
      input,
    )
    .build()
  zone.addEventListener("click", () => input.click())
  zone.addEventListener("dragover", (e) => {
    e.preventDefault()
    zone.classList.add("drag")
  })
  zone.addEventListener("dragleave", () => zone.classList.remove("drag"))
  zone.addEventListener("drop", (e) => {
    e.preventDefault()
    zone.classList.remove("drag")
    const f = (e as DragEvent).dataTransfer?.files?.[0]
    if (f) selectFile(f)
  })
  return zone
}

function selectFile(f: File): void {
  currentFile = f
  renderFilePanel()
}

function chainBtn(value: Chain, label: string): HTMLElement {
  return View("button")
    .class(chain() === value ? "seg-item active" : "seg-item")
    .attr("type", "button")
    .text(label)
    .on("click", () => {
      setChain(value)
      renderFilePanel()
    })
    .build()
}

function encryptToggle(): HTMLElement {
  const cb = View("r-checkbox")
    .boolAttr("checked", encrypt())
    .text(t("upload.encrypt"))
    .build()
  cb.addEventListener("change", (e) =>
    setEncrypt(
      (e as unknown as CustomEvent<{ checked: boolean }>).detail?.checked ??
        false,
    ),
  )
  return cb
}

function renderFilePanel(): void {
  const f = currentFile
  if (!f) return
  uploadPanel.replaceChildren(
    Div()
      .children(
        Div()
          .class("file-row")
          .children(
            Div().class("file-ico"),
            Div()
              .class("file-meta")
              .children(
                Div().class("file-name").text(f.name),
                Div().class("muted").text(fmtSize(f.size)),
              ),
            View("r-button")
              .attr("type", "text")
              .text(t("upload.change"))
              .on("click", () => {
                currentFile = null
                uploadPanel.replaceChildren(renderDropZone())
              }),
          ),
        Div()
          .class("ctl-row")
          .children(
            Span().class("ctl-label").text(t("upload.network")),
            Div()
              .class("segmented")
              .children(
                chainBtn("arweave", "Arweave"),
                chainBtn("irys", "Irys"),
              ),
          ),
        Div().class("ctl-row").children(encryptToggle()),
        Div()
          .class("cta")
          .children(
            View("r-button")
              .attr("type", "primary")
              .text(t("upload.cta"))
              .on("click", () => void doUpload()),
          ),
      )
      .build(),
  )
}

async function doUpload(): Promise<void> {
  const f = currentFile
  if (!f) return
  if (chain() === "arweave") {
    const acc = activeAccount()
    if (!acc || acc.network !== "arweave") {
      toast("error", t("err.connectArFirst"))
      navigate("/accounts")
      return
    }
  }

  let evmProvider: unknown
  if (chain() === "irys") {
    // Irys pays via the connected EVM wallet regardless of the active account.
    try {
      evmProvider = await resolveEvmProvider()
    } catch (e) {
      toast("error", (e as Error).message)
      return
    }
  }

  const progress = View("r-progress").attr("total", "100").build()
  ;(progress as unknown as { percent: string }).percent = "0"
  const stageText = Span().text(t("upload.preparing")).build()
  const stage = Div()
    .class("stage")
    .children(View("r-loading").attr("name", "circle"), stageText)
    .build()
  uploadPanel.replaceChildren(Div().children(stage, progress).build())

  const onProgress = (p: { stage: string; progress: number }): void => {
    stageText.textContent = p.stage
    ;(progress as unknown as { percent: string }).percent = String(
      Math.round(p.progress),
    )
  }

  try {
    const record =
      chain() === "irys"
        ? await uploadIrys(f, { onProgress, encrypt: encrypt() }, evmProvider)
        : await uploadArweave(
            f,
            activeAccount()!.address,
            { onProgress, encrypt: encrypt() },
            activeJwk(),
          )
    await cacheAsset(record)
    showResult(record)
    currentFile = null
    void refreshLinks()
  } catch (e) {
    toast("error", t("upload.failed", { msg: (e as Error).message }))
    renderFilePanel()
  }
}

// Pick the EVM wallet to pay Irys with (EIP-6963). One → use it; many → choose.
async function resolveEvmProvider(): Promise<unknown> {
  const wallets = await discoverEvmWallets()
  if (wallets.length === 0) throw new Error(t("err.noEvmWallet"))
  if (wallets.length === 1) return wallets[0].provider
  return chooseWallet(wallets)
}

function chooseWallet(wallets: EvmWallet[]): Promise<unknown> {
  return new Promise((resolve) => {
    const buttons = wallets.map((w) =>
      View("r-button")
        .text(w.info.name)
        .on("click", () => resolve(w.provider))
        .build(),
    )
    uploadPanel.replaceChildren(
      Div()
        .children(
          Div()
            .class("muted")
            .style("margin-bottom", "10px")
            .text(t("chain.pickEvm")),
          Div().class("acct-group").children(buttons),
        )
        .build(),
    )
  })
}

function copyButton(url: string, variant = ""): HTMLElement {
  const btn = View("r-button")
    .attr("type", variant)
    .text(t("action.copy"))
    .on("click", () => {
      void navigator.clipboard.writeText(url)
      btn.textContent = t("action.copied")
      toast("success", t("toast.copied"))
      setTimeout(() => (btn.textContent = t("action.copy")), 1500)
    })
    .build()
  return btn
}

function showResult(record: AssetRecord): void {
  uploadPanel.replaceChildren(
    Div()
      .children(
        Div()
          .class("result-head")
          .children(
            Span().class("result-check"),
            Span().text(t("upload.done")),
          ),
        Div()
          .class("permalink")
          .children(
            View("a")
              .attr("href", record.url)
              .attr("target", "_blank")
              .text(record.url),
            copyButton(record.url, "contrast"),
          ),
        Div()
          .class("cta")
          .children(
            View("r-button")
              .attr("type", "text")
              .text(t("upload.another"))
              .on("click", () => uploadPanel.replaceChildren(renderDropZone())),
          ),
      )
      .build(),
  )
}

// ── My links ─────────────────────────────────────────────────────────────
/** Owner-scoped view of the cache: the active account's own assets, plus a
 * same-chain fallback for legacy records cached before ownership was tracked. */
function visibleAssets(
  all: AssetRecord[],
  acc: AccountRecord | null,
): AssetRecord[] {
  if (!acc || !acc.address) return []
  const assetChain = ASSET_CHAIN[acc.network]
  return all.filter(
    (r) => r.owner === acc.address || (!r.owner && r.chain === assetChain),
  )
}

async function refreshLinks(): Promise<void> {
  const acc = activeAccount()
  setLinks(visibleAssets(await cachedAssets(), acc)) // instant local view
  if (!acc?.address) return
  try {
    if (acc.network === "arweave") await syncArweaveAssets(acc.address)
    else await syncIrysAssets(acc.address)
  } catch {
    /* offline / gateway hiccup — cache still shows */
  }
  setLinks(visibleAssets(await cachedAssets(), acc))
}

function renderLinks(container: HTMLElement, records: AssetRecord[]): void {
  if (records.length === 0) {
    container.replaceChildren(
      Div()
        .class("empty")
        .children(
          Div().class("empty-title").text(t("links.empty")),
          Div().class("empty-hint").text(t("links.emptyHint")),
        )
        .build(),
    )
    return
  }
  container.replaceChildren(
    ...records.map((r) =>
      Div()
        .class("link-item")
        .children(
          Div()
            .class("link-meta")
            .children(
              Div().class("link-name").text(r.fileName),
              Div()
                .class("link-sub")
                .children(
                  Span().class("badge").text(r.chain),
                  r.encrypted
                    ? Span().class("badge").text(t("links.private"))
                    : null,
                  Span().text(fmtSize(r.size)),
                ),
            ),
          Div()
            .class("link-actions")
            .children(
              View("a")
                .class("open-link")
                .attr("href", r.url)
                .attr("target", "_blank")
                .text(t("action.open")),
              copyButton(r.url, "text"),
            ),
        )
        .build(),
    ),
  )
}
