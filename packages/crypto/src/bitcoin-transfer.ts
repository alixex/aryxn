import * as bitcoin from "bitcoinjs-lib"
import * as ecc from "tiny-secp256k1"
import ECPairFactory from "ecpair"

bitcoin.initEccLib(ecc)

const ECPair = ECPairFactory(ecc)

export interface BitcoinUtxoInput {
  txid: string
  vout: number
  value: number
}

export interface BuildBitcoinTransferParams {
  fromWif: string
  fromAddress: string
  toAddress: string
  amountSats: number
  feeSats: number
  utxos: BitcoinUtxoInput[]
  changeAddress: string
}

function toXOnly(pubKey: Buffer): Buffer {
  return pubKey.length === 32 ? pubKey : pubKey.subarray(1, 33)
}

function tweakSigner(keyPair: ReturnType<typeof ECPair.fromWIF>) {
  if (!keyPair.privateKey) {
    throw new Error("Private key is required")
  }

  const privateKey = keyPair.privateKey
  const publicKey = Buffer.from(keyPair.publicKey)
  const xOnlyPubkey = toXOnly(publicKey)
  const tweakHash = bitcoin.crypto.taggedHash("TapTweak", xOnlyPubkey)

  const maybeNegated =
    publicKey[0] === 3 ? ecc.privateNegate(privateKey) : privateKey
  if (!maybeNegated) {
    throw new Error("Failed to normalize private key")
  }

  const tweakedPrivateKey = ecc.privateAdd(maybeNegated, tweakHash)
  if (!tweakedPrivateKey) {
    throw new Error("Failed to tweak private key")
  }

  return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
    network: bitcoin.networks.bitcoin,
  })
}

export function estimateBitcoinTransferVsize(
  inputCount: number,
  outputCount: number,
): number {
  if (inputCount <= 0 || outputCount <= 0) return 0
  return Math.ceil(10.5 + inputCount * 57.5 + outputCount * 43)
}

export function buildSignedBitcoinTransferTx(
  params: BuildBitcoinTransferParams,
): string {
  const {
    fromWif,
    fromAddress,
    toAddress,
    amountSats,
    feeSats,
    utxos,
    changeAddress,
  } = params

  if (amountSats <= 0) {
    throw new Error("Amount must be greater than 0")
  }

  if (feeSats <= 0) {
    throw new Error("Fee must be greater than 0")
  }

  const totalInput = utxos.reduce((sum, utxo) => sum + utxo.value, 0)
  const change = totalInput - amountSats - feeSats

  if (change < 0) {
    throw new Error("Insufficient balance for amount + fee")
  }

  const network = bitcoin.networks.bitcoin
  const keyPair = ECPair.fromWIF(fromWif, network)
  const tweakedSigner = tweakSigner(keyPair)

  const fromScript = bitcoin.address.toOutputScript(fromAddress, network)

  const psbt = new bitcoin.Psbt({ network })

  for (const utxo of utxos) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: fromScript,
        value: BigInt(utxo.value),
      },
      tapInternalKey: toXOnly(Buffer.from(keyPair.publicKey)),
    })
  }

  psbt.addOutput({
    address: toAddress,
    value: BigInt(amountSats),
  })

  if (change > 546) {
    psbt.addOutput({
      address: changeAddress,
      value: BigInt(change),
    })
  }

  for (let index = 0; index < utxos.length; index += 1) {
    psbt.signInput(index, tweakedSigner)
  }

  psbt.finalizeAllInputs()
  return psbt.extractTransaction().toHex()
}
