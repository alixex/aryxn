// App shell: the persistent nav (brand, theme switch, language toggle, account
// switcher) plus the router outlet. Mounted once at startup by main.ts — the
// nav survives route changes; only the outlet's content is swapped by the
// router (see router.ts).
//
// Account switcher: ranui ships both `r-dropdown` and `r-popover`, but neither
// has a documented trigger/panel contract or usage example in this version
// (no demo markup, MutationObserver-driven content-watching internals, and the
// typings alone don't show what slot/child shape they expect). Rather than
// guess at an unfamiliar component's DOM contract, this uses a minimal custom
// toggle: a trigger button flips a signal, a `createEffect` toggles the
// `.hidden` utility class (already defined in index.html) on an absolutely
// positioned panel, and a document-level click listener closes it on an
// outside click. Simple, predictable, and easy to verify.

import { View, Div, Span, Header, signal, createEffect, createRoot } from "ranui/builder"
import { setTheme } from "ranui/theme"
import { t, i18n } from "./i18n"
import { mountRouter, navigate } from "./router"
import { renderHome } from "./pages/home"
import { renderAccountsPage } from "./pages/accounts"
import { renderViewerPage } from "./pages/viewer"
import { accounts, activeAccount, setActive, type AccountRecord } from "./accounts"
import { balances, refreshBalance } from "./balances"

function typeLabel(a: AccountRecord): string {
  if (a.type === "local") return t("account.typeLocal")
  if (a.type === "wander") return t("account.typeWander")
  return t("account.typeEvm")
}

/** Trigger label: connect prompt, "<label>" (+ balance if known), or "<label> · locked". */
function triggerText(
  acc: AccountRecord | null,
  bal: Record<string, string | null>,
): string {
  if (!acc) return t("connect")
  if (!acc.address) return `${acc.label} · ${t("account.locked")}`
  const b = bal[acc.address]
  return b ? `${acc.label} · ${b}` : acc.label
}

function switcherRow(
  a: AccountRecord,
  active: string | null,
  bal: Record<string, string | null>,
  close: () => void,
): HTMLElement {
  const row = Div()
    .class(a.id === active ? "switcher-item active" : "switcher-item")
    .children(
      Div().class(a.id === active ? "switcher-dot active" : "switcher-dot"),
      Div()
        .class("switcher-meta")
        .children(
          Div().class("switcher-label").text(a.label),
          Span().class("switcher-type").text(typeLabel(a)),
        ),
      Span()
        .class("switcher-balance")
        .text(a.address ? (bal[a.address] ?? "—") : t("account.locked")),
    )
    .build()

  row.addEventListener("click", () => {
    close()
    void setActive(a.id).catch((e) => {
      if (String((e as Error).message).includes("VAULT_LOCKED")) navigate("/accounts")
      else console.error(e)
    })
  })
  return row
}

function buildSwitcher(): HTMLElement {
  const [open, setOpen] = signal(false)
  const close = (): void => setOpen(false)

  const trigger = View("r-button")
    .attr("type", "contrast")
    .text(() => triggerText(activeAccount(), balances()))
    .build()

  const panelList = Div().class("switcher-list").build()
  const manageRow = Div()
    .class("switcher-item switcher-manage")
    .text(() => `${t("account.manage")} →`)
    .build()
  manageRow.addEventListener("click", () => {
    close()
    navigate("/accounts")
  })

  const panel = Div()
    .class("switcher-panel hidden")
    .children(panelList, manageRow)
    .build()

  const wrap = Div().class("switcher").children(trigger, panel).build()

  trigger.addEventListener("click", (e) => {
    e.stopPropagation()
    setOpen(!open())
  })
  document.addEventListener("click", (e) => {
    if (open() && !wrap.contains(e.target as Node)) close()
  })

  createEffect(() => {
    panel.classList.toggle("hidden", !open())
  })

  // Rebuild the rows whenever the account book, active id, or balances change.
  createEffect(() => {
    const accs = accounts()
    const active = activeAccount()?.id ?? null
    const bal = balances()
    panelList.replaceChildren(
      ...(accs.length
        ? accs.map((a) => switcherRow(a, active, bal, close))
        : [
            Div()
              .class("switcher-item switcher-empty")
              .text(() => t("account.empty"))
              .build(),
          ]),
    )
  })

  // Populate balances for every known account (initial mount + as new
  // accounts show up); refreshBalance is a no-op for locked/addressless ones.
  createEffect(() => {
    for (const acc of accounts()) void refreshBalance(acc)
  })

  return wrap
}

/** Mount the persistent shell (nav + router outlet) into `root`. */
export function mountShell(root: HTMLElement): void {
  createRoot(() => {
    const brand = Div().class("brand").text("aryxn").build()
    brand.addEventListener("click", () => navigate("/"))

    const themeSwitch = View("r-theme-switch")
      .attr("label-system", t("theme.system"))
      .attr("label-light", t("theme.light"))
      .attr("label-dark", t("theme.dark"))
      .build()
    themeSwitch.addEventListener("change", (e) => {
      const th = (e as CustomEvent<{ theme: string }>).detail?.theme
      if (th) setTheme(th as "system" | "light" | "dark")
    })

    const langBtn = View("r-button")
      .attr("type", "text")
      .text(t("lang.toggle"))
      .on("click", () => {
        i18n.setLocale(i18n.getLocale() === "en" ? "zh-CN" : "en")
        location.reload()
      })
      .build()

    const switcher = buildSwitcher()

    const nav = Header()
      .class("nav")
      .children(
        Div()
          .class("nav-inner")
          .children(
            brand,
            Div().class("nav-actions").children(themeSwitch, langBtn, switcher),
          ),
      )
      .build()

    const outlet = Div().build()

    root.replaceChildren(nav, outlet)

    const onScroll = (): void => {
      nav.classList.toggle("scrolled", window.scrollY > 4)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()

    mountRouter(
      outlet,
      [
        { path: "/", render: renderHome },
        { path: "/accounts", render: renderAccountsPage },
      ],
      renderViewerPage,
      renderHome,
    )
  })
}
