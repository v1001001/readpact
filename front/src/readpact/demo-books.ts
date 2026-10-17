/** Only these books use the explicitly labelled, non-paying presentation flow. */
export const demoBooks = [
  {
    slug: 'algorithms-to-live-by-v1',
    people: 5,
    readers: 892,
    start: '2026-09-27',
    startLabel: '第 21 天 · 9月27日开始',
  },
  {
    slug: 'life-after-google-v1',
    people: 3,
    readers: 436,
    start: '2026-10-20',
    startLabel: '3天后开始 · 10月20日',
  },
  {
    slug: 'blockchain-revolution-v1',
    people: 4,
    readers: 624,
    start: '2026-10-18',
    startLabel: '明天开始 · 10月18日',
  },
  {
    slug: 'the-formula-v1',
    people: 6,
    readers: 557,
    start: '2026-10-22',
    startLabel: '5天后开始 · 10月22日',
  },
  {
    slug: 'superintelligence-v1',
    people: 4,
    readers: 483,
    start: '2026-10-19',
    startLabel: '2天后开始 · 10月19日',
  },
  {
    slug: 'black-swan-v1',
    people: 2,
    readers: 931,
    start: '2026-10-24',
    startLabel: '7天后开始 · 10月24日',
  },
  {
    slug: 'super-nintendo-v1',
    people: 0,
    readers: 386,
    start: '2026-10-20',
    startLabel: '3天后开始 · 10月20日',
  },
]
export const demoBook = (slug: string) => demoBooks.find((book) => book.slug === slug)
export const DEMO_NOW = Date.parse('2026-10-17T12:00:00+08:00') / 1000
