import { useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Plus, UserRound } from 'lucide-react'
import { QRCode } from 'antd'
import { formatEther, parseEther, ZeroHash } from 'ethers'
import { useTranslation } from 'react-i18next'
import type { Group } from '@/readpact/ReadPact'
import type { ReadingBook } from '@/readpact/books'
import type { ReadingTask } from '@/readpact/chain'
import { short } from '@/readpact/chain'
import '@/readpact/challenge-flow.css'
import { flowTheme } from '@/readpact/flow-theme'

type Person = Group['people'][number]
interface Props {
  simulation?: boolean
  initialPage?: 'checkin' | 'detail'
  group: Group
  book?: ReadingBook
  account: string
  now: number
  busy: boolean
  active: boolean
  day: number
  me?: Person
  task?: ReadingTask
  taskError: boolean
  canSettle: boolean
  reward: bigint
  myAward: bigint
  answer: number
  quizDeadline: number
  quizPassed: boolean
  reflection: string
  ownReflection?: ReactNode
  witnesses: ReactNode
  onBack: () => void
  onConnect: () => void
  onJoin: () => void
  onCancel: () => void
  onSettle: () => void
  onClaim: () => void
  onQuiz: () => void
  onAnswer: (answer: number) => void
  onCheck: () => void
  onReflection: (value: string) => void
  onSubmit: () => void
  onRetryTask: () => void
}
export default function ChallengeFlow(p: Props) {
  const { t } = useTranslation()
  const { group: g, book, me, now, day, busy } = p
  const initialPanel = new URLSearchParams(location.search).get('panel')
  const [page, setPage] = useState<'detail' | 'checkin' | 'settle'>(
    p.initialPage ??
      (initialPanel === 'settle' || initialPanel === 'checkin' ? initialPanel : 'detail'),
  )
  const go = (next: typeof page) => {
    setPage(next)
    const url = new URL(location.href)
    if (next === 'detail') url.searchParams.delete('panel')
    else url.searchParams.set('panel', next)
    if (!p.simulation) history.replaceState(null, '', url)
    window.scrollTo(0, 0)
  }
  const waiting = !g.settled && now < g.joinUntil
  const expired = !g.startedAt && !g.settled && now >= g.joinUntil
  const hasOpened = g.startedAt > 0 && now >= g.startedAt
  const invitation = `https://staff.dushu365.com/readpact/?group=${g.id}&version=3`
  const entry = me?.days[day]
  const submitted = Boolean(entry && entry.hash !== ZeroHash)
  const step = submitted ? 3 : p.quizPassed ? 2 : p.quizDeadline > now ? 1 : 0
  const shownPeople =
    g.people.length > (me ? 4 : 3)
      ? me
        ? [...g.people.filter((person) => person.address !== me.address).slice(0, 2), me]
        : g.people.slice(0, 2)
      : g.people.slice(0, me ? 4 : 3)
  const extraPeople = g.people.length - shownPeople.length
  const total = g.pool + g.reservedFund
  const unit = g.demo ? t('轮') : t('天')
  const theme = flowTheme(book)
  const style = {
    '--book-tone': theme.tone,
    '--book-accent': theme.accent,
    '--book-highlight': theme.highlight,
  } as CSSProperties
  const avatar = (person: Person) => (
    <span className="detail-member-avatar">
      <UserRound size={27} />
      <span className="detail-avatar-badge">{person.address.slice(-2)}</span>
    </span>
  )
  const header = (label: string) => (
    <header className="flow-head">
      <button className="flow-back" aria-label={t('返回挑战详情')} onClick={() => go('detail')}>
        <ArrowLeft size={19} />
      </button>
      <img className="flow-cover" src={book?.cover} alt={book?.name} />
      <div className="flow-book-copy">
        <div className="flow-kicker">{label}</div>
        <h1 className="flow-book-title">{book?.title}</h1>
        <div className="flow-book-cn">{book?.name}</div>
        <span className="flow-period">
          #{g.id} · {g.totalDays} {unit} · {g.requiredDays} {unit}
          {t('达标')}
        </span>
      </div>
    </header>
  )
  const action = () => {
    if (g.settled || p.canSettle) go('settle')
    else if (hasOpened) go('checkin')
    else if (!p.account) p.onConnect()
    else if (expired) p.onCancel()
    else if (!me) p.onJoin()
  }
  const label = g.settled
    ? t('查看挑战结算')
    : p.canSettle
      ? t('挑战结束，前往结算')
      : hasOpened
        ? me && p.active
          ? t('去第 {{day}} {{unit}}打卡', { day: day + 1, unit })
          : t('查看阅读与见证')
        : !p.account
          ? t('连接钱包，加入挑战')
          : expired
            ? t('组队过期，解锁退款')
            : !me
              ? p.simulation
                ? t('加入（不扣款）')
                : t('锁定 10 MON，加入挑战')
              : g.people.length < 3
                ? t('等待更多读者加入')
                : t('已成组，等待开读')
  return (
    <div className="challenge-flow" style={style}>
      {page === 'detail' ? (
        <section className="book-detail-shell">
          <header className="book-detail-hero">
            <button
              className="detail-icon-btn back-home"
              aria-label={t('返回书架')}
              onClick={p.onBack}
            >
              <ArrowLeft size={20} />
            </button>
            <img className="detail-cover" src={book?.cover} alt={book?.name} />
            <h1 className="detail-book-name">{book?.name}</h1>
            <div className="detail-book-en">{book?.title}</div>
            <button
              className="detail-main-cta"
              disabled={
                busy ||
                (waiting && Boolean(me)) ||
                (waiting && !expired && !me && g.people.length >= 10)
              }
              onClick={action}
            >
              <span className="detail-cta-icon">
                <BookOpen />
              </span>
              <span className="detail-cta-copy">{label}</span>
            </button>
          </header>
          <section className="detail-section detail-readers">
            <div className="detail-section-head">
              <h2>{t('已加入（{{count}} 人）', { count: g.people.length })}</h2>
              <span>
                {waiting
                  ? g.people.length < 3
                    ? t('至少 3 人成组')
                    : t('已成组，定时开读')
                  : g.settled
                    ? t('挑战已结束')
                    : expired
                      ? t('未成组，可退款')
                      : t('共同阅读中')}
              </span>
            </div>
            <div className="detail-member-grid">
              {shownPeople.map((person) => (
                <div className="detail-member" key={person.address}>
                  {avatar(person)}
                  <b>
                    {p.simulation
                      ? person.address === p.account
                        ? t('你')
                        : `${t('读者')} ${Number.parseInt(person.address.slice(-2), 16)}`
                      : short(person.address)}
                  </b>
                  <small>
                    {p.simulation
                      ? t('同组读者')
                      : person.address.toLowerCase() === p.account.toLowerCase()
                        ? t('当前账号')
                        : t('同组读者')}
                  </small>
                </div>
              ))}
              {!me && waiting && (
                <div className="detail-member">
                  <span className="detail-open-slot">
                    <Plus />
                  </span>
                  <b>{t('你的位置')}</b>
                  <small>{t('加入后显示')}</small>
                </div>
              )}
              {extraPeople > 0 && (
                <div className="detail-member">
                  <span className="detail-open-slot">+{extraPeople}</span>
                  <b>{t('更多读者')}</b>
                </div>
              )}
            </div>
          </section>
          <section className="detail-pool">
            <div className="detail-pool-copy">
              <h3>
                {t('总奖池')} {formatEther(total)} MON
              </h3>
              <p>
                {t('读者押金')} {formatEther(g.pool)} MON + {t('已锁定基金')}{' '}
                {formatEther(g.reservedFund)} MON
                <br />
                {g.requiredDays} / {g.totalDays} {unit}
                {t('达标')} · #{g.id}
                <br />
                {t('开读时间')} {new Date(g.joinUntil * 1000).toLocaleString()}
              </p>
            </div>
            <div className="detail-pool-side">
              <BookOpen size={25} />
              <span>
                {g.people.length} {t('人已加入')}
              </span>
            </div>
          </section>
          <aside className="fund-note">
            <div className="fund-note-head">
              <span>{t('本组锁定的同书基金')}</span>
              <strong>{formatEther(g.reservedFund)} MON</strong>
            </div>
            <div className="fund-equation">
              {formatEther(g.pool)} MON + {formatEther(g.reservedFund)} MON ={' '}
              <b>{formatEther(total)} MON</b>
            </div>
            <p>
              {t(
                '全员完成时退还押金并平分基金；部分完成时，完成者平分押金池；全员未完成时，押金进入同书基金。',
              )}
            </p>
          </aside>
          {waiting && !p.simulation && (
            <section className="invitation-note">
              <label htmlFor="invitation-url">{t('邀请朋友一起读')}</label>
              <input id="invitation-url" readOnly value={invitation} />
              <p>
                {t('报名截止并开读')} {new Date(g.joinUntil * 1000).toLocaleString()}
              </p>
              <details>
                <summary>{t('邀请二维码')}</summary>
                <QRCode value={invitation} size={180} />
              </details>
            </section>
          )}
        </section>
      ) : (
        <section className={`flow-screen ${page === 'checkin' ? 'checkin-flow' : 'settle-flow'}`}>
          {header(
            page === 'checkin' ? `${t('每日打卡')} · DAY ${day + 1}` : `${t('挑战结算')} · RESULT`,
          )}
          {page === 'checkin' ? (
            <>
              <section className="compact-progress">
                <div className="compact-progress-head">
                  <strong>
                    {me?.completed ?? 0} / {g.requiredDays} {t('已完成')}
                  </strong>
                  <span>
                    {t('第')} {day + 1} {unit} / {g.totalDays}
                    <br />
                    {me ? t('以两位同伴确认为准') : t('连接已加入的钱包查看进度')}
                  </span>
                </div>
                <div
                  className="progress-dots"
                  style={{ gridTemplateColumns: `repeat(${g.totalDays},1fr)` }}
                >
                  {Array.from({ length: g.totalDays }, (_, i) => (
                    <span
                      key={i}
                      className={`progress-dot ${me?.days[i]?.done ? 'hit' : i < day ? 'missed' : ''} ${p.active && i === day ? 'today' : ''}`}
                      aria-label={`${i + 1} ${unit} · ${me?.days[i]?.done ? t('已完成') : t('未完成')}`}
                    />
                  ))}
                </div>
              </section>
              <nav className="check-stepper" aria-label={t('打卡步骤')}>
                {['阅读', '答题', '感想', '确认'].map((text, i) => (
                  <span
                    className={`check-step ${i < step ? 'done' : ''} ${i === step ? 'on' : ''}`}
                    aria-current={i === step ? 'step' : undefined}
                    key={text}
                  >
                    {t(text)}
                  </span>
                ))}
              </nav>
              {!p.account && (
                <button className="pill-btn" onClick={p.onConnect}>
                  {t('连接钱包')}
                  <ArrowRight size={20} />
                </button>
              )}
              {!p.active && (
                <div className="task-card">
                  <h2 className="step-title">
                    {g.settled ? t('挑战已结算') : !hasOpened ? t('尚未开读') : t('阅读阶段已结束')}
                  </h2>
                  <p>
                    {!hasOpened
                      ? `${t('开读时间')} ${new Date(g.joinUntil * 1000).toLocaleString()}`
                      : t('确认宽限结束后即可结算。')}
                  </p>
                  <button className="pill-btn" onClick={() => go('settle')}>
                    {t('查看结算')}
                    <ArrowRight size={20} />
                  </button>
                </div>
              )}
              {p.active && !me && (
                <p className="flow-hint">{t('打卡仅对本组已入金成员开放，可查看下方同伴记录。')}</p>
              )}
              {p.active &&
                me &&
                !submitted &&
                (p.task ? (
                  <>
                    {step === 0 ? (
                      <article className="knowledge-card">
                        <div className="knowledge-label">
                          TODAY&apos;S READING CARD · DAY {day + 1}
                        </div>
                        <div className="knowledge-quote">{p.task.card}</div>
                        <div className="knowledge-source">
                          《{book?.name}》 · {p.task.title}
                        </div>
                      </article>
                    ) : (
                      <aside className="knowledge-summary">
                        <b>{day + 1}</b>
                        <div>
                          <strong>TODAY&apos;S READING CARD</strong>
                          <span>{p.task.card}</span>
                        </div>
                      </aside>
                    )}
                    {step === 0 && (
                      <div className="check-primary-dock">
                        <button className="pill-btn" onClick={p.onQuiz}>
                          {p.quizDeadline ? t('答题超时，重新开始') : t('读完了，开始答题')}
                          <span className="round">30s</span>
                        </button>
                      </div>
                    )}
                    {step === 1 && (
                      <article className="task-card">
                        <div className="step-label">STEP 02 · {t('细节题')}</div>
                        <h2 className="step-title">{t('选出正确答案')}</h2>
                        <div className="countdown" role="timer">
                          {Math.max(0, p.quizDeadline - now)}s
                        </div>
                        <b>{p.task.question}</b>
                        <div>
                          {p.task.options.map((option, i) => (
                            <button
                              key={option}
                              className={`option ${p.answer === i ? 'on' : ''}`}
                              aria-pressed={p.answer === i}
                              onClick={() => p.onAnswer(i)}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        <button
                          className="pill-btn"
                          disabled={p.answer < 0 || busy}
                          onClick={p.onCheck}
                        >
                          {t('确认答案')}
                          <ArrowRight size={20} />
                        </button>
                      </article>
                    )}
                    {step === 2 && (
                      <>
                        <article className="task-card">
                          <div className="step-label">STEP 03 · {t('读后感')}</div>
                          <h2 className="step-title">{t('写一句读后感')}</h2>
                          <label className="flow-hint" htmlFor="reflection">
                            {t('10–500 字，组内公开')}
                          </label>
                          <textarea
                            id="reflection"
                            value={p.reflection}
                            maxLength={500}
                            placeholder={t('今天最有感触的一句，联系自己的经历。')}
                            onChange={(e) => p.onReflection(e.target.value)}
                          />
                          <div className="flow-hint">{p.reflection.length} / 500</div>
                        </article>
                        <div className="check-primary-dock">
                          <button
                            className="pill-btn"
                            disabled={busy || p.reflection.trim().length < 10}
                            onClick={p.onSubmit}
                          >
                            {p.simulation
                              ? t('提交，等待共读者确认')
                              : t('签名提交，等待共读者确认')}
                            <ArrowRight size={20} />
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="flow-hint">
                    {p.taskError ? t('阅读卡加载失败') : t('正在加载阅读卡…')}
                    {p.taskError && <button onClick={p.onRetryTask}>{t('重试')}</button>}
                  </p>
                ))}
              {submitted && (
                <article className="task-card">
                  <div className="step-label">STEP 04 · {t('共读者确认')}</div>
                  <h2 className="step-title">
                    {entry?.done
                      ? t('本次打卡已完成')
                      : t('共读者确认 {{count}}/2', { count: entry?.count ?? 0 })}
                  </h2>
                  <CheckCircle2 size={38} />
                  <div className="own-reflection">
                    {p.ownReflection ?? (p.reflection && <blockquote>{p.reflection}</blockquote>)}
                  </div>
                  <p>
                    {entry?.done
                      ? t('两位同伴已确认，你的进度已更新。')
                      : p.simulation
                        ? t('感想已保存，等待两位同伴确认。')
                        : t('感想已上链，等待两位不同的已入金同伴确认。')}
                  </p>
                  {!p.simulation && <div className="chain-receipt">{short(entry?.hash ?? '')}</div>}
                </article>
              )}
              <details className="witness-panel" open={step === 3 || !me}>
                <summary>{t('互相见证')}</summary>
                {p.witnesses}
              </details>
            </>
          ) : (
            <>
              <section className="settle-summary">
                <div className="settle-summary-label">TOTAL PRIZE POOL</div>
                <strong>
                  {formatEther(total)}
                  <small> MON</small>
                </strong>
                <p>
                  {t('读者押金')} {formatEther(g.pool)} MON + {t('锁定基金')}{' '}
                  {formatEther(g.reservedFund)} MON
                </p>
              </section>
              <div className="settle-split">
                {g.cancelled
                  ? t('组队已取消，每位读者可取回押金')
                  : g.settled
                    ? t('结算已上链，领取金额由合约确定')
                    : t('全员、部分或无人完成，按约定分别结算')}
              </div>
              <div className="settle-list-v2">
                {g.people.map((person) => {
                  const won = person.completed >= g.requiredDays
                  const amount = g.cancelled ? parseEther('10') : won ? p.reward : 0n
                  return (
                    <div
                      className={`settle-row-v2 ${g.settled && !won && !g.cancelled ? 'fail' : ''}`}
                      key={person.address}
                    >
                      <span className="detail-mini-avatar">
                        <UserRound size={20} />
                      </span>
                      <div className="settle-name">
                        {short(person.address)}
                        <div className="settle-meta">
                          {person.completed}/{g.totalDays} {unit} · {won ? t('完成') : t('未完成')}
                        </div>
                      </div>
                      <div className="settle-money">
                        {formatEther(g.settled ? amount : parseEther('10'))} MON
                        <em>
                          {g.settled
                            ? amount > 0n
                              ? person.claimable === 0n
                                ? t('已领取')
                                : t('待领取')
                              : t('未达标')
                            : t('押金已锁定')}
                        </em>
                      </div>
                    </div>
                  )
                })}
              </div>
              {g.settled && me && me.completed >= g.requiredDays && !g.cancelled && (
                <section className="certificate-v2">
                  <div className="flow-kicker">READPACT COMPLETION CERTIFICATE</div>
                  <div className="certificate-grid">
                    <img src={book?.cover} alt={book?.name} />
                    <div>
                      <h2>{t('读完证书')}</h2>
                      <p>
                        {book?.title}
                        <br />
                        {me.completed}/{g.totalDays} {unit} · {t('应得')} {formatEther(p.myAward)}{' '}
                        MON
                        <br />
                        {me.claimable === 0n ? t('已领取到钱包') : t('等待领取')}
                      </p>
                    </div>
                  </div>
                </section>
              )}
              {!g.settled && (
                <div className="check-primary-dock">
                  <button
                    className="pill-btn"
                    disabled={busy || !p.canSettle}
                    onClick={p.account ? p.onSettle : p.onConnect}
                  >
                    {p.canSettle
                      ? p.account
                        ? t('结算挑战奖池')
                        : t('连接钱包，结算')
                      : t('尚未到结算时间')}
                    <ArrowRight size={20} />
                  </button>
                </div>
              )}
              {g.settled && me && (
                <div className="check-primary-dock">
                  <button
                    className="pill-btn"
                    disabled={busy || me.claimable === 0n}
                    onClick={p.onClaim}
                  >
                    {me.claimable > 0n
                      ? t('领取 {{amount}} MON 到钱包', { amount: formatEther(me.claimable) })
                      : p.myAward > 0n
                        ? t('奖励已领取')
                        : t('暂无可领取金额')}
                    <ArrowRight size={20} />
                  </button>
                </div>
              )}
              {g.settled && !p.account && (
                <button className="pill-btn" onClick={p.onConnect}>
                  {t('连接钱包，查看可领取金额')}
                  <ArrowRight size={20} />
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
