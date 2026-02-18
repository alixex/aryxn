import { BrowserProvider, JsonRpcSigner } from "ethers"
import { type Client, type Chain, type Transport } from "viem"

export function clientToSigner(client: Client<Transport, Chain>) {
  const { account, chain, transport } = client
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  const provider = new BrowserProvider(transport, network)
  const signer = new JsonRpcSigner(provider, account.address)
  return signer
}
