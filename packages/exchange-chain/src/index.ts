import { ExchangeRouter } from "./router"
import { AggregateHistoryProvider } from "@aryxn/query-chain"
import type { ExchangeConfig } from "./types"

export * from "./types"
export * from "./constants"
export * from "./router"

export class ExchangeSDK {
  public router: ExchangeRouter
  public history: AggregateHistoryProvider

  constructor(config: ExchangeConfig) {
    this.router = new ExchangeRouter(config)
    this.history = new AggregateHistoryProvider()
  }
}
