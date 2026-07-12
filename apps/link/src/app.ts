import { setTheme } from "ranui"
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

// ── State ────────────────────────────────────────────────────────────────
let address: string | null = null
let chain: Chain = "arweave"
let file: File | null = null

// ── Tiny DOM helper ──────────────────────────────────────────────────────
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, unknown>> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = String(v)
    else if (k === "text") node.textContent = String(v)
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
    } else if (v !== undefined && v !== null) {
      node.setAttribute(k, String(v))
    }
  }
  for (const c of children) node.append(c)
  return node
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

// ── Refs updated across renders ──────────────────────────────────────────
let connectBtn: HTMLElement
let dropZone: HTMLElement
let uploadPanel: HTMLElement
let linksEl: HTMLElement

export function renderApp(root: HTMLElement): void {
  const themeSwitch = h("r-theme-switch")
  themeSwitch.addEventListener("change", (e: Event) => {
    const t = (e as CustomEvent<{ theme: string }>).detail?.theme
    if (t) setTheme(t as "system" | "light" | "dark")
  })

  connectBtn = h("r-button", { type: "primary", text: "连接钱包" })
  connectBtn.addEventListener("click", onConnectToggle)

  const topbar = h("div", { class: "topbar" }, [
    h("div", { class: "brand", text: "aryxn" }),
    h("div", { class: "topbar-actions" }, [themeSwitch, connectBtn]),
  ])

  const hero = h("div", { class: "hero" }, [
    h("h1", { text: "永久文件链接" }),
    h("p", {
      text: "上传一个文件，得到一条永不失效的链接。开源，极简，存于 Arweave & Irys。",
    }),
  ])

  dropZone = renderDropZone()
  uploadPanel = h("div")
  linksEl = h("div", { class: "links" })

  const linksSection = h("div", {}, [
    h("r-section", { heading: "我的链接" }),
    linksEl,
  ])

  root.replaceChildren(
    h("div", { class: "wrap" }, [
      topbar,
      hero,
      dropZone,
      uploadPanel,
      linksSection,
    ]),
  )

  refreshConnectBtn()
  void refreshLinks()
}

// ── Connect ──────────────────────────────────────────────────────────────
async function onConnectToggle(): Promise<void> {
  if (address) {
    await disconnectArweave()
    address = null
    refreshConnectBtn()
    return
  }
  if (!hasArweaveWallet()) {
    alert("未检测到 Arweave 钱包，请安装 Wander（原 ArConnect）扩展")
    return
  }
  try {
    address = await connectArweave()
    refreshConnectBtn()
    void refreshLinks()
  } catch (e) {
    alert((e as Error).message)
  }
}

async function refreshConnectBtn(): Promise<void> {
  if (!address) {
    connectBtn.textContent = "连接钱包"
    return
  }
  const short = `${address.slice(0, 5)}…${address.slice(-4)}`
  connectBtn.textContent = short
  try {
    const bal = await getArBalance(address)
    connectBtn.textContent = `${short} · ${bal} AR`
  } catch {
    /* balance is best-effort */
  }
}

