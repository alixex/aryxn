import { useState, useCallback } from "react"
import { estimateArweaveFee } from "@/lib/storage"
import { shouldCompressFile, compressData } from "@/lib/utils"
import { useTranslation } from "@/i18n/config"
import { estimateManifestSize } from "@/lib/file"
import type { PaymentToken } from "@/lib/payment"
import { paymentService } from "@/lib/payment"

export interface FeeEstimate {
  ar: number
  dataSize: number
  originalSize?: number
  compressedSize?: number
  originalFeeAR?: number
  savedFeeAR?: number
  manifestFeeAR?: number // 清单文件费用
  manifestSize?: number // 清单文件大小
  estimatedFeesByToken?: Partial<Record<PaymentToken, number>>
  timestamp?: number // 计算时间戳
}

export function useFeeCalculation() {
  const { t } = useTranslation()
  const [estimatedFee, setEstimatedFee] = useState<FeeEstimate | null>(null)
  const [calculatingFee, setCalculatingFee] = useState(false)
  const [feeError, setFeeError] = useState<string | null>(null)

  const calculateFee = useCallback(
    async (
      file: File,
      encrypt: boolean,
      compress: boolean,
      ownerAddress?: string,
    ) => {
      if (!file) {
        setEstimatedFee(null)
        setFeeError(null)
        return
      }

      setCalculatingFee(true)
      setFeeError(null)
      try {
        // 读取文件内容
        const fileBuffer = await file.arrayBuffer()
        let data = new Uint8Array(fileBuffer)
        const originalSize = data.length
        let compressedSize: number | undefined
        let dataSize = originalSize

        // 1. 计算压缩前的费用（如果启用压缩）
        let originalFeeAR: number | undefined
        if (compress && shouldCompressFile(file.size, file.name, file.type)) {
          try {
            const compressed = await compressData(data)
            // 只有当压缩后确实更小时才使用压缩后的大小
            if (compressed.length < data.length) {
              compressedSize = compressed.length
              // 计算压缩前的费用（考虑加密overhead）
              let originalDataSize = originalSize
              if (encrypt) {
                originalDataSize = originalDataSize + 40
              }
              const originalFee = await estimateArweaveFee(originalDataSize)
              originalFeeAR = originalFee.ar
              dataSize = compressedSize
            }
          } catch (compressionError) {
            console.warn(
              "Compression failed during fee calculation:",
              compressionError,
            )
            // 压缩失败时使用原始大小
          }
        }

        // 2. 加密会增加一些 overhead（nonce + tag），大约增加 40 字节
        // XChaCha20-Poly1305: nonce (24 bytes) + tag (16 bytes) = 40 bytes overhead
        // 注意：压缩后的数据大小已经更新到 dataSize，这里再添加加密overhead
        if (encrypt) {
          dataSize = dataSize + 40
        }

        const fee = await estimateArweaveFee(dataSize)

        // 计算清单文件费用（如果提供了账户地址）
        let manifestFeeAR: number | undefined
        let manifestSize: number | undefined
        if (ownerAddress) {
          try {
            // 估算清单文件大小（包括新上传的文件）
            manifestSize = await estimateManifestSize(ownerAddress, {
              id: "temp-id",
              tx_id: "temp-tx-id",
              file_name: file.name,
              file_hash: "",
              file_size: file.size,
              mime_type: file.type,
              folder_id: null,
              description: null,
              storage_type: "arweave",
              encryption_algo: encrypt ? "XChaCha20-Poly1305" : "none",
              encryption_params: encrypt ? "{}" : "{}",
              version: 1,
              previous_tx_id: null,
              created_at: Date.now(),
              updated_at: Date.now(),
            })
            const manifestFee = await estimateArweaveFee(manifestSize)
            manifestFeeAR = manifestFee.ar
          } catch (error) {
            console.warn("Failed to estimate manifest fee:", error)
            // 清单费用估算失败不影响主费用计算
          }
        }

        // 计算节省的费用
        let savedFeeAR: number | undefined
        if (originalFeeAR !== undefined) {
          savedFeeAR = originalFeeAR - fee.ar
        }

        // 总费用 = 文件费用 + 清单文件费用
        const totalAR = fee.ar + (manifestFeeAR || 0)

        // 计算其它代币的代币费用
        const estimatedFeesByToken: Partial<Record<PaymentToken, number>> = {}
        const tokens: PaymentToken[] = [
          "ETH",
          "SOL",
          "SUI",
          "BTC",
          "USDC",
          "USDT",
        ]

        for (const token of tokens) {
          const estimate = await paymentService.estimateFeeInToken(
            dataSize + (manifestSize || 0),
            token,
          )
          estimatedFeesByToken[token] = estimate.tokenAmount
        }

        setEstimatedFee({
          ar: totalAR,
          dataSize: fee.dataSize,
          originalSize:
            compress && shouldCompressFile(file.size, file.name, file.type)
              ? originalSize
              : undefined,
          compressedSize,
          originalFeeAR,
          savedFeeAR,
          manifestFeeAR,
          manifestSize,
          estimatedFeesByToken,
          timestamp: Date.now(),
        })
        setFeeError(null)
      } catch (error) {
        console.error("Failed to calculate fee:", error)
        setEstimatedFee(null)
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        setFeeError(errorMessage || t("upload.feeCalculationFailed"))
      } finally {
        setCalculatingFee(false)
      }
    },
    [t],
  )

  const calculateBatchFee = useCallback(
    async (
      files: File[],
      encrypt: boolean,
      compress: boolean,
      ownerAddress?: string,
    ) => {
      if (!files || files.length === 0) {
        setEstimatedFee(null)
        setFeeError(null)
        return
      }

      setCalculatingFee(true)
      setFeeError(null)
      try {
        let totalAR = 0
        let totalDataSize = 0
        let totalOriginalSize = 0
        let totalCompressedSize = 0
        let totalOriginalFeeAR = 0
        let totalSavedFeeAR = 0
        let hasCompression = false

        // 逐个计算每个文件的费用并累加
        for (const file of files) {
          const fileBuffer = await file.arrayBuffer()
          let data = new Uint8Array(fileBuffer)
          const originalSize = data.length
          totalOriginalSize += originalSize

          let finalSize = originalSize // 最终用于计算费用的大小（压缩后或原始）
          let wasCompressed = false

          // 1. 如果启用压缩且文件适合压缩，尝试压缩
          if (compress && shouldCompressFile(file.size, file.name, file.type)) {
            try {
              const compressed = await compressData(data)
              if (compressed.length < data.length) {
                finalSize = compressed.length
                wasCompressed = true
                hasCompression = true
              }
            } catch (compressionError) {
              console.warn(
                `Compression failed for file ${file.name}:`,
                compressionError,
              )
              // 压缩失败，使用原始大小
            }
          }

          // 累加压缩后的大小（如果压缩了就用压缩后的大小，否则用原始大小）
          totalCompressedSize += finalSize

          // 2. 计算压缩前的费用（如果启用压缩，需要计算所有文件的原始费用用于对比）
          let originalDataSize = originalSize
          if (encrypt) {
            originalDataSize = originalDataSize + 40
          }
          const originalFee = await estimateArweaveFee(originalDataSize)
          totalOriginalFeeAR += originalFee.ar

          // 3. 加密会增加一些 overhead（nonce + tag），大约增加 40 字节
          let finalDataSize = finalSize
          if (encrypt) {
            finalDataSize = finalDataSize + 40
          }

          // 4. 计算最终费用（使用压缩后的大小或原始大小）
          const fee = await estimateArweaveFee(finalDataSize)
          totalAR += fee.ar
          totalDataSize += fee.dataSize

          // 5. 计算节省的费用（只有被压缩的文件才有节省）
          if (wasCompressed) {
            const savedFeeAR = originalFee.ar - fee.ar
            totalSavedFeeAR += savedFeeAR
          }
        }

        // 计算清单文件费用（如果提供了账户地址）
        // 注意：清单文件是批量更新的，所以只需要计算一次（包含所有新文件）
        let manifestFeeAR: number | undefined
        let manifestSize: number | undefined
        if (ownerAddress && files.length > 0) {
          try {
            // 估算清单文件大小（包括所有新上传的文件）
            // 使用第一个文件作为代表来估算（清单会包含所有文件）
            const firstFile = files[0]
            manifestSize = await estimateManifestSize(ownerAddress, {
              id: "temp-id",
              tx_id: "temp-tx-id",
              file_name: firstFile.name,
              file_hash: "",
              file_size: firstFile.size,
              mime_type: firstFile.type,
              folder_id: null,
              description: null,
              storage_type: "arweave",
              encryption_algo: encrypt ? "XChaCha20-Poly1305" : "none",
              encryption_params: "{}",
              version: 1,
              previous_tx_id: null,
              created_at: Date.now(),
              updated_at: Date.now(),
            })
            // 注意：实际清单文件大小会包含所有文件，这里只是估算
            // 为了更准确，可以根据文件数量调整估算
            // 每个文件记录约 500-1000 字节，加上新文件的数量
            const estimatedManifestSize =
              manifestSize + (files.length - 1) * 800 // 估算每个额外文件增加 800 字节
            const manifestFee = await estimateArweaveFee(estimatedManifestSize)
            manifestFeeAR = manifestFee.ar
            manifestSize = estimatedManifestSize
          } catch (error) {
            console.warn("Failed to estimate manifest fee:", error)
            // 清单费用估算失败不影响主费用计算
          }
        }

        // 只有在启用压缩且至少有一个文件被压缩且有节省时才显示压缩信息
        const shouldShowCompression =
          compress && hasCompression && totalSavedFeeAR > 0

        // 总费用 = 所有文件费用 + 清单文件费用
        const totalARWithManifest = totalAR + (manifestFeeAR || 0)

        // 计算其它代币的代币费用
        const estimatedFeesByToken: Partial<Record<PaymentToken, number>> = {}
        const tokens: PaymentToken[] = [
          "ETH",
          "SOL",
          "SUI",
          "BTC",
          "USDC",
          "USDT",
        ]

        for (const token of tokens) {
          const estimate = await paymentService.estimateFeeInToken(
            totalDataSize + (manifestSize || 0),
            token,
          )
          estimatedFeesByToken[token] = estimate.tokenAmount
        }

        setEstimatedFee({
          ar: totalARWithManifest,
          dataSize: totalDataSize,
          originalSize: shouldShowCompression ? totalOriginalSize : undefined,
          compressedSize: shouldShowCompression
            ? totalCompressedSize
            : undefined,
          originalFeeAR: shouldShowCompression ? totalOriginalFeeAR : undefined,
          savedFeeAR: shouldShowCompression ? totalSavedFeeAR : undefined,
          manifestFeeAR,
          manifestSize,
          estimatedFeesByToken,
          timestamp: Date.now(),
        })
        setFeeError(null)
      } catch (error) {
        console.error("Failed to calculate batch fee:", error)
        setEstimatedFee(null)
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        setFeeError(errorMessage || t("upload.feeCalculationFailed"))
      } finally {
        setCalculatingFee(false)
      }
    },
    [t],
  )

  return {
    estimatedFee,
    calculatingFee,
    feeError,
    calculateFee,
    calculateBatchFee,
  }
}
