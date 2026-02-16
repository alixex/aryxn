import Arweave from "arweave"

export const initArweave = (config?: {
  host: string
  port: number
  protocol: string
}) => {
  return Arweave.init(
    config || {
      host: "arweave.net",
      port: 443,
      protocol: "https",
    },
  )
}

export const defaultArweave = initArweave()
