import { createRoot } from "react-dom/client"
import { StrictMode } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Buffer } from "buffer"
import { Providers } from "./providers"
import "./index.css"
import "./i18n/config"
import Home from "./routes/home"
import Upload from "./routes/upload"
import Dashboard from "./routes/dashboard"
import Account from "./routes/account"
import Settings from "./routes/settings"
import NotFound from "./routes/not-found"
import ResourceByOwnerTx from "./routes/resource-by-owner-tx"
import DownloadPage from "./routes/download"
import { initDatabaseWithSchema } from "./lib/database"

if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer
}

// 初始化数据库
initDatabaseWithSchema()
  .then(() => {
    const rootElement = document.getElementById("root")
    if (!rootElement) {
      throw new Error("Root element not found")
    }

    const root = createRoot(rootElement)
    root.render(
      <StrictMode>
        <BrowserRouter basename="/aryxn/">
          <Providers>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/account" element={<Account />} />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="/data/:ownerAddress/:txId"
                element={<ResourceByOwnerTx />}
              />
              <Route
                path="/download/:ownerAddress/:txId"
                element={<DownloadPage />}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Providers>
        </BrowserRouter>
      </StrictMode>,
    )
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error)
    // Render error UI
    const rootElement = document.getElementById("root")
    if (rootElement) {
      rootElement.innerHTML =
        "<div style='padding: 20px; color: red;'>Failed to initialize database. Please refresh the page.</div>"
    }
  })
