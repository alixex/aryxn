// Account management page — list, switch, balance, usage, backup, remove.
// Mirrors the reactive patterns in pages/home.ts (ranui/builder + signals).

import { View, Div, Span, signal, createEffect, createRoot } from "ranui/builder"
import { t } from "../i18n"
import {
  accounts,
  activeId,
  setActive,
  addLocal,
  importLocal,
  connectWander,
  connectEvm,
  removeAccount,
  unlockVault,
  lockVault,
  isVaultUnlocked,
  exportKeyfile,
  exportEncrypted,
  type AccountRecord,
} from "../accounts"
import { balances, refreshBalance, usageFor, type Usage } from "../balances"
import { cachedAssets } from "../cache"
import { hasArweaveWallet, getConnectedEvmAddress } from "../wallet"

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

function shorten(address: string): string {
  return address.length > 10
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address
}

/** Download a text blob as a file (keyfile / encrypted-export backups). */
function downloadText(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function copyButton(text: string): HTMLElement {
  const btn = View("r-button")
    .attr("type", "text")
    .text(() => t("action.copy"))
    .on("click", () => {
      void navigator.clipboard.writeText(text)
      btn.textContent = t("action.copied")
      toast("success", t("toast.copied"))
      setTimeout(() => (btn.textContent = t("action.copy")), 1500)
    })
    .build()
  return btn
}

function typeLabel(a: AccountRecord): string {
  if (a.type === "local") return t("account.typeLocal")
  if (a.type === "wander") return t("account.typeWander")
  return t("account.typeEvm")
}

// address → usage snapshot (files count + total bytes), filled in as each
// account's cached assets are read. Reactive so rows update once ready.
const [usage, setUsage] = signal<Record<string, Usage>>({})

// ── Add-actions handlers ────────────────────────────────────────────────────
async function handleCreateLocal(pwEl: HTMLInputElement): Promise<void> {
  try {
    await addLocal(pwEl.value || undefined)
    pwEl.value = ""
    toast("success", t("toast.created"))
  } catch (e) {
    toast("error", (e as Error).message)
  }
}

async function handleImport(
  fileEl: HTMLInputElement,
  pwEl: HTMLInputElement,
): Promise<void> {
  const f = fileEl.files?.[0]
  if (!f) return
  try {
    const text = await f.text()
    await importLocal(text, pwEl.value || undefined)
    fileEl.value = ""
    pwEl.value = ""
    toast("success", t("toast.imported"))
  } catch (e) {
    toast("error", (e as Error).message)
  }
}

async function handleConnectWander(): Promise<void> {
  try {
    await connectWander()
    toast("success", t("toast.connected"))
  } catch (e) {
    toast("error", (e as Error).message)
  }
}

// Simplified v1: no multi-wallet picker. discoverEvmWallets() (EIP-6963) does
// not itself return an address, and prompting a fresh connection would need an
// eth_requestAccounts round trip through a chosen provider. We reuse the
// passive getConnectedEvmAddress() (eth_accounts, never prompts) — if the
// browser already has an authorized EVM account, add it; otherwise ask the
// user to connect via their wallet extension first.
async function handleConnectEvm(): Promise<void> {
  try {
    const addr = await getConnectedEvmAddress()
    if (addr) {
      connectEvm(addr)
      toast("success", t("toast.connected"))
    } else {
      toast("error", t("err.noEvmWallet"))
    }
  } catch (e) {
    toast("error", (e as Error).message)
  }
}

async function handleUnlock(pwEl: HTMLInputElement): Promise<void> {
  try {
    await unlockVault(pwEl.value)
    pwEl.value = ""
    toast("success", t("toast.unlocked"))
  } catch (e) {
    toast("error", (e as Error).message)
  }
}

function handleLock(): void {
  lockVault()
  toast("info", t("toast.locked"))
}

function handleExport(a: AccountRecord): void {
  const kf = exportKeyfile(a.id)
  if (kf) downloadText(kf, `aryxn-${a.address.slice(0, 8)}.json`)
  else toast("error", t("account.locked"))
}

async function handleExportEnc(
  a: AccountRecord,
  pwEl: HTMLInputElement,
): Promise<void> {
  try {
    const enc = await exportEncrypted(a.id, pwEl.value)
    if (enc) {
      downloadText(enc, `aryxn-${a.address.slice(0, 8)}.enc.json`)
      pwEl.value = ""
    } else {
      toast("error", t("account.locked"))
    }
  } catch (e) {
    toast("error", (e as Error).message)
  }
}

function handleRemove(a: AccountRecord): void {
  if (confirm(t("account.confirmRemove"))) removeAccount(a.id)
}

function handleRowClick(a: AccountRecord): void {
  void setActive(a.id).catch((e) => {
    const msg = (e as Error).message
    if (msg.includes("VAULT_LOCKED")) toast("info", t("account.unlockFirst"))
    else toast("error", msg)
  })
}

// ── Add-actions area ────────────────────────────────────────────────────────
function renderCreateLocalBlock(accs: AccountRecord[]): HTMLElement | null {
  const noLocal = accs.every((a) => a.type !== "local")
  if (!isVaultUnlocked() && !noLocal) return null
  const pwEl = View<HTMLInputElement>("r-input")
    .attr("type", "password")
    .attr("placeholder", () => t("account.password"))
    .build()
  const btn = View("r-button")
    .attr("type", "primary")
    .text(() => t("account.create"))
    .on("click", () => void handleCreateLocal(pwEl))
    .build()
  return Div()
    .class("acct-group")
    .children(
      Span()
        .class("acct-label")
        .text(() => t("account.create")),
      Div().class("acct-field").children(pwEl, btn).build(),
    )
    .build()
}

function renderImportBlock(): HTMLElement {
  const fileEl = View<HTMLInputElement>("input")
    .attr("type", "file")
    .attr("accept", ".json")
    .build()
  const pwEl = View<HTMLInputElement>("r-input")
    .attr("type", "password")
    .attr("placeholder", () => t("account.password"))
    .build()
  const btn = View("r-button")
    .text(() => t("account.import"))
    .on("click", () => void handleImport(fileEl, pwEl))
    .build()
  return Div()
    .class("acct-group")
    .children(
      Span()
        .class("acct-label")
        .text(() => t("account.import")),
      fileEl,
      Div().class("acct-field").children(pwEl, btn).build(),
    )
    .build()
}

function renderConnectBlock(): HTMLElement {
  const buttons: (HTMLElement | null)[] = []
  if (hasArweaveWallet()) {
    buttons.push(
      View("r-button")
        .text(() => t("account.connectWander"))
        .on("click", () => void handleConnectWander())
        .build(),
    )
  }
  buttons.push(
    View("r-button")
      .text(() => t("account.connectEvm"))
      .on("click", () => void handleConnectEvm())
      .build(),
  )
  return Div().class("acct-group").children(buttons).build()
}

function renderAddActions(accs: AccountRecord[]): HTMLElement {
  const sections = [
    renderCreateLocalBlock(accs),
    renderImportBlock(),
    renderConnectBlock(),
  ].filter((s): s is HTMLElement => s !== null)
  const children: HTMLElement[] = []
  sections.forEach((s, i) => {
    if (i > 0) {
      children.push(
        Div()
          .class("acct-divider")
          .text(() => t("account.or"))
          .build(),
      )
    }
    children.push(s)
  })
  return Div().class("acct-add").children(children).build()
}

// ── Vault banner ─────────────────────────────────────────────────────────────
function renderBanner(accs: AccountRecord[]): HTMLElement | null {
  const hasLocal = accs.some((a) => a.type === "local")
  if (isVaultUnlocked() || !hasLocal) return null
  const pwEl = View<HTMLInputElement>("r-input")
    .attr("type", "password")
    .attr("placeholder", () => t("account.password"))
    .build()
  const btn = View("r-button")
    .attr("type", "primary")
    .text(() => t("account.unlock"))
    .on("click", () => void handleUnlock(pwEl))
    .build()
  return Div()
    .class("acct-banner")
    .children(
      Span().text(() => t("account.unlockVault")),
      Div().class("acct-field").children(pwEl, btn).build(),
    )
    .build()
}

/** Small "Lock vault" control — shown once a local account has been unlocked
 * this session, so the user can clear the in-memory keys without a reload.
 * Reuses the vault-banner styling/slot (mutually exclusive with the unlock
 * banner: one is locked-with-local, the other unlocked-with-local). */
function renderLockControl(accs: AccountRecord[]): HTMLElement | null {
  const hasLocal = accs.some((a) => a.type === "local")
  if (!isVaultUnlocked() || !hasLocal) return null
  const btn = View("r-button")
    .attr("type", "text")
    .text(() => t("account.lock"))
    .on("click", () => handleLock())
    .build()
  return Div().class("acct-banner").children(btn).build()
}

// ── Account list ─────────────────────────────────────────────────────────────
function balanceText(a: AccountRecord, bal: Record<string, string | null>): string {
  if (!a.address) return t("account.locked")
  return bal[a.address] ?? "—"
}

function usageText(a: AccountRecord, use: Record<string, Usage>): string {
  if (!a.address) return "—"
  const u = use[a.address]
  if (!u) return "—"
  return t("account.usage", { count: u.count, size: fmtSize(u.totalBytes) })
}

function renderRowActions(a: AccountRecord): HTMLElement[] {
  const actions: HTMLElement[] = []
  if (a.address) actions.push(copyButton(a.address))
  if (a.type === "local") {
    actions.push(
      View("r-button")
        .attr("type", "text")
        .text(() => t("account.export"))
        .on("click", () => handleExport(a))
        .build(),
    )
    const encPwEl = View<HTMLInputElement>("r-input")
      .attr("type", "password")
      .attr("placeholder", () => t("account.password"))
      .build()
    actions.push(
      Div()
        .class("acct-field")
        .children(
          encPwEl,
          View("r-button")
            .attr("type", "text")
            .text(() => t("account.exportEnc"))
            .on("click", () => void handleExportEnc(a, encPwEl))
            .build(),
        )
        .build(),
    )
  }
  actions.push(
    View("r-button")
      .attr("type", "warning")
      .text(() => t("account.remove"))
      .on("click", () => handleRemove(a))
      .build(),
  )
  return actions
}

function renderRow(
  a: AccountRecord,
  active: string | null,
  bal: Record<string, string | null>,
  use: Record<string, Usage>,
): HTMLElement {
  const row = Div()
    .class(a.id === active ? "acct-row active" : "acct-row")
    .children(
      Div().class(a.id === active ? "acct-dot active" : "acct-dot"),
      Div()
        .class("acct-meta")
        .children(
          Div().class("link-name").text(a.label),
          Div()
            .class("link-sub")
            .children(
              Span().class("acct-badge").text(typeLabel(a)),
              a.address
                ? Span().class("mono").text(shorten(a.address))
                : Span().text(t("account.locked")),
            ),
        ),
      Div().class("acct-balance").text(balanceText(a, bal)),
      Div().class("acct-usage").text(usageText(a, use)),
      Div().class("acct-actions").children(renderRowActions(a)),
    )
    .build()

  row.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null
    if (target?.closest("button, r-button, input, r-input, a")) return
    handleRowClick(a)
  })
  return row
}

