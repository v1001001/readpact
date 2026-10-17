import { useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, ChevronRight, Search, UserRound, Medal, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type ReadingBook } from '@/readpact/books'
import '@/readpact/editorial-home.css'

const categories = [
  ['all', 'All Books'],
  ['tech', 'Technology'],
  ['web3', 'Web3'],
  ['business', 'Business'],
  ['ideas', 'Ideas'],
  ['culture', 'Culture'],
]
const categoryNames: Record<string, string> = {
  tech: '科技',
  web3: 'Web3',
  business: '商业',
  ideas: '思想',
  culture: '文化',
}
const shelfOrder = [1, 2, 7, 3, 4, 5, 6, 0]
export default function EditorialHome({
  now,
  onAccount,
  onGroups,
  onCreate,
  books,
  activeChallenge,
  groups,
  bookReaders,
  groupsLoading,
  onGroup,
}: {
  groups: {
    id: string
    bookId: string
    people: number
    pool: string
    demo: boolean
    startsAt: number
    joined: boolean
    active: boolean
    open: boolean
  }[]
  groupsLoading: boolean
  bookReaders: Record<string, number>
  onGroup: (id: string, from?: 'home' | 'library', checkin?: boolean) => void
  books: ReadingBook[]
  onCreate: (bookId: string, from?: 'home' | 'library') => void
  now: number
  onAccount: () => void
  onGroups: () => void
  activeChallenge?: {
    owned: boolean
    dayLabel?: string
    cover: string
    title: string
    name: string
    progress: string
    period: string
    onOpen: () => void
  }
}) {
  const { t } = useTranslation()
  const [page, setPage] = useState<'home' | 'library' | 'book'>(
    new URLSearchParams(location.search).get('view') === 'library' ? 'library' : 'home',
  )
  const [createOnly, setCreateOnly] = useState(
    new URLSearchParams(location.search).get('intent') === 'create',
  )
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selected] = useState<ReadingBook>(books[0])
  const [returnPage] = useState<'home' | 'library'>('home')
  const changePage = (next: typeof page) => {
    setPage(next)
    if (next !== 'book') {
      const url = new URL(location.href)
      if (next === 'library') url.searchParams.set('view', 'library')
      else {
        url.searchParams.delete('view')
        url.searchParams.delete('intent')
        setCreateOnly(false)
      }
      history.replaceState(null, '', url)
    }
    window.scrollTo(0, 0)
  }
  const openLibrary = (create: boolean) => {
    setCreateOnly(create)
    changePage('library')
    const url = new URL(location.href)
    if (create) url.searchParams.set('intent', 'create')
    else url.searchParams.delete('intent')
    history.replaceState(null, '', url)
  }
  const featured = activeChallenge ?? {
    ...books[0],
    progress: t('21 天共读 · 完成 18 天'),
    period: t('社科 · 科技'),
    onOpen: () => onCreate(books[0].id),
  }
  const bookStyle = (book: ReadingBook) =>
    ({ '--book-tone': book.tone, '--book-accent': book.accent }) as CSSProperties
  const bookCard = (book: ReadingBook) => {
    const group =
      groups.find((g) => g.bookId === book.id && g.joined) ??
      groups.find((g) => g.bookId === book.id && g.open) ??
      groups.find((g) => g.bookId === book.id && g.active)
    const target = createOnly && page === 'library' ? undefined : group
    return (
      <article className="shelf-book" key={book.id} style={bookStyle(book)}>
        <img src={book.cover} alt={t('{{name}}封面', { name: book.name })} loading="lazy" />
        <div className="shelf-copy">
          <h3>{book.title}</h3>
          <b>{t(book.name)}</b>
          <p>{book.categories.map((key) => t(categoryNames[key])).join(' · ')}</p>
          <span className="shelf-status">
            {target
              ? `${new Date(target.startsAt * 1000).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ${t('开读')}`
              : t('21 天 · 10 MON 押金')}
          </span>
          <small>{t('本书 {{count}} 人在读', { count: bookReaders[book.id] ?? 0 })}</small>
          {target && (
            <small>
              {t('本组 {{count}} 人', { count: target?.people ?? 0 })} · {target?.pool} MON
            </small>
          )}
        </div>
        <button
          className="shelf-action"
          disabled={groupsLoading}
          aria-label={t('打开《{{name}}》挑战', { name: book.name })}
          onClick={() => {
            const from = page === 'library' ? 'library' : 'home'
            if (target) onGroup(target.id, from, target.active && page === 'home')
            else onCreate(book.id, from)
          }}
        >
          {t('加入')}
        </button>
      </article>
    )
  }
  if (page === 'book')
    return (
      <section className="book-preview" style={bookStyle(selected)}>
        <button
          className="icon-button"
          aria-label={t('返回书架')}
          onClick={() => changePage(returnPage)}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="book-preview-art">
          <img src={selected.cover} alt={t('{{name}}封面', { name: selected.name })} />
        </div>
        <span className="book-preview-label">READPACT READING LIST</span>
        <h1>{selected.title}</h1>
        <h2>{t(selected.name)}</h2>
        <p>{selected.author}</p>
        <div className="book-preview-status">
          <b>{selected.challengeEnabled ? t('21 天 · 完成 18 天') : t('挑战即将开放')}</b>
          <p>
            {selected.challengeEnabled
              ? t('每人 10 MON 押金，3–10 人一起读。')
              : t('这本书暂未开放入金和打卡。')}
          </p>
        </div>
        {selected.challengeEnabled && (
          <button className="book-preview-link" onClick={() => onCreate(selected.id)}>
            {t('发起这本书的共读')}
            <ArrowRight size={18} />
          </button>
        )}
        <button className="book-preview-link secondary" onClick={onGroups}>
          {t('查看已开放的共读挑战')}
          <ArrowRight size={18} />
        </button>
      </section>
    )
  if (page === 'library') {
    const term = search.trim().toLowerCase()
    const matches = books.filter(
      (book) =>
        (category === 'all' || book.categories.includes(category)) &&
        `${book.name} ${book.title} ${book.author}`.toLowerCase().includes(term),
    )
    return (
      <section className="reading-library">
        <aside className="library-rail">
          <button aria-label={t('返回首页')} onClick={() => changePage('home')}>
            <ArrowLeft size={22} />
          </button>
          <nav aria-label={t('书籍分类')}>
            {categories.map(([key, label]) => (
              <button key={key} aria-pressed={category === key} onClick={() => setCategory(key)}>
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="library-feed">
          <h1>{createOnly ? t('选择一本书发起挑战') : t('选择一本书开始挑战')}</h1>
          <div className="library-search">
            <Search size={15} />
            <input
              aria-label={t('搜索书籍')}
              placeholder={t('搜索书名或作者')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button aria-label={t('清空搜索')} onClick={() => setSearch('')}>
                <X size={15} />
              </button>
            )}
          </div>
          <div className="shelf-list">{matches.map(bookCard)}</div>
          {!matches.length && (
            <p className="empty-state">{t('没有找到匹配的书，换个关键词试试。')}</p>
          )}
        </div>
      </section>
    )
  }
  return (
    <section className="editorial-home">
      <div className="home-upper">
        <header className="home-masthead">
          <div>
            <time>
              {new Date(now * 1000).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: '2-digit',
              })}
            </time>
            <span>ReadPact</span>
          </div>
          <div className="home-actions">
            <button aria-label={t('搜索书籍')} onClick={() => openLibrary(false)}>
              <Search size={29} strokeWidth={2} />
            </button>
            <button
              className="home-profile"
              aria-label={t('我的 · 钱包与挑战')}
              onClick={onAccount}
            >
              <UserRound size={25} strokeWidth={1.7} />
            </button>
          </div>
        </header>
        <div className="home-section-head">
          <h1>
            {activeChallenge
              ? activeChallenge.owned
                ? t('我的共读')
                : t('进行中挑战')
              : t('开始共读')}
          </h1>
          <button onClick={activeChallenge ? activeChallenge.onOpen : onGroups}>
            {activeChallenge ? t('查看详情') : t('共读挑战')}
            <ChevronRight size={19} />
          </button>
        </div>
        <article className="home-feature">
          <img src={featured.cover} alt={t('{{name}}封面', { name: featured.name })} />
          <div className="home-feature-copy">
            <span className="home-progress">{featured.progress}</span>
            <h2>{featured.title}</h2>
            <b>{t(featured.name)}</b>
            <p>{activeChallenge ? t('阅读 · 共同见证') : t('社科 · 科技')}</p>
            <span className="home-period">
              {activeChallenge ? featured.period : books[0].author}
            </span>
            <button className="home-feature-cta" onClick={featured.onOpen}>
              <span>
                {activeChallenge?.dayLabel ?? (activeChallenge?.owned ? t('我的共读') : t('21 天'))}
              </span>
              <b>
                {activeChallenge ? t('去打卡') : t('发起挑战')}
                <ArrowRight size={20} />
              </b>
            </button>
          </div>
        </article>
        <button className="home-proof" onClick={onGroups}>
          <Medal size={21} strokeWidth={1.6} />
          <span>{t('全员达标，可分享同书基金；未完成的押金留给坚持的人。')}</span>
          <ChevronRight size={14} />
        </button>
      </div>
      <section className="home-shelves">
        <div className="home-section-head">
          <h2>{t('热门挑战')}</h2>
          <button onClick={() => openLibrary(true)}>
            {t('发起新的')}
            <ChevronRight size={19} />
          </button>
        </div>
        <div className="shelf-list">
          {shelfOrder
            .filter((index) => index < books.length)
            .map((index) => bookCard(books[index]))}
          {books.slice(shelfOrder.length).map(bookCard)}
        </div>
      </section>
    </section>
  )
}
