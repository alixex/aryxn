import { ExchangeRouter } from "./router"
import { AggregateHistoryProvider } from "@aryxn/query-chain"
import type { ExchangeConfig } from "./types"

export type {
  ExchangeType,
  ExchangeConfig,
  ExchangeRequest,
  ExchangeRoute,
  ExchangeStatus,
} from "./types"
export { SUPPORTED_TOKENS } from "./constants"
export type { SupportedToken } from "./constants"
export { ExchangeRouter } from "./router"

export class ExchangeSDK {
  public router: ExchangeRouter
  public history: AggregateHistoryProvider

  constructor(config: ExchangeConfig) {
    this.router = new ExchangeRouter(config)
    this.history = new AggregateHistoryProvider()
  }
}
