// Decrypt viewer — opened via a shareable encrypted link
// (`#/view/<chain>/<txId>/<key>`). The key lives in the URL fragment (never sent
// to a server); this fetches the ciphertext from the gateway and decrypts it
// client-side, then offers a download (and an inline preview for images).
//
// Two-channel (`p1.`) links additionally require a password: the fragment only
// carries half the key material, so decryption can't start until the user
// types the password that was shared out-of-band.

import { View, Div, createRoot } from "ranui/builder"
import { t } from "../i18n"
import { decryptAsset, type Chain } from "../storage"

export function renderViewer(
  root: HTMLElement,
  chain: Chain,
  txId: string,
  payload: string,
): void {
  createRoot(() => {
    const body = Div().build()

    root.replaceChildren(
      Div()
        .class("wrap")
        .children(
          Div()
            .class("hero reveal")
            .children(
              Div().class("hero-grid"),
              View("h1").text(t("view.title")),
            ),
          Div().class("uploader reveal d1").children(body),
        )
        .build(),
    )

    /** Shared success renderer — used by both the plain and password-mode
     * decrypt paths so the "here's your file" UI stays in one place. */
    const showDecrypted = (
      bytes: Uint8Array,
      fileName: string,
      contentType: string,
    ): void => {
      const url = URL.createObjectURL(
        new Blob([bytes as BlobPart], { type: contentType }),
      )
      const download = View("r-button")
        .attr("type", "primary")
        .text(t("view.download"))
        .build()
      download.addEventListener("click", () => {
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        a.click()
      })
      body.replaceChildren(
        Div()
          .class("space")
          .children(
            Div().class("link-name").text(fileName),
            contentType.startsWith("image/")
              ? View("img")
                  .attr("src", url)
                  .attr("alt", fileName)
                  .class("preview")
              : null,
            Div().class("space").children(download),
          )
          .build(),
      )
    }

    const raw = decodeURIComponent(payload)
    const needsPassword = raw.startsWith("p1.")

    if (!needsPassword) {
      body.replaceChildren(
        Div().class("muted").text(t("view.decrypting")).build(),
      )
      void (async () => {
        try {
          const { bytes, fileName, contentType } = await decryptAsset(
            chain,
            txId,
            payload,
          )
          showDecrypted(bytes, fileName, contentType)
        } catch (e) {
          body.replaceChildren(
            Div()
              .class("muted")
              .text(`${t("view.failed")} ${(e as Error).message}`)
              .build(),
          )
        }
      })()
      return
    }

    // ── Password mode ────────────────────────────────────────────────────
    const pwEl = View<HTMLInputElement>("r-input")
      .attr("type", "password")
      .attr("placeholder", () => t("view.password"))
      .build()
    const openBtn = View("r-button")
      .attr("type", "primary")
      .text(() => t("view.open"))
      .build()
    const errEl = Div().class("muted").build()

    const setBusy = (busy: boolean): void => {
      if (busy) {
        openBtn.setAttribute("disabled", "true")
        openBtn.textContent = t("view.decrypting")
      } else {
        openBtn.removeAttribute("disabled")
        openBtn.textContent = t("view.open")
      }
    }

    // Re-entrancy guard: the real concurrency gate (the r-button's `disabled`
    // attr does NOT block native clicks, and the Enter handler bypasses the
    // button entirely). A plain closure boolean, checked inside attemptOpen,
    // covers rapid clicks AND Enter.
    let busy = false

    const attemptOpen = (): void => {
      if (busy) return
      const password = pwEl.value ?? ""
      if (!password.trim()) {
        // Empty submit: hint instead of a wasted Argon2id run that would throw
        // PASSWORD_REQUIRED and leave the user staring at nothing.
        errEl.textContent = t("view.needsPassword")
        return
      }
      busy = true
      setBusy(true)
      errEl.textContent = ""
      void (async () => {
        try {
          const { bytes, fileName, contentType } = await decryptAsset(
            chain,
            txId,
            payload,
            password,
          )
          showDecrypted(bytes, fileName, contentType)
        } catch (e) {
          const msg = (e as Error).message
          if (msg.includes("MALFORMED_LINK")) {
            // Not retryable — the link itself is broken. Keep the button
            // visually disabled (the busy flag is cleared below regardless).
            errEl.textContent = t("view.malformed")
          } else if (msg.includes("memory") || msg.includes("allocation")) {
            errEl.textContent = t("view.lowMemory")
            setBusy(false)
          } else if (msg.includes("PASSWORD_REQUIRED")) {
            // Guarded above, so effectively unreachable — keep a message so it's
            // never a silent no-op if it somehow fires.
            errEl.textContent = t("view.needsPassword")
            setBusy(false)
          } else {
            errEl.textContent = t("view.wrongPassword")
            setBusy(false)
          }
        } finally {
          busy = false // always clear the concurrency flag so we never wedge
        }
      })()
    }

    openBtn.addEventListener("click", attemptOpen)
    pwEl.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") attemptOpen()
    })

    body.replaceChildren(
      Div()
        .class("space")
        .children(
          Div().class("muted").text(t("view.needsPassword")),
          Div().class("acct-field").children(pwEl, openBtn),
          errEl,
        )
        .build(),
    )
  })
}

/** Router entry: the hash router passes { chain, txId, payload }. */
export function renderViewerPage(host: HTMLElement, params: Record<string, string>): void {
  renderViewer(host, params.chain as Chain, params.txId, params.payload)
}
