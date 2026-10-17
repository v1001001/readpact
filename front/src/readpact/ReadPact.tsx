import { paymentKey, readPayments, savePayment } from '@/readpact/payment-history'
import { loadGroupList, loadGroupDetail, type GroupReader } from '@/readpact/group-loading'
import { useEffect, useState, type CSSProperties } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Search,
  UserRound,
  Plus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import {
  formatEther,
  parseEther,
  sha256,
  toUtf8Bytes,
  verifyMessage,
  ZeroHash,
  type ContractTransactionResponse,
} from 'ethers'
import http from '@/api/http'
import {
  readContract,
  writeContract,
  signer,
  short,
  useWallet,
  watchWallet,
  type Config,
  type ReadingTask,
  type Submission,
} from '@/readpact/chain'
import '@/readpact/readpact.css'
import bookCover from '@/readpact/assets/naval.jpg'
import EditorialHome from '@/readpact/EditorialHome'
import ChallengeFlow from '@/readpact/ChallengeFlow'
import { getReadingBooks, checkReadingAnswer } from '@/api/readpact'
import { countBookReaders } from '@/readpact/book-readers'
import type { ReadingBook } from '@/readpact/books'
export interface Group {
  id: string
  bookId: string
  creator: string
  startedAt: number
  joinUntil: number
  periodSeconds: number
  graceSeconds: number
  totalDays: number
  requiredDays: number
  demo: boolean
  settled: boolean
  cancelled: boolean
  pool: bigint
  reservedFund: bigint
  people: {
    address: string
    completed: number
    claimable: bigint
    days: { hash: string; count: number; done: boolean; witnessed: boolean }[]
  }[]
}
function Reflection({
  hash,
  participant,
  challengeId,
  day,
  contractAddress,
  bookId,
  onConfirm,
  disabled,
}: {
  hash: string
  participant: string
  challengeId: string
  day: number
  contractAddress: string
  bookId: string
  onConfirm: () => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const q = useQuery({
    queryKey: ['reflection', hash, participant, challengeId, day, contractAddress, bookId],
    queryFn: async () => {
      const { data } = await http.get<Submission>(`/readpact/submissions/${hash}`)
      const prefix = `ReadPact reading submission\nChain: 10143\nContract: ${contractAddress.toLowerCase()}\nChallenge: ${challengeId}\nBook: ${bookId}\nDay: ${day}\nWallet: ${participant.toLowerCase()}\nAnswer: ${data.answer}\nReflection: ${data.reflection}\nNonce: `
      const tail = data.signingMessage.slice(prefix.length)
      if (
        !data.signingMessage.startsWith(prefix) ||
        !/^[0-9a-f-]{36}\nExpires: [0-9]+$/.test(tail) ||
        data.wallet.toLowerCase() !== participant.toLowerCase() ||
        data.challengeId !== challengeId ||
        data.bookId !== bookId ||
        data.contractAddress.toLowerCase() !== contractAddress.toLowerCase() ||
        data.day !== day ||
        sha256(toUtf8Bytes(data.signingMessage)) !== hash ||
        !data.signature ||
        verifyMessage(data.signingMessage, data.signature).toLowerCase() !==
          data.wallet.toLowerCase()
      )
        throw Error('内容签名校验失败')
      return data
    },
    retry: false,
  })
  return (
    <div className="reflection">
      {q.isPending ? (
        <p>{t('正在读取签名内容…')}</p>
      ) : q.isError ? (
        <p role="alert">{t('内容暂不可验证，请勿确认。')}</p>
      ) : (
        <>
          <blockquote>{q.data.reflection}</blockquote>
          <span className="caption">{t('钱包签名与链上内容一致')}</span>
          <button className="secondary" disabled={disabled} onClick={onConfirm}>
            {t('已读过这份感想，确认')}
          </button>
        </>
      )}
    </div>
  )
}
export default function ReadPact() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const { account, connect } = useWallet()
  const oldInvitation =
    new URLSearchParams(location.search).has('group') &&
    new URLSearchParams(location.search).get('version') !== '3'
  const [selected, setSelected] = useState(
    oldInvitation ? '' : (new URLSearchParams(location.search).get('group') ?? ''),
  )
  const [view, setView] = useState<'home' | 'mine' | 'create' | 'detail' | 'groups'>(
    new URLSearchParams(location.search).get('view') === 'groups'
      ? 'groups'
      : new URLSearchParams(location.search).get('view') === 'mine'
        ? 'mine'
        : new URLSearchParams(location.search).get('view') === 'create'
          ? 'create'
          : selected
            ? 'detail'
            : 'home',
  )
  const [browseOrigin, setBrowseOrigin] = useState<'home' | 'library'>(
    new URLSearchParams(location.search).get('from') === 'library' ? 'library' : 'home',
  )
  const [walletGroup, setWalletGroup] = useState(selected)
  const invitation = new URL('https://staff.dushu365.com/readpact/')
  if (walletGroup) {
    invitation.searchParams.set('group', walletGroup)
    invitation.searchParams.set('version', '3')
  }
  const metamaskLink = `https://link.metamask.io/dapp/${invitation.host}${invitation.pathname}${invitation.search}`
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState('')
  const [paymentRevision, setPaymentRevision] = useState(0)
  const [paymentStorageError, setPaymentStorageError] = useState(false)
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))
  const [demo, setDemo] = useState(false)
  const localTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }
  const [opening, setOpening] = useState(localTime(Math.floor(Date.now() / 1000) + 3 * 86400))
  const openingTimestamp = Math.floor(new Date(opening).getTime() / 1000)
  const validOpening =
    Number.isFinite(openingTimestamp) &&
    openingTimestamp > now + 60 &&
    openingTimestamp <= now + 30 * 86400
  const changeMode = (isDemo: boolean) => {
    setDemo(isDemo)
    setOpening(localTime(now + (isDemo ? 300 : 3 * 86400)))
  }
  const [answer, setAnswer] = useState(-1)
  const [quizDeadline, setQuizDeadline] = useState(0)
  const [quizPassed, setQuizPassed] = useState(false)
  const [reflection, setReflection] = useState('')
  useEffect(() => watchWallet(), [])
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  const configQuery = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const { data } = await http.get<Config>('/readpact/config')
      if (data.contractVersion !== 3) throw Error('请先发布定时共读版本后端')
      return data
    },
  })
  const config = configQuery.data
  const catalog = useQuery({ queryKey: ['books'], queryFn: getReadingBooks })
  const books = catalog.data ?? []
  const [selectedBookId, setSelectedBookId] = useState(
    new URLSearchParams(location.search).get('book') ?? '',
  )
  const selectedBook = books.find((book) => book.id === selectedBookId) ?? books[0]
  const bookFor = (g: Group): ReadingBook | undefined =>
    books.find((book) => book.id.toLowerCase() === g.bookId.toLowerCase())
  const createBook = (id: string, from: 'home' | 'library' = 'home') => {
    setBrowseOrigin(from)
    setSelectedBookId(id)
    navigate('create')
    const url = new URL(location.href)
    url.searchParams.set('view', 'create')
    url.searchParams.set('book', id)
    url.searchParams.set('from', from)
    history.replaceState(null, '', url)
  }

  const chain = useQuery({
    queryKey: ['groups', config?.chainId, config?.contractAddress, config?.rpcUrl],
    queryFn: () => loadGroupList(readContract(config!) as unknown as GroupReader),
    enabled: Boolean(config?.contractAddress),
    staleTime: 60000,
    gcTime: 600000,
    refetchInterval: 60000,
    retry: 1,
  })
  const summary = chain.data?.find((g) => g.id === selected)
  const detail = useQuery({
    queryKey: [
      'group-detail',
      config?.chainId,
      config?.contractAddress,
      config?.rpcUrl,
      selected,
      account.toLowerCase(),
      summary?.people.map((p) => p.address).join(','),
      summary?.settled,
    ],
    queryFn: () =>
      loadGroupDetail(readContract(config!) as unknown as GroupReader, summary!, account, now),
    enabled: Boolean(config && summary && view === 'detail'),
    staleTime: 15000,
    gcTime: 600000,
    refetchInterval: view === 'detail' ? 30000 : false,
    retry: 1,
  })
  const group = detail.data
  const bookReaders = countBookReaders(
    (chain.data ?? []).map((g) => ({ ...g, addresses: g.people.map((p) => p.address) })),
    now,
  )
  const accountClaims = useQuery({
    queryKey: [
      'group-claims',
      config?.chainId,
      config?.contractAddress,
      account.toLowerCase(),
      chain.dataUpdatedAt,
    ],
    queryFn: async () => {
      const c = readContract(config!)
      const own = (chain.data ?? []).filter((g) =>
        g.people.some((p) => p.address.toLowerCase() === account.toLowerCase()),
      )
      const amounts = await Promise.all(
        own.map(async (g) => BigInt((await c.members(g.id, account)).claimable)),
      )
      return amounts.reduce((sum, value) => sum + value, 0n)
    },
    enabled: Boolean(config && account && chain.data && view === 'mine'),
    staleTime: 30000,
    retry: 1,
  })
  const me = group?.people.find((p) => p.address.toLowerCase() === account.toLowerCase())
  const elapsed =
    group && group.startedAt ? Math.floor((now - group.startedAt) / group.periodSeconds) : -1
  const active = Boolean(
    group && group.startedAt && !group.settled && elapsed >= 0 && elapsed < group.totalDays,
  )
  const day = Math.max(0, Math.min(elapsed, group ? group.totalDays - 1 : 0))
  const task = useQuery({
    queryKey: ['task', group?.bookId, day],
    queryFn: async () =>
      (await http.get<ReadingTask>(`/readpact/books/${group!.bookId}/tasks/${day}`)).data,
    enabled: active,
  })
  useEffect(() => {
    setAnswer(-1)
    setQuizDeadline(0)
    setQuizPassed(false)
    setReflection('')
  }, [selected, day, account])
  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label)
    setError('')
    try {
      await action()
      await Promise.all([
        client.invalidateQueries({ queryKey: ['groups'] }),
        client.invalidateQueries({ queryKey: ['group-detail'] }),
        client.invalidateQueries({ queryKey: ['group-claims'] }),
      ])
    } catch (e) {
      setError(
        (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message,
      )
    } finally {
      setBusy('')
    }
  }
  async function send(
    action: (c: Awaited<ReturnType<typeof writeContract>>) => Promise<ContractTransactionResponse>,
  ) {
    if (!config) throw Error('配置尚未加载')
    const c = await writeContract(config)
    const tx = await action(c)
    setTxHash(tx.hash)
    const receipt = await tx.wait()
    if (!receipt || receipt.status !== 1) throw Error('交易未成功，请重试')
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== config.contractAddress.toLowerCase()) continue
      const event = c.interface.parseLog({ topics: [...log.topics], data: log.data })
      if (event?.name !== 'Joined') continue
      const wallet = String(event.args.participant)
      if (wallet.toLowerCase() !== tx.from.toLowerCase()) continue
      let saved = false
      try {
        saved = savePayment(
          localStorage,
          paymentKey(config.chainId, config.contractAddress, wallet),
          {
            hash: receipt.hash,
            groupId: String(event.args.id),
            wallet,
            amount: String(event.args.amount),
            blockNumber: receipt.blockNumber,
          },
        )
      } catch {
        /* Storage access can be disabled by the browser. */
      }
      setPaymentStorageError(!saved)
      setPaymentRevision((value) => value + 1)
    }
    return receipt
  }
  function choose(id: string, from: 'home' | 'library' = 'home', checkin = false) {
    setBrowseOrigin(from)
    setSelected(id)
    setWalletGroup(id)
    setView('detail')
    window.scrollTo(0, 0)
    const url = new URL(location.href)
    url.searchParams.delete('view')
    if (checkin) url.searchParams.set('panel', 'checkin')
    else url.searchParams.delete('panel')
    url.searchParams.set('group', id)
    url.searchParams.set('from', from)
    url.searchParams.set('version', '3')
    history.replaceState(null, '', url)
  }
  async function submit() {
    if (!config || !group || !task.data) return
    const s = await signer(config)
    const wallet = await s.getAddress()
    if (wallet.toLowerCase() !== account.toLowerCase()) throw Error('钱包账户已改变，请重新连接')
    const { data } = await http.post<Submission>('/readpact/submissions/prepare', {
      bookId: group.bookId,
      challengeId: group.id,
      day,
      wallet,
      answer,
      reflection,
    })
    const signature = await s.signMessage(data.signingMessage)
    const confirmed = (
      await http.post<Submission>('/readpact/submissions/confirm', {
        contentHash: data.contentHash,
        signature,
      })
    ).data
    await send((c) => c.submit(group.id, day, confirmed.contentHash))
  }
  const canSettle =
    group &&
    group.startedAt > 0 &&
    !group.settled &&
    now >= group.startedAt + group.totalDays * group.periodSeconds + group.graceSeconds
  const winners = group?.people.filter((p) => p.completed >= group.requiredDays).length ?? 0
  const reward =
    group && winners > 0
      ? (group.pool + (winners === group.people.length ? group.reservedFund : 0n)) / BigInt(winners)
      : 0n
  const myAward = group?.cancelled
    ? parseEther('10')
    : me && group && me.completed >= group.requiredDays
      ? reward
      : 0n
  const balance = useQuery({
    queryKey: ['wallet-balance', config?.rpcUrl, account],
    queryFn: async () => {
      const provider = readContract(config!).runner?.provider
      if (!provider) throw Error('网络尚未就绪')
      return provider.getBalance(account)
    },
    enabled: Boolean(config?.contractAddress && account && view === 'mine'),
    refetchInterval: 15000,
  })
  const myGroups =
    chain.data?.filter((g) =>
      g.people.some((p) => p.address.toLowerCase() === account.toLowerCase()),
    ) ?? []
  const spotlight =
    myGroups.find((g) => !g.settled) ??
    chain.data?.find(
      (g) =>
        !g.settled &&
        g.startedAt > 0 &&
        now >= g.startedAt &&
        now < g.startedAt + g.totalDays * g.periodSeconds,
    )
  const locked = myGroups.filter((g) => !g.settled).length * 10
  const paymentHistory = useQuery({
    queryKey: [
      'local-payments',
      config?.chainId,
      config?.contractAddress,
      account,
      paymentRevision,
    ],
    queryFn: () => {
      try {
        return config
          ? readPayments(localStorage, paymentKey(config.chainId, config.contractAddress, account))
          : []
      } catch {
        return []
      }
    },
    enabled: Boolean(config && account && view === 'mine'),
  })
  const claimable = accountClaims.data

  const status = (g: Group) =>
    g.cancelled
      ? t('已取消')
      : g.settled
        ? t('已结算')
        : g.startedAt
          ? now < g.startedAt
            ? t('已成组 · 待开读')
            : now >= g.startedAt + g.totalDays * g.periodSeconds
              ? t('待结算')
              : t('进行中')
          : now >= g.joinUntil
            ? t('组队过期')
            : t('组队中')
  const groups = (chain.data ?? []).filter((g) => {
    const matches =
      !search.trim() ||
      `${g.id} ${bookFor(g)?.name ?? ''} ${bookFor(g)?.title ?? ''}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    return (
      matches &&
      (filter === 'all' ||
        (filter === 'open' && !g.settled && now < g.joinUntil && g.people.length < 10) ||
        (filter === 'active' && g.startedAt > 0 && now >= g.startedAt && !g.settled) ||
        (filter === 'settled' && g.settled))
    )
  })
  function navigate(next: 'home' | 'mine' | 'create' | 'groups') {
    setView(next)
    setSelected('')
    setError('')
    const url = new URL(location.pathname, location.origin)
    if (next === 'groups') url.searchParams.set('view', 'groups')
    if (next === 'mine') {
      url.searchParams.set('view', 'mine')
      if (walletGroup) {
        url.searchParams.set('group', walletGroup)
        url.searchParams.set('version', '3')
      }
    }
    history.replaceState(null, '', url)
    window.scrollTo(0, 0)
  }
  const backToBrowse = () => {
    navigate('home')
    if (browseOrigin === 'library') {
      const url = new URL(location.href)
      url.searchParams.set('view', 'library')
      history.replaceState(null, '', url)
    }
  }
  const walletButton = (label = t('连接 MetaMask')) => (
    <button
      className="wallet"
      disabled={Boolean(busy)}
      onClick={() => void run(t('连接钱包'), connect)}
    >
      <Wallet size={18} />
      {label}
      <ArrowRight size={18} />
    </button>
  )
  const groupCard = (g: Group) => (
    <button className="group-card" key={g.id} onClick={() => choose(g.id)}>
      <img src={bookFor(g)?.cover ?? bookCover} alt={bookFor(g)?.name ?? t('书籍封面')} />
      <span className="group-copy">
        <span className="book-en">{bookFor(g)?.title ?? t('未知书籍')}</span>
        <b>{bookFor(g)?.name ?? t('未知书籍')}</b>
        <small>
          #{g.id} · {g.demo ? t('快速共读') : t('21 天挑战')} · {status(g)}
        </small>
        <span className="group-people">
          <Users size={13} />
          {g.people.length} {t('位读者')} · {formatEther(g.pool)} MON
        </span>
      </span>
      <span className="group-go">
        <ArrowUpRight size={18} />
      </span>
    </button>
  )

  return (
    <main
      className={`readpact readpact-${view}`}
      style={
        {
          '--book-tone': (group ? bookFor(group) : selectedBook)?.tone ?? '#eee8dc',
          '--book-accent': (group ? bookFor(group) : selectedBook)?.accent ?? '#171a14',
        } as CSSProperties
      }
    >
      {view !== 'home' && view !== 'detail' && (
        <header className="editorial-header">
          {view === 'groups' ? (
            <>
              <div>
                <time>
                  {new Date(now * 1000).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: '2-digit',
                  })}
                </time>
                <span className="wordmark">ReadPact 阅约</span>
              </div>
              <div className="header-actions">
                <button
                  className="icon-button"
                  aria-label={t('搜索挑战')}
                  aria-expanded={searchOpen}
                  onClick={() => setSearchOpen(!searchOpen)}
                >
                  <Search size={24} />
                </button>
                <button
                  className="profile-button"
                  aria-label={t('我的 · 钱包与挑战')}
                  onClick={() => navigate('mine')}
                >
                  <UserRound size={23} />
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                className="icon-button back-icon"
                aria-label={t(
                  view === 'create' && browseOrigin === 'library' ? '返回阅读广场' : '返回首页',
                )}
                onClick={view === 'create' ? backToBrowse : () => navigate('home')}
              >
                <ArrowLeft size={20} />
              </button>
              <div className="view-heading">
                <h1>
                  {view === 'mine' ? t('我的') : view === 'create' ? t('发起挑战') : t('共读挑战')}
                </h1>
                <p>{view === 'mine' ? t('钱包与我的阅读约定') : t('读完一本书，兑现一个约定')}</p>
              </div>
              <span className="network">Monad Testnet</span>
            </>
          )}
        </header>
      )}
      {configQuery.isError && <p className="error">{t('无法连接后端，请检查服务是否启动。')}</p>}
      {config && !config.contractAddress && (
        <p className="notice">{t('合约配置尚未就绪，暂时无法发起或加入。')}</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <p className="notice" role="status">
          {busy} · {t('正在处理…')}
        </p>
      )}
      {txHash && config && (
        <a className="tx" target="_blank" rel="noreferrer" href={`${config.explorer}/tx/${txHash}`}>
          {t('最近交易')} {short(txHash)} <ArrowUpRight size={14} />
        </a>
      )}
      {chain.isError && (
        <p className="error">
          {chain.data ? t('更新失败，正在显示已缓存的小组。') : t('小组读取失败，请重试。')}
          <button onClick={() => void chain.refetch()}>重试</button>
        </p>
      )}
      {detail.isError && view === 'detail' && (
        <p className="error">
          {detail.data ? '详情更新失败，保留已缓存记录。' : '成员与打卡记录读取失败。'}
          <button onClick={() => void detail.refetch()}>重试详情</button>
        </p>
      )}
      {oldInvitation && (
        <p className="notice">
          {t('这是旧版小组链接。项目已切换定时共读版本，请从新版书架重新发起或加入。')}
        </p>
      )}
      {view === 'home' &&
        (catalog.isPending ? (
          <p className="empty-state">{t('正在加载书架…')}</p>
        ) : catalog.isError ? (
          <div className="empty-state">
            <p>{t('书架暂时无法加载')}</p>
            <button onClick={() => void catalog.refetch()}>{t('重试')}</button>
          </div>
        ) : books.length > 0 ? (
          <EditorialHome
            books={books}
            groupsLoading={chain.isPending}
            bookReaders={bookReaders}
            groups={(chain.data ?? []).map((g) => ({
              id: g.id,
              bookId: g.bookId,
              people: g.people.length,
              pool: formatEther(g.pool),
              demo: g.demo,
              startsAt: g.joinUntil,
              joined:
                g.people.some((person) => person.address.toLowerCase() === account.toLowerCase()) &&
                !g.settled,
              active:
                !g.settled &&
                g.startedAt > 0 &&
                now >= g.startedAt &&
                now < g.startedAt + g.totalDays * g.periodSeconds,
              open: !g.settled && now < g.joinUntil && g.people.length < 10,
            }))}
            onGroup={choose}
            now={now}
            onAccount={() => navigate('mine')}
            onGroups={() => navigate('groups')}
            onCreate={createBook}
            activeChallenge={
              spotlight && bookFor(spotlight)
                ? {
                    owned: myGroups.some((g) => g.id === spotlight.id),
                    cover: bookFor(spotlight)!.cover,
                    title: bookFor(spotlight)!.title,
                    name: bookFor(spotlight)!.name,
                    progress: `${spotlight.people.length} 位读者共同阅读`,
                    period: `#${spotlight.id} · ${status(spotlight)}`,
                    dayLabel:
                      spotlight.startedAt > 0 && now >= spotlight.startedAt
                        ? `第 ${Math.min(spotlight.totalDays, Math.floor((now - spotlight.startedAt) / spotlight.periodSeconds) + 1)} ${spotlight.demo ? '轮' : '天'}`
                        : '待开读',
                    onOpen: () =>
                      choose(
                        spotlight.id,
                        'home',
                        spotlight.startedAt > 0 && now >= spotlight.startedAt,
                      ),
                  }
                : undefined
            }
          />
        ) : (
          <p className="empty-state">{t('书架暂无书籍')}</p>
        ))}
      {view === 'groups' && (
        <>
          {searchOpen && (
            <div className="search-bar">
              <Search size={18} />
              <input
                aria-label={t('书名或小组编号')}
                placeholder={t('搜索书名或小组编号')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                className="icon-button"
                aria-label={t('关闭搜索')}
                onClick={() => {
                  setSearchOpen(false)
                  setSearch('')
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="section-heading list-heading">
            <h2>{t('共读广场')}</h2>
            <button
              className="text-button"
              onClick={() => selectedBook && createBook(selectedBook.id)}
            >
              {t('发起新的')}
              <Plus size={15} />
            </button>
          </div>
          <div className="filter-tabs" aria-label={t('挑战状态')}>
            {[
              ['all', '全部'],
              ['open', '组队中'],
              ['active', '进行中'],
              ['settled', '已结算'],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={filter === value ? 'selected' : ''}
                onClick={() => setFilter(value)}
              >
                {t(label)}
              </button>
            ))}
          </div>
          {chain.isPending && config?.contractAddress && (
            <p className="empty-state">{t('正在读取链上小组…')}</p>
          )}
          <div className="challenge-list">{groups.map(groupCard)}</div>
          {chain.data && groups.length === 0 && (
            <div className="empty-state">
              <Users size={26} />
              <p>
                {search
                  ? t('没有找到匹配的小组，试试其他关键词。')
                  : t('这里还没有挑战，发起一份新的共读约定吧。')}
              </p>
              <button
                className="secondary"
                onClick={() => selectedBook && createBook(selectedBook.id)}
              >
                {t('发起共读')}
              </button>
            </div>
          )}
          <button className="secondary" onClick={() => navigate('home')}>
            {t('返回书架')}
          </button>
        </>
      )}
      {view === 'mine' && (
        <>
          <section className="account-profile">
            <span className="account-avatar">
              <UserRound size={28} />
            </span>
            <div>
              <h2>{account ? t('共读者') : t('欢迎来到阅约')}</h2>
              <p>{account ? short(account) : t('连接钱包，开始你的阅读约定')}</p>
            </div>
          </section>
          <section className="wallet-card">
            <div className="wallet-top">
              <span>READPACT WALLET</span>
              <span>Monad Testnet</span>
            </div>
            <div className="wallet-balance">
              {account
                ? balance.isError
                  ? '—'
                  : balance.data !== undefined
                    ? Number(formatEther(balance.data)).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })
                    : '…'
                : '—'}{' '}
              <small>MON</small>
            </div>
            <p>{t('钱包余额')}</p>
            {!account ? (
              walletButton()
            ) : (
              <a
                className="wallet-link"
                href={`${config?.explorer}/address/${account}`}
                target="_blank"
                rel="noreferrer"
              >
                {short(account)} <ArrowUpRight size={15} />
              </a>
            )}
            <div className="wallet-meta">
              <div>
                <span>{t('挑战中锁定')}</span>
                <b>{account ? locked : '—'} MON</b>
              </div>
              <div>
                <span>{t('待领取')}</span>
                <b>{account && claimable !== undefined ? formatEther(claimable) : '—'} MON</b>
              </div>
            </div>
          </section>
          <section className="payment-history">
            <h2>{t('本机扣款记录')}</h2>
            <p>{t('发起与加入成功后的押金回执，不含手续费。最多保留最近 100 笔。')}</p>
            {!account ? (
              <p>{t('连接钱包后查看记录')}</p>
            ) : (
              <>
                {!paymentHistory.data?.length && <p>{t('本机暂无成功扣款记录')}</p>}
                {paymentHistory.data?.map((record) => (
                  <article key={record.hash}>
                    <strong>
                      {t('小组')} #{record.groupId} · −{formatEther(record.amount)} MON
                    </strong>
                    <span>
                      {t('链上已确认')} · {t('区块')} {record.blockNumber}
                    </span>
                    <a
                      href={`${config?.explorer}/tx/${record.hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {short(record.hash)} ↗
                    </a>
                  </article>
                ))}
                <a href={`${config?.explorer}/address/${account}`} target="_blank" rel="noreferrer">
                  {t('查看钱包全部链上记录')} ↗
                </a>
              </>
            )}
            {paymentStorageError && (
              <p>{t('扣款已成功，但浏览器未能保存本机记录，请通过最近交易链接查看回执。')}</p>
            )}
          </section>
          {balance.isError && <p className="error">{t('余额读取失败，请稍后重试。')}</p>}
          <section className="mobile-wallet-entry">
            <a className="metamask-open" href={metamaskLink}>
              <Wallet size={18} />
              {t('在 MetaMask 中打开')}
              <ArrowUpRight size={18} />
            </a>
            <p>
              {walletGroup
                ? `${t('将打开当前小组')} #${walletGroup}${t('，邀请链接已保留。')}`
                : t('将在 MetaMask 内置浏览器中打开 ReadPact。')}
            </p>
            <a
              className="metamask-download"
              href="https://metamask.io/download"
              target="_blank"
              rel="noreferrer"
            >
              {t('还没安装？下载 MetaMask')}
              <ArrowUpRight size={14} />
            </a>
            <p>
              {t(
                '安装完成后，请返回这里再次点击打开。若微信内无法跳转，请先在系统浏览器中打开本页。',
              )}
            </p>
            {walletGroup && (
              <button className="secondary" onClick={() => choose(walletGroup)}>
                {t('返回当前小组')} #{walletGroup}
              </button>
            )}
          </section>
          {account && (
            <button
              className="secondary"
              disabled={Boolean(busy)}
              onClick={() => void run(t('重新连接钱包'), connect)}
            >
              {t('重新连接钱包')}
            </button>
          )}
          <div className="section-heading">
            <h2>{t('我的共读')}</h2>
            <span className="caption">
              {myGroups.length} {t('个小组')}
            </span>
          </div>
          <button className="secondary" onClick={() => choose('4', 'home')}>
            算法之美 · 小组 #4（链上记录）
          </button>
          <div className="account-challenges">
            {myGroups.map((g) => (
              <button className="account-challenge" key={g.id} onClick={() => choose(g.id)}>
                <img src={bookFor(g)?.cover ?? bookCover} alt={bookFor(g)?.name} />
                <span>
                  <strong>{bookFor(g)?.title}</strong>
                  <small>
                    {bookFor(g)?.name} · {status(g)}
                  </small>
                </span>
                <ArrowRight size={19} />
              </button>
            ))}
          </div>
          {!myGroups.length && (
            <p className="empty-state">
              {account
                ? t('最近的小组中还没有你的约定，去广场看看吧。')
                : t('连接钱包后，可查看已参与的挑战。')}
            </p>
          )}
          <button className="secondary" onClick={() => navigate('home')}>
            {t('去共读广场')}
            <ArrowRight size={17} />
          </button>
          <p className="caption">{t('锁定、待领取和参与记录统计最近 20 个链上小组。')}</p>
        </>
      )}
      {view === 'create' && selectedBook && (
        <>
          <section className="create-book">
            <img src={selectedBook.cover} alt={selectedBook.name} />
            <div>
              <h2>{selectedBook.title}</h2>
              <b>{selectedBook.name}</b>
              <p>{selectedBook.author}</p>
            </div>
          </section>
          <section className="create-setup">
            <div className="row">
              <h3>{t('选择共读节奏')}</h3>
              <span>{t('按约定时间统一开读')}</span>
            </div>
            <div className="mode-options">
              <button
                className={!demo ? 'on' : ''}
                aria-pressed={!demo}
                onClick={() => changeMode(false)}
              >
                {t('21 天 · 日常共读')}
              </button>
              <button
                className={demo ? 'on' : ''}
                aria-pressed={demo}
                onClick={() => changeMode(true)}
              >
                {t('3 轮 · 快速共读')}
              </button>
            </div>
            <p>
              {demo
                ? t('每轮 2 分钟，完成 2 轮达标；另有 1 分钟见证宽限。')
                : t('每天 1 轮，完成 18 天达标；另有 1 小时见证宽限。')}
            </p>
          </section>
          <section className="create-setup opening-setup">
            <div className="row">
              <h3>{t('什么时候开始？')}</h3>
              <span>{t('当前设备时区')}</span>
            </div>
            <div className="mode-options">
              {(demo ? [5, 10] : [3, 7]).map((value) => (
                <button
                  key={value}
                  onClick={() => setOpening(localTime(now + value * (demo ? 60 : 86400)))}
                >
                  {demo ? `${value} ${t('分钟后')}` : `${value} ${t('天后')}`}
                </button>
              ))}
            </div>
            <label htmlFor="opening-time">{t('开读时间')}</label>
            <input
              id="opening-time"
              type="datetime-local"
              value={opening}
              min={localTime(now + 120)}
              max={localTime(now + 30 * 86400)}
              onChange={(e) => setOpening(e.target.value)}
            />
            {!validOpening && <p className="error">{t('请选择 1 分钟后至 30 天内的开读时间。')}</p>}
          </section>
          <section className="create-rule">
            <div>
              <strong>{t('满 3 人成组，最多 10 人')}</strong>
              <p>
                {t(
                  '发起即缴 10 MON 并成为首位成员。到约定时间统一开读；不足 3 人可退款，每次打卡需两位同伴确认。',
                )}
              </p>
            </div>
            <b>
              10<small>MON / {t('人')}</small>
            </b>
          </section>
          {!account && walletButton(t('连接钱包，开始创建'))}
          <button
            className="create-submit"
            disabled={
              !account ||
              !config?.contractAddress ||
              !selectedBook.challengeEnabled ||
              !validOpening ||
              Boolean(busy)
            }
            onClick={() =>
              void run(t('创建挑战'), async () => {
                if (!validOpening) throw Error(t('请重新设置有效的开读时间'))
                const receipt = await send((c) =>
                  c.createChallenge(selectedBook.id, demo, openingTimestamp, {
                    value: parseEther('10'),
                  }),
                )
                const contract = readContract(config!)
                const created = receipt.logs
                  .map((log) => {
                    try {
                      return contract.interface.parseLog(log)
                    } catch {
                      return null
                    }
                  })
                  .find((event) => event?.name === 'ChallengeCreated')
                if (!created) throw Error('未找到创建事件，请刷新小组列表')
                choose(String(created.args.id), browseOrigin)
              })
            }
          >
            {t('锁定 10 MON，发起挑战')}
            <ArrowRight size={20} />
          </button>{' '}
        </>
      )}
      {view === 'detail' && !group && (
        <div className="empty-state">
          {summary
            ? `${bookFor(summary)?.name ?? ''} · ${summary.people.length} 人 · ${formatEther(summary.pool)} MON`
            : chain.isPending
              ? t('正在读取小组列表…')
              : t('暂未找到该小组，请重试。')}
          {summary && (
            <p>
              {detail.isError ? '详情暂不可用，列表数据已保留。' : '正在读取本组成员与打卡记录…'}
            </p>
          )}
          <button
            className="secondary"
            onClick={() => void (summary ? detail.refetch() : chain.refetch())}
          >
            {t('重新加载')}
          </button>
          <button className="secondary" onClick={() => navigate('groups')}>
            返回广场
          </button>
        </div>
      )}
      {view === 'detail' && group && (
        <ChallengeFlow
          key={group.id}
          group={group}
          book={bookFor(group)}
          account={account}
          now={now}
          busy={Boolean(busy)}
          active={active}
          day={day}
          me={me}
          task={task.data}
          taskError={task.isError}
          canSettle={Boolean(canSettle)}
          reward={reward}
          myAward={myAward}
          answer={answer}
          quizDeadline={quizDeadline}
          quizPassed={quizPassed}
          reflection={reflection}
          onBack={backToBrowse}
          onConnect={() => void run(t('连接钱包'), connect)}
          onJoin={() =>
            void run(t('入金 10 MON'), () =>
              send((c) => c.join(group.id, { value: parseEther('10') })),
            )
          }
          onCancel={() =>
            void run(t('取消并解锁退款'), () => send((c) => c.cancelExpired(group.id)))
          }
          onSettle={() => void run(t('结算挑战'), () => send((c) => c.settle(group.id)))}
          onClaim={() => void run(t('领取到钱包'), () => send((c) => c.claim(group.id)))}
          onQuiz={() => {
            setQuizDeadline(now + 30)
            setAnswer(-1)
          }}
          onAnswer={setAnswer}
          onCheck={() =>
            void run(t('校验答案'), async () => {
              await checkReadingAnswer(group.bookId, day, answer)
              if (Math.floor(Date.now() / 1000) >= quizDeadline)
                throw Error(t('答题超时，请重新阅读'))
              setQuizPassed(true)
            })
          }
          onReflection={setReflection}
          onSubmit={() => void run(t('签名并提交打卡'), submit)}
          onRetryTask={() => void task.refetch()}
          ownReflection={
            me?.days[day] && me.days[day].hash !== ZeroHash ? (
              <Reflection
                hash={me.days[day].hash}
                participant={me.address}
                challengeId={group.id}
                day={day}
                contractAddress={config!.contractAddress}
                bookId={group.bookId}
                disabled
                onConfirm={() => {}}
              />
            ) : undefined
          }
          witnesses={
            <>
              <p className="flow-hint">
                {t('查看感想后再确认。不能自我见证，每次打卡需要两位不同同伴。')}
              </p>{' '}
              {group.people
                .flatMap((p) => p.days.map((e, i) => ({ p, e, i })))
                .filter(
                  ({ e, i }) =>
                    e.hash !== ZeroHash &&
                    !e.done &&
                    now < group.startedAt + (i + 1) * group.periodSeconds + group.graceSeconds,
                )
                .map(({ p, e, i }) => (
                  <div className="witness" key={`${p.address}-${i}`}>
                    <b>
                      {short(p.address)} · {t('第')} {i + 1} {t('轮')} · {e.count}/2
                    </b>
                    <Reflection
                      hash={e.hash}
                      participant={p.address}
                      challengeId={group.id}
                      day={i}
                      contractAddress={config!.contractAddress}
                      bookId={group.bookId}
                      disabled={
                        !me ||
                        Boolean(busy) ||
                        p.address.toLowerCase() === account.toLowerCase() ||
                        e.witnessed
                      }
                      onConfirm={() =>
                        void run(t('确认朋友打卡'), () =>
                          send((c) => c.attest(group.id, p.address, i, e.hash)),
                        )
                      }
                    />
                  </div>
                ))}
            </>
          }
        />
      )}
      <footer>
        {t('发起或加入需钱包签名并缴纳 10 MON，另需网络手续费。')}
        {config?.contractAddress && (
          <a
            href={`${config.explorer}/address/${config.contractAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('查看合约')} {short(config.contractAddress)} ↗
          </a>
        )}
      </footer>
    </main>
  )
}
