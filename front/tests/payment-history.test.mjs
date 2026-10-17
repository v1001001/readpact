import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/readpact/payment-history.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
)
const { paymentKey, readPayments, savePayment } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const row = {
  hash: '0x' + 'a'.repeat(64),
  wallet: '0x' + 'b'.repeat(40),
  groupId: '4',
  amount: '10000000000000000000',
  blockNumber: 12,
}
test('receipts persist, deduplicate and isolate network/contract/wallet', () => {
  const data = new Map()
  const storage = { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) }
  const key = paymentKey(10143, '0xABC', row.wallet)
  assert.equal(key, paymentKey(10143, '0xabc', row.wallet.toUpperCase()))
  assert.equal(savePayment(storage, key, row), true)
  savePayment(storage, key, row)
  assert.deepEqual(readPayments(storage, key), [row])
  for (const other of [
    paymentKey(1, '0xABC', row.wallet),
    paymentKey(10143, '0xDEF', row.wallet),
    paymentKey(10143, '0xABC', '0x123'),
  ])
    assert.deepEqual(readPayments(storage, other), [])
})
test('corrupt or blocked storage cannot break successful payments', () => {
  for (const value of ['{', 'null', '[null,{}, {"amount":"bad"}]'])
    assert.deepEqual(readPayments({ getItem: () => value }, 'key'), [])
  const blocked = {
    getItem: () => {
      throw Error('disabled')
    },
    setItem: () => {
      throw Error('quota')
    },
  }
  assert.deepEqual(readPayments(blocked, 'key'), [])
  assert.equal(savePayment(blocked, 'key', row), false)
})
