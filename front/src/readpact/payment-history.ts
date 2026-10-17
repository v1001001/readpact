export interface PaymentRecord {
  hash: string
  groupId: string
  wallet: string
  amount: string
  blockNumber: number
}
export function paymentKey(chainId: number, contract: string, wallet: string) {
  return `readpact:payments:${chainId}:${contract.toLowerCase()}:${wallet.toLowerCase()}`
}
export function readPayments(storage: Pick<Storage, 'getItem'>, key: string): PaymentRecord[] {
  try {
    const rows: unknown = JSON.parse(storage.getItem(key) ?? '[]')
    if (!Array.isArray(rows)) return []
    return rows.filter(
      (row): row is PaymentRecord =>
        row !== null &&
        typeof row === 'object' &&
        typeof row.hash === 'string' &&
        /^0x[\da-f]{64}$/i.test(row.hash) &&
        typeof row.wallet === 'string' &&
        /^0x[\da-f]{40}$/i.test(row.wallet) &&
        typeof row.groupId === 'string' &&
        /^\d+$/.test(row.groupId) &&
        typeof row.amount === 'string' &&
        /^\d+$/.test(row.amount) &&
        Number.isSafeInteger(row.blockNumber) &&
        row.blockNumber >= 0,
    )
  } catch {
    return []
  }
}
export function savePayment(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  row: PaymentRecord,
) {
  try {
    const previous = readPayments(storage, key)
    storage.setItem(
      key,
      JSON.stringify([row, ...previous.filter((item) => item.hash !== row.hash)].slice(0, 100)),
    )
    return true
  } catch {
    return false
  }
}
