import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ZeroHash } from 'ethers'
import {
  demoProgressKey,
  getDemoProgress,
  submitDemo,
  confirmDemo,
  resetDemo,
  completedDemoDays,
} from '@/api/reading-demo'
import http from '@/api/http'
import type { ReadingTask } from '@/readpact/chain'
import type { ReadingBook } from '@/readpact/books'
import type { Group } from '@/readpact/ReadPact'
import ChallengeFlow from '@/readpact/ChallengeFlow'

export default function AlgorithmDemo({ book, onBack }: { book: ReadingBook; onBack: () => void }) {
  useEffect(() => {
    const url = new URL(location.href)
    url.searchParams.set('demo', 'algorithms')
    history.replaceState(null, '', url)
  }, [])
  const cache = useQueryClient()
  const progress = useQuery({ queryKey: demoProgressKey, queryFn: getDemoProgress })
  const task = useQuery({
    queryKey: ['demo-reading-card', book.id],
    queryFn: async () => (await http.get<ReadingTask>(`/readpact/books/${book.id}/tasks/0`)).data,
  })
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])
  const [answer, setAnswer] = useState(-1),
    [deadline, setDeadline] = useState(0),
    [passed, setPassed] = useState(false),
    [reflection, setReflection] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch {
      setError('操作未完成，请检查答案或网络后重试。')
    } finally {
      setBusy(false)
    }
  }
  const noop = () => undefined
  if (!progress.data)
    return (
      <section className="simulation-create-flow">
        <button onClick={onBack}>返回书架</button>
        <p>{progress.isError ? '演示进度加载失败' : '正在读取演示进度…'}</p>
        {progress.isError && <button onClick={() => void progress.refetch()}>重试</button>}
      </section>
    )
  const data = progress.data,
    done = completedDemoDays(data),
    confirmations = Number(data.witnessOne) + Number(data.witnessTwo)
  const account = '0x0000000000000000000000000000000000000099'
  const marker = '0x' + '1'.repeat(64)
  const me = {
    address: account,
    completed: done.length,
    claimable: 0n,
    days: Array.from({ length: 21 }, (_, i) => ({
      hash: done.includes(i + 1) || (i === 20 && data.submitted) ? marker : ZeroHash,
      count: i === 20 ? confirmations : done.includes(i + 1) ? 2 : 0,
      done: done.includes(i + 1),
      witnessed: false,
    })),
  }
  const group: Group = {
    id: '演示',
    bookId: book.id,
    creator: account,
    joinUntil: Date.parse('2026-09-27T00:00:00+08:00') / 1000,
    startedAt: Date.parse('2026-09-27T00:00:00+08:00') / 1000,
    periodSeconds: 86400,
    graceSeconds: 3600,
    totalDays: 21,
    requiredDays: 18,
    demo: false,
    settled: false,
    cancelled: false,
    pool: 50n * 10n ** 18n,
    reservedFund: 50n * 10n ** 18n,
    people: [
      ...Array.from({ length: 4 }, (_, i) => ({
        address: `0x${(i + 1).toString(16).padStart(40, '0')}`,
        completed: 17,
        claimable: 0n,
        days: [],
      })),
      me,
    ],
  }
  return (
    <>
      <p className="simulation-notice">
        <strong>演示体验，不扣款</strong> · 进度保存在数据库，不写入链上。
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="secondary"
        onClick={() =>
          void run(async () => {
            cache.setQueryData(demoProgressKey, await resetDemo())
            setPassed(false)
            setDeadline(0)
            setAnswer(-1)
            setReflection('')
          })
        }
        disabled={busy}
      >
        重置演示进度
      </button>
      <ChallengeFlow
        simulation
        initialPage="checkin"
        group={group}
        book={book}
        account={account}
        now={now}
        busy={busy}
        active
        day={20}
        me={me}
        task={task.data}
        taskError={task.isError}
        canSettle={false}
        reward={0n}
        myAward={0n}
        answer={answer}
        quizDeadline={deadline}
        quizPassed={passed}
        reflection={data.submitted ? data.reflection : reflection}
        witnesses={
          data.submitted ? (
            <div className="task-card">
              {[1, 2].map((w) => (
                <button
                  key={w}
                  className="pill-btn"
                  disabled={busy || (w === 1 ? data.witnessOne : data.witnessTwo)}
                  onClick={() =>
                    void run(async () => {
                      cache.setQueryData(demoProgressKey, await confirmDemo(w))
                    })
                  }
                >{`同伴 ${w}：${(w === 1 ? data.witnessOne : data.witnessTwo) ? '已看过' : '看过了'}`}</button>
              ))}
            </div>
          ) : null
        }
        onBack={onBack}
        onConnect={noop}
        onJoin={noop}
        onCancel={noop}
        onSettle={noop}
        onClaim={noop}
        onQuiz={() => {
          setDeadline(now + 30)
          setAnswer(-1)
        }}
        onAnswer={setAnswer}
        onCheck={() =>
          void run(async () => {
            await http.post(`/readpact/books/${book.id}/answers/check`, { day: 0, answer })
            setPassed(true)
          })
        }
        onReflection={setReflection}
        onSubmit={() =>
          void run(async () => {
            cache.setQueryData(demoProgressKey, await submitDemo(answer, reflection))
          })
        }
        onRetryTask={() => void task.refetch()}
      />
    </>
  )
}
