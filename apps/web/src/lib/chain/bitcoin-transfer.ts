import {
  buildSignedBitcoinTransferTx,
  estimateBitcoinTransferVsize,
  getBitcoinAddressFromWIF,
  type BitcoinUtxoInput,
} from "@aryxn/crypto"
import { getBitcoinApiUrl } from "@/lib/chain"

interface BitcoinFeeEstimates {
  [targetBlock: string]: number
}

interface BitcoinUtxoApiItem {
  txid: string
  vout: number
  value: number
}

export interface BitcoinTransferPreview {
  amountSats: number
  feeSats: number
  feeRate: number
  vsize: number
  inputCount: number
  totalInputSats: number
  changeSats: number
}

function toSats(amount: string): number {
  const value = Number.parseFloat(amount)
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 1e8)
}

function pickUtxos(
  utxos: BitcoinUtxoInput[],
  target: number,
): BitcoinUtxoInput[] {
  const sorted = [...utxos].sort((a, b) => a.value - b.value)
  const selected: BitcoinUtxoInput[] = []
  let total = 0

  for (const utxo of sorted) {
    selected.push(utxo)
    total += utxo.value
    if (total >= target) break
  }

  if (total < target) {
    throw new Error("Insufficient BTC balance")
  }

  return selected
}

async function fetchUtxos(address: string): Promise<BitcoinUtxoInput[]> {
  const api = getBitcoinApiUrl()
  const response = await fetch(`${api}/address/${address}/utxo`)

  if (!response.ok) {
    throw new Error(`Failed to fetch UTXOs: ${response.status}`)
  }

  const data = (await response.json()) as BitcoinUtxoApiItem[]
  return data.map((item) => ({
    txid: item.txid,
    vout: item.vout,
    value: item.value,
  }))
}

async function fetchRecommendedFeeRate(): Promise<number> {
  const api = getBitcoinApiUrl()
  const response = await fetch(`${api}/fee-estimates`)

  if (!response.ok) {
    return 6
  }

  const data = (await response.json()) as BitcoinFeeEstimates
  return Math.max(2, Math.ceil(data["3"] || data["6"] || data["10"] || 6))
}

async function broadcastTransaction(txHex: string): Promise<string> {
  const api = getBitcoinApiUrl()
  const response = await fetch(`${api}/tx`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: txHex,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Failed to broadcast BTC transaction")
  }

  const txid = await response.text()
  return txid.trim()
}

function validateBtcAddress(address: string) {
  return /^bc1[0-9a-z]{20,}$/.test(address.toLowerCase())
}

async function buildTransferPlan(params: {
  fromAddress: string
  toAddress: string
  amountBtc: string
}) {
  const { fromAddress, toAddress, amountBtc } = params

  if (!validateBtcAddress(fromAddress) || !validateBtcAddress(toAddress)) {
    throw new Error("Invalid BTC address")
  }

  const amountSats = toSats(amountBtc)
  if (amountSats <= 0) {
    throw new Error("Invalid BTC amount")
  }

  const utxos = await fetchUtxos(fromAddress)
  if (utxos.length === 0) {
    throw new Error("No spendable UTXOs found")
  }

  const feeRate = await fetchRecommendedFeeRate()

  let selected = pickUtxos(utxos, amountSats)
  let vsize = estimateBitcoinTransferVsize(selected.length, 2)
  let feeSats = Math.ceil(vsize * feeRate)
  selected = pickUtxos(utxos, amountSats + feeSats)

  vsize = estimateBitcoinTransferVsize(selected.length, 2)
  feeSats = Math.ceil(vsize * feeRate)
  selected = pickUtxos(utxos, amountSats + feeSats)

  const totalInputSats = selected.reduce((sum, item) => sum + item.value, 0)
  const changeSats = Math.max(0, totalInputSats - amountSats - feeSats)

  const preview: BitcoinTransferPreview = {
    amountSats,
    feeSats,
    feeRate,
    vsize,
    inputCount: selected.length,
    totalInputSats,
    changeSats,
  }

  return {
    selected,
    preview,
  }
}

export async function estimateBitcoinTransfer(params: {
  fromAddress: string
  toAddress: string
  amountBtc: string
}): Promise<BitcoinTransferPreview> {
  const { preview } = await buildTransferPlan(params)
  return preview
}

export async function sendBitcoinTransfer(params: {
  fromAddress: string
  fromWif: string
  toAddress: string
  amountBtc: string
}) {
  const { fromAddress, fromWif, toAddress, amountBtc } = params

  const normalizedFrom = getBitcoinAddressFromWIF(fromWif)
  if (!normalizedFrom || normalizedFrom !== fromAddress) {
    throw new Error("Active BTC key does not match selected BTC account")
  }

  const { selected, preview } = await buildTransferPlan({
    fromAddress,
    toAddress,
    amountBtc,
  })

  const txHex = buildSignedBitcoinTransferTx({
    fromWif,
    fromAddress,
    toAddress,
    amountSats: preview.amountSats,
    feeSats: preview.feeSats,
    utxos: selected,
    changeAddress: fromAddress,
  })

  const txid = await broadcastTransaction(txHex)

  return {
    txid,
    ...preview,
  }
}
