import type { Group } from '@/readpact/ReadPact'

export interface GroupReader {
  challengeCount(): Promise<bigint>
  challenges(id: number): Promise<
    Omit<
      Group,
      | 'id'
      | 'people'
      | 'startedAt'
      | 'joinUntil'
      | 'periodSeconds'
      | 'graceSeconds'
      | 'totalDays'
      | 'requiredDays'
    > & {
      startedAt: bigint
      joinUntil: bigint
      periodSeconds: bigint
      graceSeconds: bigint
      totalDays: bigint
      requiredDays: bigint
    }
  >
  getParticipants(id: number): Promise<string[]>
  members(id: number, address: string): Promise<{ completed: bigint; claimable: bigint }>
  entries(
    id: number,
    address: string,
    day: number,
  ): Promise<{ contentHash: string; confirmations: bigint; completed: boolean }>
  witnessed(id: number, address: string, day: number, account: string): Promise<boolean>
}
/** Only metadata and addresses needed for counts/membership. Never reads member progress. */
export async function loadGroupList(c: GroupReader): Promise<Group[]> {
  const count = Number(await c.challengeCount())
  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const id = count - index
      const [g, addresses] = await Promise.all([c.challenges(id), c.getParticipants(id)])
      return {
        id: String(id),
        bookId: g.bookId,
        creator: g.creator,
        startedAt: Number(g.startedAt),
        joinUntil: Number(g.joinUntil),
        periodSeconds: Number(g.periodSeconds),
        graceSeconds: Number(g.graceSeconds),
        totalDays: Number(g.totalDays),
        requiredDays: Number(g.requiredDays),
        demo: g.demo,
        settled: g.settled,
        cancelled: g.cancelled,
        pool: g.pool,
        reservedFund: g.reservedFund,
        people: addresses.map((address) => ({ address, completed: 0, claimable: 0n, days: [] })),
      }
    }),
  )
}
/** Full progress for the viewer; only today's entry for peers shown in the witness panel. */
export async function loadGroupDetail(
  c: GroupReader,
  group: Group,
  account: string,
  now: number,
): Promise<Group> {
  const visibleDays =
    group.startedAt > 0
      ? Math.max(
          0,
          Math.min(group.totalDays, Math.floor((now - group.startedAt) / group.periodSeconds) + 1),
        )
      : 0
  const currentDay = visibleDays - 1
  const people = await Promise.all(
    group.people.map(async ({ address }) => {
      const member = await c.members(Number(group.id), address)
      const indexes =
        address.toLowerCase() === account.toLowerCase()
          ? Array.from({ length: visibleDays }, (_, i) => i)
          : currentDay >= 0
            ? [currentDay]
            : []
      const days: Group['people'][number]['days'] = []
      await Promise.all(
        indexes.map(async (day) => {
          const e = await c.entries(Number(group.id), address, day)
          days[day] = {
            hash: String(e.contentHash),
            count: Number(e.confirmations),
            done: Boolean(e.completed),
            witnessed:
              account && day === currentDay && address.toLowerCase() !== account.toLowerCase()
                ? await c.witnessed(Number(group.id), address, day, account)
                : false,
          }
        }),
      )
      return {
        address,
        completed: Number(member.completed),
        claimable: BigInt(member.claimable),
        days,
      }
    }),
  )
  return { ...group, people }
}
