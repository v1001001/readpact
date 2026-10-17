/** Distinct wallets reading a book now; registration and witness grace are not reading. */
export function countBookReaders(
  groups: {
    bookId: string
    startedAt: number
    totalDays: number
    periodSeconds: number
    settled: boolean
    addresses: string[]
  }[],
  now: number,
): Record<string, number> {
  const readers = new Map<string, Set<string>>()
  for (const group of groups) {
    if (
      group.settled ||
      group.startedAt <= 0 ||
      now < group.startedAt ||
      now >= group.startedAt + group.totalDays * group.periodSeconds
    )
      continue
    const key = group.bookId.toLowerCase()
    const wallets = readers.get(key) ?? new Set<string>()
    group.addresses.forEach((address) => wallets.add(address.toLowerCase()))
    readers.set(key, wallets)
  }
  return Object.fromEntries([...readers].map(([bookId, wallets]) => [bookId, wallets.size]))
}
