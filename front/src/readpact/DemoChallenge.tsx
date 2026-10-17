import { useState, type CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import ChallengeFlow from '@/readpact/ChallengeFlow'
import type { Group } from '@/readpact/ReadPact'
import type { ReadingBook } from '@/readpact/books'
import { demoBook, DEMO_NOW } from '@/readpact/demo-books'

/** Deliberately has no wallet, contract or HTTP write dependencies. */
export default function DemoChallenge({
  book,
  create,
  onBack,
}: {
  book: ReadingBook
  create: boolean
  onBack: () => void
}) {
  const preset = demoBook(book.slug)!
  const [creating, setCreating] = useState(create)
  const [joined, setJoined] = useState(false)
  const [start, setStart] = useState(preset.start)
  const account = '0x0000000000000000000000000000000000000099'
  const member = (address: string) => ({ address, completed: 0, claimable: 0n, days: [] })
  const people = [
    ...Array.from({ length: create ? 0 : preset.people }, (_, i) =>
      member(`0x${(i + 1).toString(16).padStart(40, '0')}`),
    ),
    ...(joined ? [member(account)] : []),
  ]
  const opening = Date.parse(`${start}T10:00:00+08:00`) / 1000
  const group: Group = {
    id: `simulation-${book.slug}`,
    bookId: book.id,
    creator: people[0]?.address ?? account,
    joinUntil: opening,
    startedAt: people.length >= 3 ? opening : 0,
    periodSeconds: 86400,
    graceSeconds: 3600,
    totalDays: 21,
    requiredDays: 18,
    demo: false,
    settled: false,
    cancelled: false,
    pool: BigInt(people.length) * 10n ** 19n,
    reservedFund: 0n,
    people,
  }
  const style = { '--book-tone': book.tone, '--book-accent': book.accent } as CSSProperties
  const noop = () => undefined
  return (
    <div className={creating ? 'readpact-create' : undefined} style={style}>
      <p className="simulation-notice">
        <strong>演示体验，不扣款</strong> · 人数、日期和金额为演示数据。
      </p>
      {creating ? (
        <div className="simulation-create-flow">
          <button className="icon-button" aria-label="返回书架" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <h1>发起挑战</h1>
          <div className="create-book">
            <img src={book.cover} alt={book.name} />
            <div>
              <h2>{book.title}</h2>
              <b>{book.name}</b>
            </div>
          </div>
          <section className="create-setup opening-setup">
            <h3>设置开读日期</h3>
            <label htmlFor="demo-opening">演示日期（2026 年 10 月）</label>
            <input
              id="demo-opening"
              type="date"
              min="2026-10-18"
              max="2026-10-31"
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </section>
          <p>21 天内完成 18 天；至少 3 人成组，每次打卡需两位同伴确认。押金 10 MON。</p>
          <button
            className="create-submit"
            disabled={!Number.isFinite(opening) || opening <= DEMO_NOW}
            onClick={() => {
              setJoined(true)
              setCreating(false)
            }}
          >
            发起（不扣款）
          </button>
        </div>
      ) : (
        <ChallengeFlow
          simulation
          group={group}
          book={book}
          account={account}
          now={DEMO_NOW}
          busy={false}
          active={false}
          day={0}
          me={joined ? people[people.length - 1] : undefined}
          taskError={false}
          canSettle={false}
          reward={0n}
          myAward={0n}
          answer={-1}
          quizDeadline={0}
          quizPassed={false}
          reflection=""
          witnesses={null}
          onBack={onBack}
          onConnect={noop}
          onJoin={() => setJoined(true)}
          onCancel={noop}
          onSettle={noop}
          onClaim={noop}
          onQuiz={noop}
          onAnswer={noop}
          onCheck={noop}
          onReflection={noop}
          onSubmit={noop}
          onRetryTask={noop}
        />
      )}
    </div>
  )
}
