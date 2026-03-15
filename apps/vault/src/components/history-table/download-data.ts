import { arweave } from "@/lib/storage"
import {
  getCachedResource,
  getCachedResourceFile,
  upsertCachedResource,
  upsertCachedResourceFromStream,
} from "@/lib/file"
import {
  getDownloadGateways,
  getPrimaryGatewayUrl,
} from "@/lib/storage/gateways"

/**
 * 抑制 SDK 分块下载相关的错误和警告
 */
function suppressChunkErrors() {
  const originalError = console.error
  const originalWarn = console.warn
  const suppressedMessages: string[] = []

  console.error = (...args: any[]) => {
    const message = args.join(" ")
    if (
      message.includes("[chunk]") ||
      message.includes("Failed to fetch chunk") ||
      message.includes("Falling back to gateway cache") ||
      message.includes("Error while trying to download chunked data") ||
      message.includes("Couldn't complete data download")
    ) {
      suppressedMessages.push(message)
      return
    }
    originalError.apply(console, args)
  }

  console.warn = (...args: any[]) => {
    const message = args.join(" ")
    if (
      message.includes("[chunk]") ||
      message.includes("Failed to fetch chunk") ||
      message.includes("Falling back to gateway cache")
    ) {
      suppressedMessages.push(message)
      return
    }
    originalWarn.apply(console, args)
  }

  return {
    restore: () => {
      console.error = originalError
      console.warn = originalWarn
      return suppressedMessages
    },
  }
}

/**
 * 获取 transaction 元数据
 */
export async function getTransactionMetadata(txId: string) {
  const suppress = suppressChunkErrors()

  try {
    const transaction = await arweave.transactions.get(txId)
    const expectedDataSize = parseInt((transaction as any).data_size || "0", 10)
    return { transaction, expectedDataSize }
  } catch (error) {
    console.warn("Failed to get transaction metadata:", error)
    return { transaction: null, expectedDataSize: 0 }
  } finally {
    const suppressedMessages = suppress.restore()
    if (suppressedMessages.length > 0) {
      console.log(
        `[Info] SDK attempted chunked download (${suppressedMessages.length} suppressed messages). Using direct fetch instead.`,
      )
    }
  }
}

/**
 * 从多个网关尝试下载数据
 */
export async function fetchDataFromGateways(
  txId: string,
  expectedDataSize: number,
  storageType: "arweave" | "irys" = "arweave",
  onProgress?: (loaded: number, total: number | null) => void,
  signal?: AbortSignal,
): Promise<Uint8Array | null> {
  const gateways = getDownloadGateways(storageType)

  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}/${txId}`, {
        signal,
        headers: {
          Accept: "application/octet-stream",
        },
      })

      if (response.ok) {
        const headerSize = response.headers.get("content-length")
        const fallbackTotal = headerSize ? Number(headerSize) : null
        const total = expectedDataSize > 0 ? expectedDataSize : fallbackTotal

        if (response.body) {
          const reader = response.body.getReader()
          const chunks: Uint8Array[] = []
          let loaded = 0

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (!value || value.length === 0) continue

            const safeChunk = new Uint8Array(value.length)
            safeChunk.set(value)
            chunks.push(safeChunk)
            loaded += safeChunk.length
            onProgress?.(loaded, total)
          }

          const fetchedData = new Uint8Array(loaded)
          let offset = 0
          for (const chunk of chunks) {
            fetchedData.set(chunk, offset)
            offset += chunk.length
          }

          console.log(`Fetched from ${gateway}:`, {
            fetchedLength: fetchedData.length,
            expectedLength: expectedDataSize,
            match:
              expectedDataSize === 0 || fetchedData.length === expectedDataSize,
          })

          if (
            expectedDataSize === 0 ||
            fetchedData.length === expectedDataSize
          ) {
            console.log(`Successfully fetched data from ${gateway}`)
            return fetchedData
          }

          console.warn(
            `Data length mismatch from ${gateway}: expected ${expectedDataSize}, got ${fetchedData.length}`,
          )
          continue
        }

        const buffer = await response.arrayBuffer()
        const fetchedData = new Uint8Array(buffer)
        onProgress?.(fetchedData.length, total)

        // 检查数据长度
        console.log(`Fetched from ${gateway}:`, {
          fetchedLength: fetchedData.length,
          expectedLength: expectedDataSize,
          match:
            expectedDataSize === 0 || fetchedData.length === expectedDataSize,
        })

        // 如果数据长度匹配或没有期望长度，使用这个数据
        if (expectedDataSize === 0 || fetchedData.length === expectedDataSize) {
          console.log(`Successfully fetched data from ${gateway}`)
          return fetchedData
        } else {
          console.warn(
            `Data length mismatch from ${gateway}: expected ${expectedDataSize}, got ${fetchedData.length}`,
          )
        }
      }
    } catch (gatewayError) {
      console.warn(`Failed to fetch from ${gateway}:`, gatewayError)
      continue
    }
  }

  return null
}

async function cacheFromGatewayStream(
  txId: string,
  expectedDataSize: number,
  storageType: "arweave" | "irys",
  options: {
    ownerAddress: string
    isEncrypted?: boolean
    mimeType?: string
    onProgress?: (loaded: number, total: number | null) => void
    signal?: AbortSignal
  },
): Promise<Uint8Array | null> {
  const gateways = getDownloadGateways(storageType)

  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}/${txId}`, {
        signal: options.signal,
        headers: {
          Accept: "application/octet-stream",
        },
      })

      if (!response.ok) {
        continue
      }

      if (response.body) {
        const streamedSize = await upsertCachedResourceFromStream({
          ownerAddress: options.ownerAddress,
          txId,
          mimeType: options.mimeType || null,
          storageType,
          isEncrypted: options.isEncrypted === true,
          stream: response.body,
          onProgress: (loaded) => {
            options.onProgress?.(
              loaded,
              expectedDataSize > 0 ? expectedDataSize : null,
            )
          },
        })

        if (expectedDataSize > 0 && streamedSize !== expectedDataSize) {
          console.warn("Streamed cache size mismatch; trying next gateway", {
            txId,
            expectedDataSize,
            streamedSize,
            gateway,
          })
          continue
        }

        const cached = await getCachedResource(options.ownerAddress, txId)
        if (cached) {
          return cached.payload
        }
      }

      const fallbackBuffer = await response.arrayBuffer()
      const fallbackData = new Uint8Array(fallbackBuffer)

      if (expectedDataSize > 0 && fallbackData.length !== expectedDataSize) {
        console.warn("Fallback download size mismatch; trying next gateway", {
          txId,
          expectedDataSize,
          fetchedLength: fallbackData.length,
          gateway,
        })
        continue
      }

      await upsertCachedResource({
        ownerAddress: options.ownerAddress,
        txId,
        mimeType: options.mimeType || null,
        storageType,
        isEncrypted: options.isEncrypted === true,
        payload: fallbackData,
      })

      return fallbackData
    } catch (error) {
      console.warn(`Failed to stream cache from ${gateway}:`, error)
      continue
    }
  }

  return null
}

