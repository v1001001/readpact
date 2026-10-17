import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source = readFileSync(new URL('../src/readpact/book-readers.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
const { countBookReaders } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const group = {
  bookId: '0xAA',
  startedAt: 100,
  totalDays: 3,
  periodSeconds: 120,
  settled: false,
  addresses: ['0xAb', '0xCd', '0xEf'],
}
test('same reader across same-book groups counts once; other books independent', () => {
  assert.deepEqual(
    countBookReaders(
      [
        group,
        { ...group, bookId: '0xaa', addresses: ['0xab', '0x12'] },
        { ...group, bookId: '0xBB' },
      ],
      100,
    ),
    { '0xaa': 4, '0xbb': 3 },
  )
  assert.equal(group.addresses.length, 3)
})
test('scheduled, unformed, cancelled, settled and ended groups do not inflate readers', () => {
  assert.deepEqual(
    countBookReaders(
      [
        { ...group, startedAt: 0 },
        { ...group, startedAt: 101 },
        { ...group, settled: true },
        { ...group, startedAt: 1, periodSeconds: 10 },
      ],
      100,
    ),
    {},
  )
  assert.deepEqual(countBookReaders([group], 459), { '0xaa': 3 })
  assert.deepEqual(countBookReaders([group], 460), {})
})