function renderList(
  container: HTMLElement,
  accs: AccountRecord[],
  active: string | null,
  bal: Record<string, string | null>,
  use: Record<string, Usage>,
): void {
  if (accs.length === 0) {
    container.replaceChildren(
      Div()
        .class("empty")
        .children(
          Div()
            .class("empty-title")
            .text(() => t("account.empty")),
          Div()
            .class("empty-hint")
            .text(() => t("account.emptyHint")),
        )
        .build(),
    )
    return
  }
  container.replaceChildren(
    ...accs.map((a) => renderRow(a, active, bal, use)),
  )
}

// ── Entry point ──────────────────────────────────────────────────────────────
/** Build the accounts page once inside a reactive scope, into `host`. The
 * router passes a params object as a second argument — ignored here. */
export function renderAccountsPage(host: HTMLElement): void {
  createRoot(() => {
    const addActionsEl = Div().build()
    const bannerEl = Div().build()
    const lockEl = Div().build()
    const listEl = Div().class("links").build()

    // Rebuild the add-actions card + vault banner + lock control whenever the
    // account book changes (covers both CRUD and the address/list backfill
    // that unlockVault triggers — see accounts.ts backfillAddress).
    createEffect(() => {
      const accs = accounts()
      addActionsEl.replaceChildren(renderAddActions(accs))
      const banner = renderBanner(accs)
      bannerEl.replaceChildren(...(banner ? [banner] : []))
      const lock = renderLockControl(accs)
      lockEl.replaceChildren(...(lock ? [lock] : []))
    })

    // Rebuild the row list whenever accounts, the active id, balances, or
    // per-address usage change.
    createEffect(() => {
      const accs = accounts()
      const active = activeId()
      const bal = balances()
      const use = usage()
      renderList(listEl, accs, active, bal, use)
    })

    // Bootstrap balance + usage for every unlocked account, and for any new
    // account that shows up later (creation, import, connect, unlock backfill).
    // Guarded by address so a given account is only fetched once.
    const fetchedUsage = new Set<string>()
    createEffect(() => {
      const accs = accounts()
      for (const acc of accs) {
        if (!acc.address) continue
        void refreshBalance(acc)
        if (!fetchedUsage.has(acc.address)) {
          fetchedUsage.add(acc.address)
          void cachedAssets(acc.address).then((recs) =>
            setUsage((u) => ({ ...u, [acc.address]: usageFor(recs) })),
          )
        }
      }
    })

    host.replaceChildren(
      Div()
        .class("wrap acct-page")
        .children(
          View("h1").text(() => t("account.manage")),
          addActionsEl,
          bannerEl,
          lockEl,
          listEl,
        )
        .build(),
    )
  })
}
