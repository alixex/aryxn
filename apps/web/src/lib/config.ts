/**
 * 应用全局配置常量
 * 集中管理所有 app name 和其他配置参数
 */

/**
 * Arweave 应用标识
 * 用于在 Arweave 交易标签中标记应用来源
 */
export const ARWEAVE_APP_NAME = "Anamnesis"

/**
 * 清单文件应用标识
 * 用于标记清单文件交易
 */
export const MANIFEST_APP_NAME = `${ARWEAVE_APP_NAME}-manifest`

/**
 * 清单文件版本
 * 用于验证清单格式兼容性
 */
export const MANIFEST_VERSION = "1.0.0"

/**
 * 增量清单版本
 * 用于增量更新清单文件
 */
export const INCREMENTAL_MANIFEST_VERSION = "1.1.0"