async function cacheFileFromGatewayStream(
  txId: string,
  expectedDataSize: number,
  storageType: "arweave" | "irys",
  options: {
    ownerAddress: string
    isEncrypted?: boolean
    mimeType?: string
    onProgress?: (loaded: number, total: number | null) => void
    signal?: AbortSignal
  },
): Promise<File | null> {
  const gateways = getDownloadGateways(storageType)

  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}/${txId}`, {
        signal: options.signal,
        headers: {
          Accept: "application/octet-stream",
        },
      })

      if (!response.ok || !response.body) {
        continue
      }

      const streamedSize = await upsertCachedResourceFromStream({
        ownerAddress: options.ownerAddress,
        txId,
        mimeType: options.mimeType || null,
        storageType,
        isEncrypted: options.isEncrypted === true,
        stream: response.body,
        onProgress: (loaded) => {
          options.onProgress?.(
            loaded,
            expectedDataSize > 0 ? expectedDataSize : null,
          )
        },
      })

      if (expectedDataSize > 0 && streamedSize !== expectedDataSize) {
        console.warn("Streamed cache size mismatch; trying next gateway", {
          txId,
          expectedDataSize,
          streamedSize,
          gateway,
        })
        continue
      }

      const cachedFile = await getCachedResourceFile(options.ownerAddress, txId)
      if (cachedFile) {
        return cachedFile
      }
    } catch (error) {
      console.warn(`Failed to stream file cache from ${gateway}:`, error)
      continue
    }
  }

  return null
}

/**
 * 使用 SDK 的 getData 方法下载数据（回退方案）
 */
export async function fetchDataWithSDK(
  txId: string,
  expectedDataSize: number,
): Promise<Uint8Array | null> {
  const suppress = suppressChunkErrors()

  try {
    const transactionData = (await arweave.transactions.getData(txId, {
      decode: true,
      string: false,
    })) as Uint8Array

    // 检查数据长度是否匹配
    console.log("SDK getData result:", {
      fetchedLength: transactionData.length,
      expectedLength: expectedDataSize,
      match: transactionData.length === expectedDataSize,
    })

    // 如果数据长度匹配或没有期望长度，使用这个数据
    if (expectedDataSize === 0 || transactionData.length === expectedDataSize) {
      console.log("Successfully fetched data using SDK getData method")
      return transactionData
    } else {
      console.warn(
        `SDK getData length mismatch: expected ${expectedDataSize}, got ${transactionData.length}`,
      )
      // 即使长度不匹配，也返回数据作为回退
      return transactionData
    }
  } catch (sdkError) {
    const suppressedMessages = suppress.restore()
    if (suppressedMessages.length > 0) {
      console.log(
        `SDK getData attempted chunked download but fell back (${suppressedMessages.length} suppressed chunk errors). This is normal for large files.`,
      )
    }
    console.warn("SDK getData failed:", sdkError)
    return null
  } finally {
    suppress.restore()
  }
}

/**
 * 下载 transaction 数据（主函数）
 */
export async function downloadTransactionData(
  txId: string,
  expectedDataSize: number = 0,
  storageType: "arweave" | "irys" = "arweave",
  options?: {
    ownerAddress?: string
    isEncrypted?: boolean
    mimeType?: string
    onProgress?: (loaded: number, total: number | null) => void
    signal?: AbortSignal
  },
): Promise<Uint8Array> {
  if (options?.ownerAddress) {
    const cached = await getCachedResource(options.ownerAddress, txId)
    if (cached) {
      if (
        expectedDataSize === 0 ||
        cached.payload.length === expectedDataSize
      ) {
        options.onProgress?.(
          cached.payload.length,
          expectedDataSize > 0 ? expectedDataSize : cached.payload.length,
        )
        return cached.payload
      }
      // Ignore stale cache entry and continue with network fetch.
      console.warn("Cached resource size mismatch; falling back to network", {
        txId,
        expectedDataSize,
        cachedSize: cached.payload.length,
      })
    }

    const streamed = await cacheFromGatewayStream(
      txId,
      expectedDataSize,
      storageType,
      {
        ownerAddress: options.ownerAddress,
        isEncrypted: options.isEncrypted,
        mimeType: options.mimeType,
        onProgress: options.onProgress,
        signal: options.signal,
      },
    )

    if (streamed) {
      return streamed
    }
  }

  // 方法 1: 优先尝试直接通过网关获取
  let data = await fetchDataFromGateways(
    txId,
    expectedDataSize,
    storageType,
    options?.onProgress,
    options?.signal,
  )

  // 方法 2: 如果直接 fetch 失败，尝试使用 SDK 的 getData 方法 (Only fallback to SDK for Arweave data, SDK breaks on Irys)
  if (!data && storageType === "arweave") {
    data = await fetchDataWithSDK(txId, expectedDataSize)
  }

  if (!data) {
    throw new Error(
      `Failed to fetch complete data from all gateways. Expected size: ${expectedDataSize} bytes. ` +
        `This might be because the transaction data hasn't been fully seeded to the network yet. ` +
        `Please try again later or check the transaction status at ${getPrimaryGatewayUrl(storageType, txId)}`,
    )
  }

  // 最终检查数据长度
  if (expectedDataSize > 0 && data.length !== expectedDataSize) {
    console.error("Data integrity check failed:", {
      expected: expectedDataSize,
      actual: data.length,
      difference: expectedDataSize - data.length,
    })
    throw new Error(
      `Downloaded data is incomplete. Expected ${expectedDataSize} bytes, got ${data.length} bytes. ` +
        `The file may not be fully seeded to the network yet. Please try again later.`,
    )
  }

  console.log("Data integrity check passed:", {
    length: data.length,
    expected: expectedDataSize,
  })

  if (options?.ownerAddress) {
    try {
      await upsertCachedResource({
        ownerAddress: options.ownerAddress,
        txId,
        mimeType: options.mimeType || null,
        storageType,
        isEncrypted: options.isEncrypted === true,
        payload: data,
      })
    } catch (cacheError) {
      console.warn("Failed to persist resource cache:", cacheError)
    }
  }

  return data
}

