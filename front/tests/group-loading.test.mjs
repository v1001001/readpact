import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { QueryClient } from '@tanstack/react-query'
const source = readFileSync(new URL('../src/readpact/group-loading.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
const { loadGroupList, loadGroupDetail } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
function reader() {
  const calls = { members: [], entries: [], witnessed: [], count: 0 }
  const c = {
    challengeCount: async () => {
      calls.count++
      return 2n
    },
    challenges: async () => ({
      bookId: 'book',
      creator: '0xA',
      startedAt: 100n,
      joinUntil: 100n,
      periodSeconds: 100n,
      graceSeconds: 10n,
      totalDays: 21n,
      requiredDays: 18n,
      demo: false,
      settled: false,
      cancelled: false,
      pool: 30n,
      reservedFund: 0n,
    }),
    getParticipants: async () => ['0xA', '0xB', '0xC'],
    members: async (id, address) => {
      calls.members.push([id, address])
      return { completed: 2n, claimable: 10n }
    },
    entries: async (id, address, day) => {
      calls.entries.push([id, address, day])
      return { contentHash: 'hash', confirmations: 2n, completed: true }
    },
    witnessed: async (...args) => {
      calls.witnessed.push(args)
      return true
    },
  }
  return { c, calls }
}
test('list renders metadata/counts without fetching any member progress or entries', async () => {
  const { c, calls } = reader()
  const groups = await loadGroupList(c)
  assert.deepEqual(
    groups.map((g) => g.id),
    ['2', '1'],
  )
  assert.equal(groups[0].people.length, 3)
  assert.equal(calls.members.length, 0)
  assert.equal(calls.entries.length, 0)
})
test('detail fetches only selected group: viewer history, peer current day', async () => {
  const { c, calls } = reader()
  const [group] = await loadGroupList(c)
  const detail = await loadGroupDetail(c, group, '0xa', 350)
  assert.equal(calls.members.length, 3)
  assert.equal(calls.entries.length, 5)
  assert.ok(calls.entries.every(([id]) => id === 2))
  assert.deepEqual(
    calls.entries.filter(([, a]) => a !== '0xA').map(([, a, d]) => [a, d]),
    [
      ['0xB', 2],
      ['0xC', 2],
    ],
  )
  assert.equal(calls.witnessed.length, 2)
  assert.equal(detail.people[0].days[0].done, true)
  assert.equal(group.people[0].days.length, 0)
})
test('future groups never query entries; anonymous view does not read witness flags', async () => {
  const { c, calls } = reader()
  const [group] = await loadGroupList(c)
  await loadGroupDetail(c, group, '', 50)
  assert.equal(calls.entries.length, 0)
  await loadGroupDetail(c, group, '', 350)
  assert.equal(calls.entries.length, 3)
  assert.equal(calls.witnessed.length, 0)
})
test('cached list survives detail failure and failed refresh; repeat visit uses cache', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const { c, calls } = reader()
  const query = {
    queryKey: ['groups', 'contract'],
    queryFn: () => loadGroupList(c),
    staleTime: 60000,
  }
  const list = await client.fetchQuery(query)
  await client.fetchQuery(query)
  assert.equal(calls.count, 1)
  await assert.rejects(
    client.fetchQuery({
      queryKey: ['group-detail', 'contract', '2'],
      queryFn: async () => {
        throw Error('RPC unavailable')
      },
    }),
  )
  assert.deepEqual(client.getQueryData(query.queryKey), list)
  await assert.rejects(
    client.fetchQuery({
      ...query,
      staleTime: 0,
      queryFn: async () => {
        throw Error('offline')
      },
    }),
  )
  assert.deepEqual(client.getQueryData(query.queryKey), list)
  client.clear()
})