// ── Upload ───────────────────────────────────────────────────────────────
function renderDropZone(): HTMLElement {
  const input = h("input", {
    type: "file",
    class: "hidden",
  }) as HTMLInputElement
  input.addEventListener("change", () => {
    if (input.files && input.files[0]) selectFile(input.files[0])
  })

  const zone = h("div", { class: "drop" }, [
    h("div", { text: "点击或拖拽文件到此处" }),
    h("div", { class: "drop-hint", text: "上传后得到一条永久链接" }),
    input,
  ])
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

function chainSelector(): HTMLElement {
  const mk = (value: Chain, label: string) => {
    const b = h("r-button", {
      type: chain === value ? "primary" : "",
      text: label,
    })
    b.addEventListener("click", () => {
      chain = value
      selectFile(file!)
    })
    return b
  }
  return h("div", { class: "row" }, [mk("arweave", "Arweave"), mk("irys", "Irys")])
}

function selectFile(f: File): void {
  file = f
  const uploadBtn = h("r-button", { type: "primary", text: "上传并生成永久链接" })
  uploadBtn.addEventListener("click", () => void doUpload())

  uploadPanel.replaceChildren(
    h("div", { class: "space" }, [
      h("div", { class: "row" }, [
        h("div", { class: "link-meta" }, [
          h("div", { class: "link-name", text: f.name }),
          h("div", { class: "muted", text: fmtSize(f.size) }),
        ]),
      ]),
      file ? chainSelector() : h("span"),
      h("div", { class: "space" }, [uploadBtn]),
    ]),
  )
}

async function doUpload(): Promise<void> {
  if (!file) return
  if (chain === "arweave" && !address) {
    alert("请先连接 Arweave 钱包")
    return
  }

  let evmProvider: unknown
  if (chain === "irys") {
    try {
      evmProvider = await resolveEvmProvider()
    } catch (e) {
      uploadPanel.replaceChildren(
        h("div", { class: "space muted", text: (e as Error).message }),
      )
      return
    }
  }

  const progress = h("r-progress", { total: "100" })
  ;(progress as unknown as { percent: string }).percent = "0"
  const stage = h("div", { class: "muted space", text: "准备中…" })
  uploadPanel.replaceChildren(h("div", { class: "space" }, [stage, progress]))

  try {
    let record: AssetRecord
    if (chain === "irys") {
      record = await uploadIrys(
        file,
        {
          onProgress: (p) => {
            stage.textContent = p.stage
            ;(progress as unknown as { percent: string }).percent = String(
              Math.round(p.progress),
            )
          },
        },
        evmProvider,
      )
    } else {
      record = await uploadArweave(file, address!, {
        onProgress: (p) => {
          stage.textContent = p.stage
          ;(progress as unknown as { percent: string }).percent = String(
            Math.round(p.progress),
          )
        },
      })
    }
    await cacheAsset(record)
    showResult(record)
    file = null
    void refreshLinks()
  } catch (e) {
    uploadPanel.replaceChildren(
      h("div", { class: "space muted", text: `上传失败：${(e as Error).message}` }),
    )
  }
}

// Pick the EVM wallet to pay Irys with (EIP-6963). One → use it; many → let the
// user choose; none → error.
async function resolveEvmProvider(): Promise<unknown> {
  const wallets = await discoverEvmWallets()
  if (wallets.length === 0) {
    throw new Error("未检测到 EVM 钱包（如 MetaMask）——Irys 需要它来支付上传")
  }
  if (wallets.length === 1) return wallets[0].provider
  return chooseWallet(wallets)
}

function chooseWallet(wallets: EvmWallet[]): Promise<unknown> {
  return new Promise((resolve) => {
    const buttons = wallets.map((w) => {
      const b = h("r-button", { text: w.info.name })
      b.addEventListener("click", () => resolve(w.provider))
      return b
    })
    uploadPanel.replaceChildren(
      h("div", { class: "space" }, [
        h("div", { class: "muted", text: "选择用于 Irys 付费的 EVM 钱包：" }),
        h("div", { class: "row space" }, buttons),
      ]),
    )
  })
}

function showResult(record: AssetRecord): void {
  const link = h("r-link", { href: record.url, text: record.url })
  const copy = h("r-button", { text: "复制" })
  copy.addEventListener("click", () => {
    void navigator.clipboard.writeText(record.url)
    copy.textContent = "已复制"
    setTimeout(() => (copy.textContent = "复制"), 1500)
  })
  uploadPanel.replaceChildren(
    h("div", { class: "space" }, [
      h("div", { class: "muted", text: "永久链接已生成：" }),
      h("div", { class: "row space" }, [link, copy]),
    ]),
  )
}

// ── My links ─────────────────────────────────────────────────────────────
async function refreshLinks(): Promise<void> {
  // Local cache is shown first (instant); then merge chain history from both
  // networks (backward compatible): Arweave by AR address, Irys by EVM address.
  renderLinks(await cachedAssets())

  if (address) {
    try {
      await cacheAssets(await listArweaveByOwner(address))
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
  renderLinks(await cachedAssets())
}

function renderLinks(records: AssetRecord[]): void {
  if (records.length === 0) {
    linksEl.replaceChildren(
      h("div", { class: "muted", text: "还没有链接。上传一个文件试试。" }),
    )
    return
  }
  linksEl.replaceChildren(
    ...records.map((r) => {
      const open = h("r-link", { href: r.url, text: "打开" })
      const copy = h("r-button", { type: "text", text: "复制" })
      copy.addEventListener("click", () => {
        void navigator.clipboard.writeText(r.url)
        copy.textContent = "已复制"
        setTimeout(() => (copy.textContent = "复制"), 1500)
      })
      return h("div", { class: "link-item" }, [
        h("div", { class: "link-meta" }, [
          h("div", { class: "link-name", text: r.fileName }),
          h("div", { class: "muted", text: fmtSize(r.size) }),
        ]),
        h("div", { class: "row" }, [
          h("span", { class: "badge", text: r.chain }),
          open,
          copy,
        ]),
      ])
    }),
  )
}
