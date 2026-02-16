import {
  generateMnemonic as bip39Generate,
  mnemonicToSeed as bip39ToSeed,
  validateMnemonic as bip39Validate,
} from "bip39"

/**
 * Generate a new random mnemonic (12 words by default)
 */
export const generateMnemonic = (strength = 128): string => {
  return bip39Generate(strength)
}

/**
 * Validate a mnemonic phrase
 */
export const validateMnemonic = (mnemonic: string): boolean => {
  return bip39Validate(mnemonic)
}

/**
 * Convert a mnemonic to a seed buffer
 */
export const mnemonicToSeed = async (mnemonic: string): Promise<Uint8Array> => {
  const seed = await bip39ToSeed(mnemonic)
  return new Uint8Array(seed)
}
