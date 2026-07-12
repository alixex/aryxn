import { View, Div, Span, signal, createEffect, createRoot } from "ranui/builder"
import { setTheme } from "ranui/theme"
import { t, i18n } from "./i18n"
import {
  connectArweave,
  disconnectArweave,
  getArBalance,
  getConnectedEvmAddress,
  hasArweaveWallet,
} from "./wallet"
import {
  uploadArweave,
  uploadIrys,
  listArweaveByOwner,
  listIrysByOwner,
  type AssetRecord,
  type Chain,
} from "./storage"
import { cacheAsset, cacheAssets, cachedAssets } from "./cache"
import { discoverEvmWallets, type EvmWallet } from "./wallet-evm"

// ── Reactive state ─────────────────────────────────────────────────────────
const [locale, setLocale] = signal(i18n.getLocale())
const [address, setAddress] = signal<string | null>(null)
const [balance, setBalance] = signal<string | null>(null)
const [chain, setChain] = signal<Chain>("arweave")
const [links, setLinks] = signal<AssetRecord[]>([])

// Reactive translate: reads the locale signal so getter bindings re-run on switch.
const tr = (key: string, params?: Record<string, string | number>): string => {
  locale()
  return t(key, params)
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

/** Build the app once inside a reactive scope. Returns its dispose (MPA-ready). */
export function renderApp(root: HTMLElement): () => void {
  return createRoot((dispose) => {
    const themeSwitch = View("r-theme-switch")
      .on("change", (e: Event) => {
        const theme = (e as CustomEvent<{ theme: string }>).detail?.theme
        if (theme) setTheme(theme as "system" | "light" | "dark")
      })
      .build()

    const langBtn = View("r-button")
      .text(() => tr("lang.toggle"))
      .on("click", () => {
        const next = i18n.getLocale() === "en" ? "zh-CN" : "en"
        i18n.setLocale(next)
        setLocale(next)
      })
      .build()

    const connectBtn = View("r-button")
      .attr("type", "primary")
      .text(() => connectLabel())
      .on("click", () => void onConnectToggle())
      .build()

    const topbar = Div()
      .class("topbar")
      .children(
        Div().class("brand").text("aryxn"),
        Div().class("topbar-actions").children(themeSwitch, langBtn, connectBtn),
      )
      .build()

    const hero = Div()
      .class("hero")
      .children(
        View("h1").text(() => tr("hero.title")),
        View("p").text(() => tr("hero.subtitle")),
      )
      .build()

    const dropZone = renderDropZone()
    uploadPanel = Div().build()

    const linksEl = Div().class("links").build()
    createEffect(() => renderLinks(linksEl, links()))

    const linksSection = Div()
      .children(View("h2").class("section-title").text(() => tr("links.title")), linksEl)
      .build()

    root.replaceChildren(
      Div().class("wrap").children(topbar, hero, dropZone, uploadPanel, linksSection).build(),
    )

    void refreshLinks()
    return dispose
  })
}

// ── Connect ──────────────────────────────────────────────────────────────
function connectLabel(): string {
  const a = address()
  if (!a) return tr("connect")
  const short = `${a.slice(0, 5)}…${a.slice(-4)}`
  const b = balance()
  return b ? `${short} · ${b} AR` : short
}

async function onConnectToggle(): Promise<void> {
  if (address()) {
    await disconnectArweave()
    setAddress(null)
    setBalance(null)
    return
  }
  if (!hasArweaveWallet()) {
    alert(tr("err.noArWallet"))
    return
  }
  try {
    const a = await connectArweave()
    setAddress(a)
    void loadBalance(a)
    void refreshLinks()
  } catch (e) {
    alert((e as Error).message)
  }
}

async function loadBalance(a: string): Promise<void> {
  try {
    setBalance(await getArBalance(a))
  } catch {
    /* balance is best-effort */
  }
}

// ── Upload ───────────────────────────────────────────────────────────────
function renderDropZone(): HTMLElement {
  const input = View<HTMLInputElement>("input").attr("type", "file").class("hidden").build()
  input.addEventListener("change", () => {
    if (input.files && input.files[0]) selectFile(input.files[0])
  })

  const zone = Div()
    .class("drop")
    .children(
      Div().text(() => tr("drop.title")),
      Div().class("drop-hint").text(() => tr("drop.hint")),
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
  return View("r-button")
    .attr("type", chain() === value ? "primary" : "")
    .text(label)
    .on("click", () => {
      setChain(value)
      renderFilePanel()
    })
    .build()
}

function renderFilePanel(): void {
  const f = currentFile
  if (!f) return
  uploadPanel.replaceChildren(
    Div()
      .class("space")
      .children(
        Div()
          .class("row")
          .children(
            Div()
              .class("link-meta")
              .children(
                Div().class("link-name").text(f.name),
                Div().class("muted").text(fmtSize(f.size)),
              ),
          ),
        Div().class("row").children(chainBtn("arweave", "Arweave"), chainBtn("irys", "Irys")),
        Div()
          .class("space")
          .children(
            View("r-button")
              .attr("type", "primary")
              .text(tr("upload.cta"))
              .on("click", () => void doUpload()),
          ),
      )
      .build(),
  )
}

async function doUpload(): Promise<void> {
  const f = currentFile
  if (!f) return
  if (chain() === "arweave" && !address()) {
    alert(tr("err.connectArFirst"))
    return
  }

  let evmProvider: unknown
  if (chain() === "irys") {
    try {
      evmProvider = await resolveEvmProvider()
    } catch (e) {
      uploadPanel.replaceChildren(Div().class("space muted").text((e as Error).message).build())
      return
    }
  }

  const progress = View("r-progress").attr("total", "100").build()
  ;(progress as unknown as { percent: string }).percent = "0"
  const stage = Div().class("muted space").text(tr("upload.preparing")).build()
  uploadPanel.replaceChildren(Div().class("space").children(stage, progress).build())

  const onProgress = (p: { stage: string; progress: number }): void => {
    stage.textContent = p.stage
    ;(progress as unknown as { percent: string }).percent = String(Math.round(p.progress))
  }

  try {
    const record =
      chain() === "irys"
        ? await uploadIrys(f, { onProgress }, evmProvider)
        : await uploadArweave(f, address()!, { onProgress })
    await cacheAsset(record)
    showResult(record)
    currentFile = null
    void refreshLinks()
  } catch (e) {
    uploadPanel.replaceChildren(
      Div().class("space muted").text(tr("upload.failed", { msg: (e as Error).message })).build(),
    )
  }
}

// Pick the EVM wallet to pay Irys with (EIP-6963). One → use it; many → choose.
async function resolveEvmProvider(): Promise<unknown> {
  const wallets = await discoverEvmWallets()
  if (wallets.length === 0) throw new Error(tr("err.noEvmWallet"))
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
        .class("space")
        .children(
          Div().class("muted").text(tr("chain.pickEvm")),
          Div().class("row space").children(buttons),
        )
        .build(),
    )
  })
}

