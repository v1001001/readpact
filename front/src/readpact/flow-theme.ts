import type { ReadingBook } from '@/readpact/books'

// Secondary-screen palette from the supplied 1017.html; catalogue data stays in the API.
const themes: Record<string, { tone: string; accent: string; highlight: string }> = {
  'Algorithms to Live By': {
    tone: '#f3e48e',
    accent: '#3b3610',
    highlight: '#e3b817',
  },
  'Life After Google': {
    tone: '#c7d9ec',
    accent: '#304e73',
    highlight: '#668cc8',
  },
  Ethereum: {
    tone: '#eee0c5',
    accent: '#4c4438',
    highlight: '#c59b5a',
  },
  'Blockchain Revolution': {
    tone: '#cbe4f0',
    accent: '#126285',
    highlight: '#50a6c8',
  },
  'The Formula': {
    tone: '#f0c7be',
    accent: '#7a3028',
    highlight: '#d96653',
  },
  Superintelligence: {
    tone: '#e4ddb7',
    accent: '#51451f',
    highlight: '#b89b3f',
  },
  'The Black Swan': {
    tone: '#e9bec5',
    accent: '#732a3a',
    highlight: '#c84d64',
  },
  'Super Nintendo': {
    tone: '#f4e19f',
    accent: '#59441c',
    highlight: '#d9aa27',
  },
}
export function flowTheme(book?: ReadingBook) {
  return (
    (book && themes[book.title]) ?? {
      tone: book?.tone ?? '#fff3b2',
      accent: book?.accent ?? '#171a10',
      highlight: book?.tone ?? '#f6d83e',
    }
  )
}