export async function downloadTransactionFile(
  txId: string,
  expectedDataSize: number = 0,
  storageType: "arweave" | "irys" = "arweave",
  options?: {
    ownerAddress?: string
    isEncrypted?: boolean
    mimeType?: string
    fileName?: string
    onProgress?: (loaded: number, total: number | null) => void
    signal?: AbortSignal
  },
): Promise<File> {
  if (options?.ownerAddress) {
    const cachedFile = await getCachedResourceFile(options.ownerAddress, txId)
    if (
      cachedFile &&
      (expectedDataSize === 0 || cachedFile.size === expectedDataSize)
    ) {
      options?.onProgress?.(
        cachedFile.size,
        expectedDataSize > 0 ? expectedDataSize : cachedFile.size,
      )
      return cachedFile
    }

    const streamedFile = await cacheFileFromGatewayStream(
      txId,
      expectedDataSize,
      storageType,
      {
        ownerAddress: options.ownerAddress,
        isEncrypted: options.isEncrypted,
        mimeType: options.mimeType,
        onProgress: options.onProgress,
        signal: options.signal,
      },
    )
    if (streamedFile) {
      return streamedFile
    }
  }

  const data = await downloadTransactionData(
    txId,
    expectedDataSize,
    storageType,
    {
      ownerAddress: options?.ownerAddress,
      isEncrypted: options?.isEncrypted,
      mimeType: options?.mimeType,
      onProgress: options?.onProgress,
      signal: options?.signal,
    },
  )

  return new File([data as BlobPart], options?.fileName || txId, {
    type: options?.mimeType || "application/octet-stream",
  })
}
