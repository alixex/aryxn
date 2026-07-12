import {
  View,
  Div,
  Span,
  signal,
  createEffect,
  createRoot,
  onCleanup,
  type ElementBuilder,
} from "ranui/builder"
import { setTheme } from "ranui/theme"
import { t, i18n } from "./i18n"
import {
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
import * as accounts from "./account"
import type { Account } from "./account"

// ── Reactive state ─────────────────────────────────────────────────────────
const [locale, setLocale] = signal(i18n.getLocale())
const [account, setAccount] = signal<Account>(null)
const [balance, setBalance] = signal<string | null>(null)

/** Active account address (reactive — reads the account signal). */
function address(): string | null {
  return account()?.address ?? null
}
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

// Reactive translate: reads the locale signal so getter bindings re-run on switch.
const tr = (key: string, params?: Record<string, string | number>): string => {
  locale()
  return t(key, params)
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
let accountModal: HTMLElement
let currentFile: File | null = null

/** Build the app once inside a reactive scope. Returns its dispose (MPA-ready). */
export function renderApp(root: HTMLElement): () => void {
  return createRoot((dispose) => {
    // ── Nav ────────────────────────────────────────────────────────────────
    const themeSwitch = View("r-theme-switch")
      .attr("label-system", tr("theme.system"))
      .attr("label-light", tr("theme.light"))
      .attr("label-dark", tr("theme.dark"))
      .on("change", (e: Event) => {
        const theme = (e as CustomEvent<{ theme: string }>).detail?.theme
        if (theme) setTheme(theme as "system" | "light" | "dark")
      })
      .build()

    const langBtn = View("r-button")
      .attr("type", "text")
      .text(() => tr("lang.toggle"))
      .on("click", () => {
        const next = i18n.getLocale() === "en" ? "zh-CN" : "en"
        i18n.setLocale(next)
        setLocale(next)
      })
      .build()

    const connectBtn = View("r-button")
      .attr("type", "contrast")
      .text(() => connectLabel())
      .on("click", () => openAccountModal())
      .build()

    accountModal = View("r-modal")
      .attr("title", () => tr("account.title"))
      .attr("closable", "")
      .build()

    const nav = View("header")
      .class("nav")
      .children(
        Div()
          .class("nav-inner")
          .children(
            Div().class("brand").text("aryxn"),
            Div()
              .class("nav-actions")
              .children(themeSwitch, langBtn, connectBtn),
          ),
      )
      .build()

    // Border appears once the page scrolls under the sticky nav.
    const onScroll = (): void => {
      nav.classList.toggle("scrolled", window.scrollY > 4)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onCleanup(() => window.removeEventListener("scroll", onScroll))

    // ── Hero ───────────────────────────────────────────────────────────────
    const hero = Div()
      .class("hero reveal")
      .children(
        Div().class("hero-grid"),
        Span()
          .class("eyebrow")
          .text(() => tr("hero.eyebrow")),
        View("h1").text(() => tr("hero.title")),
        View("p").text(() => tr("hero.subtitle")),
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
        Span().text(() => tr("feat.encrypted")),
        Span().text(() => tr("feat.permanent")),
        Span().text(() => tr("feat.opensource")),
      )
      .build()

    // ── My links ───────────────────────────────────────────────────────────
    const linksEl = Div().class("links").build()
    createEffect(() => renderLinks(linksEl, filterLinks(links(), query())))

    const search = View<HTMLInputElement>("r-input")
      .attr("placeholder", () => tr("links.search"))
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
              .text(() => tr("links.title")),
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

    root.replaceChildren(
      nav,
      Div().class("wrap").children(hero, uploader, trust, linksSection).build(),
      accountModal,
    )

    onScroll()
    void refreshLinks()
    return dispose
  })
}

// ── Account ────────────────────────────────────────────────────────────────
function connectLabel(): string {
  const a = address()
  if (!a) return tr("connect")
  const short = `${a.slice(0, 5)}…${a.slice(-4)}`
  const b = balance()
  return b ? `${short} · ${b} AR` : short
}

async function loadBalance(a: string): Promise<void> {
  try {
    setBalance(await getArBalance(a))
  } catch {
    /* balance is best-effort */
  }
}

function applyAccount(acc: Account): void {
  setAccount(acc)
  if (acc) {
    void loadBalance(acc.address)
    void refreshLinks()
  } else {
    setBalance(null)
  }
}

function setModalOpen(open: boolean): void {
  ;(accountModal as unknown as { open: boolean }).open = open
}

function openAccountModal(): void {
  accountModal.replaceChildren(buildAccountBody())
  setModalOpen(true)
}

/** Read the `value` of an r-input (custom element). */
function val(el: HTMLElement): string {
  return (el as unknown as { value?: string }).value ?? ""
}

function pwdField(): HTMLElement {
  return View("r-input")
    .attr("type", "password")
    .attr("placeholder", tr("account.password"))
    .build()
}

async function runAccount(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (e) {
    toast("error", (e as Error).message)
  }
}

function downloadText(text: string, name: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  )
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A titled group of controls in the account sheet. */
function acctGroup(
  label: string,
  ...nodes: Array<ElementBuilder<HTMLElement> | HTMLElement | null>
): ElementBuilder<HTMLDivElement> {
  return Div()
    .class("acct-group")
    .children(Span().class("acct-label").text(label), ...nodes)
}

function buildAccountBody(): HTMLElement {
  const acc = account()
  const groups: Array<ElementBuilder<HTMLElement> | null> = []

  if (acc) {
    groups.push(
      acctGroup(
        tr(acc.kind === "local" ? "account.local" : "account.external"),
        Div().class("acct-addr").text(acc.address),
      ),
    )

    if (acc.kind === "local") {
      const encPwd = pwdField()
      groups.push(
        acctGroup(
          tr("account.backup"),
          View("r-button")
            .text(tr("account.export"))
            .on("click", () => {
              const jwk = accounts.exportKeyfile()
              if (jwk)
                downloadText(jwk, `aryxn-${acc.address.slice(0, 8)}.json`)
            }),
          Div()
            .class("acct-field")
            .children(
              encPwd,
              View("r-button")
                .text(tr("account.exportEnc"))
                .on(
                  "click",
                  () =>
                    void runAccount(async () => {
                      const blob = await accounts.exportEncrypted(val(encPwd))
                      if (blob)
                        downloadText(
                          blob,
                          `aryxn-${acc.address.slice(0, 8)}.enc.json`,
                        )
                    }),
                ),
            ),
        ),
      )
    }

    groups.push(
      Div()
        .class("acct-group")
        .children(
          View("r-button")
            .attr("type", "warning")
            .text(tr("account.disconnect"))
            .on(
              "click",
              () =>
                void runAccount(async () => {
                  await accounts.disconnect()
                  applyAccount(null)
                  setModalOpen(false)
                  toast("info", tr("toast.disconnected"))
                }),
            ),
        ),
    )
    return Div().class("acct").children(groups).build()
  }

  // Not connected: connect external, create, import, or unlock a stored account.
  if (hasArweaveWallet()) {
    groups.push(
      Div()
        .class("acct-group")
        .children(
          View("r-button")
            .attr("type", "primary")
            .text(tr("account.connectWander"))
            .on(
              "click",
              () =>
                void runAccount(async () => {
                  applyAccount(await accounts.connectExternal())
                  setModalOpen(false)
                  toast("success", tr("toast.connected"))
                }),
            ),
        ),
      Div().class("acct-divider").text(tr("account.or")),
    )
  }

  const createPwd = pwdField()
  groups.push(
    acctGroup(
      tr("account.newLocal"),
      Div()
        .class("acct-field")
        .children(
          createPwd,
          View("r-button")
            .attr("type", "primary")
            .text(tr("account.create"))
            .on(
              "click",
              () =>
                void runAccount(async () => {
                  const p = val(createPwd)
                  if (!p) throw new Error(tr("account.needPassword"))
                  applyAccount(await accounts.createLocal(p))
                  setModalOpen(false)
                  toast("success", tr("toast.created"))
                }),
            ),
        ),
    ),
  )

  const fileInput = View<HTMLInputElement>("input")
    .attr("type", "file")
    .attr("accept", ".json,application/json")
    .build()
  const importPwd = pwdField()
  groups.push(
    acctGroup(
      tr("account.import"),
      fileInput,
      Div()
        .class("acct-field")
        .children(
          importPwd,
          View("r-button")
            .text(tr("account.import"))
            .on(
              "click",
              () =>
                void runAccount(async () => {
                  const f = fileInput.files?.[0]
                  if (!f) throw new Error(tr("account.pickFile"))
                  const p = val(importPwd)
                  if (!p) throw new Error(tr("account.needPassword"))
                  applyAccount(await accounts.importKeyfile(await f.text(), p))
                  setModalOpen(false)
                  toast("success", tr("toast.imported"))
                }),
            ),
        ),
    ),
  )

  if (accounts.hasStoredAccount()) {
    const unlockPwd = pwdField()
    groups.push(
      Div().class("acct-divider").text(tr("account.or")),
      acctGroup(
        tr("account.stored"),
        Div()
          .class("acct-field")
          .children(
            unlockPwd,
            View("r-button")
              .attr("type", "primary")
              .text(tr("account.unlock"))
              .on(
                "click",
                () =>
                  void runAccount(async () => {
                    applyAccount(await accounts.unlock(val(unlockPwd)))
                    setModalOpen(false)
                    toast("success", tr("toast.unlocked"))
                  }),
              ),
          ),
      ),
    )
  }

  return Div().class("acct").children(groups).build()
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
        .text(() => tr("drop.title")),
      Div()
        .class("drop-hint")
        .text(() => tr("drop.hint")),
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
    .text(tr("upload.encrypt"))
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
              .text(tr("upload.change"))
              .on("click", () => {
                currentFile = null
                uploadPanel.replaceChildren(renderDropZone())
              }),
          ),
        Div()
          .class("ctl-row")
          .children(
            Span().class("ctl-label").text(tr("upload.network")),
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
    toast("error", tr("err.connectArFirst"))
    openAccountModal()
    return
  }

  let evmProvider: unknown
  if (chain() === "irys") {
    try {
      evmProvider = await resolveEvmProvider()
    } catch (e) {
      toast("error", (e as Error).message)
      return
    }
  }

  const progress = View("r-progress").attr("total", "100").build()
  ;(progress as unknown as { percent: string }).percent = "0"
  const stageText = Span().text(tr("upload.preparing")).build()
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
            address()!,
            { onProgress, encrypt: encrypt() },
            accounts.activeJwk(),
          )
    await cacheAsset(record)
    showResult(record)
    currentFile = null
    void refreshLinks()
  } catch (e) {
    toast("error", tr("upload.failed", { msg: (e as Error).message }))
    renderFilePanel()
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
        .children(
          Div()
            .class("muted")
            .style("margin-bottom", "10px")
            .text(tr("chain.pickEvm")),
          Div().class("acct-group").children(buttons),
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
      toast("success", tr("toast.copied"))
      setTimeout(() => (btn.textContent = tr("action.copy")), 1500)
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
            Span().text(tr("upload.done")),
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
              .text(tr("upload.another"))
              .on("click", () => uploadPanel.replaceChildren(renderDropZone())),
          ),
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
    container.replaceChildren(
      Div()
        .class("empty")
        .children(
          Div().class("empty-title").text(tr("links.empty")),
          Div().class("empty-hint").text(tr("links.emptyHint")),
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
                    ? Span().class("badge").text(tr("links.private"))
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
                .text(tr("action.open")),
              copyButton(r.url, "text"),
            ),
        )
        .build(),
    ),
  )
}
