export default class HexUtils {
  public static toDecimal(hex: string): string {
    return BigInt(hex).toString()
  }

  public static toHex(num: string): string {
    return `0x${BigInt(num).toString(16)}`
  }
}