function copyButton(url: string, variant = ""): HTMLElement {
  const btn = View("r-button")
    .attr("type", variant)
    .text(tr("action.copy"))
    .on("click", () => {
      void navigator.clipboard.writeText(url)
      btn.textContent = tr("action.copied")
      setTimeout(() => (btn.textContent = tr("action.copy")), 1500)
    })
    .build()
  return btn
}

function showResult(record: AssetRecord): void {
  uploadPanel.replaceChildren(
    Div()
      .class("space")
      .children(
        Div().class("muted").text(tr("upload.done")),
        Div()
          .class("row space")
          .children(View("r-link").attr("href", record.url).text(record.url), copyButton(record.url)),
      )
      .build(),
  )
}

// ── My links ─────────────────────────────────────────────────────────────
async function refreshLinks(): Promise<void> {
  // Chain history from both networks (backward compatible): Arweave by AR
  // address, Irys by the connected EVM address. Local cache shows instantly.
  setLinks(await cachedAssets())
  const a = address()
  if (a) {
    try {
      await cacheAssets(await listArweaveByOwner(a))
    } catch {
      /* offline / gateway hiccup — cache still shows */
    }
  }
  const evm = await getConnectedEvmAddress()
  if (evm) {
    try {
      await cacheAssets(await listIrysByOwner(evm))
    } catch {
      /* Irys gateway hiccup — cache still shows */
    }
  }
  setLinks(await cachedAssets())
}

function renderLinks(container: HTMLElement, records: AssetRecord[]): void {
  if (records.length === 0) {
    container.replaceChildren(Div().class("muted").text(tr("links.empty")).build())
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
              Div().class("muted").text(fmtSize(r.size)),
            ),
          Div()
            .class("row")
            .children(
              Span().class("badge").text(r.chain),
              View("r-link").attr("href", r.url).text(tr("action.open")),
              copyButton(r.url, "text"),
            ),
        )
        .build(),
    ),
  )
}
