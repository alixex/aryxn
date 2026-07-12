// Decrypt viewer — opened via a shareable encrypted link
// (`#/view/<chain>/<txId>/<key>`). The key lives in the URL fragment (never sent
// to a server); this fetches the ciphertext from the gateway and decrypts it
// client-side, then offers a download (and an inline preview for images).

import { View, Div, createRoot } from "ranui/builder"
import { t } from "../i18n"
import { decryptAsset, type Chain } from "../storage"

export function renderViewer(
  root: HTMLElement,
  chain: Chain,
  txId: string,
  keyB64: string,
): void {
  createRoot(() => {
    const body = Div().build()
    body.replaceChildren(
      Div().class("muted").text(t("view.decrypting")).build(),
    )

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

    void (async () => {
      try {
        const { bytes, fileName, contentType } = await decryptAsset(
          chain,
          txId,
          keyB64,
        )
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
      } catch (e) {
        body.replaceChildren(
          Div()
            .class("muted")
            .text(`${t("view.failed")} ${(e as Error).message}`)
            .build(),
        )
      }
    })()
  })
}

/** Router entry: the hash router passes { chain, txId, payload }. */
export function renderViewerPage(host: HTMLElement, params: Record<string, string>): void {
  renderViewer(host, params.chain as Chain, params.txId, params.payload)
}
