import http from '@/api/http'
import type { ReadingBook } from '@/readpact/books'
export async function getReadingBooks(): Promise<ReadingBook[]> {
  const { data } =
    await http.get<(Omit<ReadingBook, 'categories'> & { categories: string })[]>('/readpact/books')
  return data.map((book) => ({
    ...book,
    categories: book.categories.split(','),
    cover: book.cover.startsWith('/readpact/')
      ? `${import.meta.env.BASE_URL}${book.cover.slice('/readpact/'.length)}`
      : book.cover,
  }))
}
export async function checkReadingAnswer(bookId: string, day: number, answer: number) {
  await http.post(`/readpact/books/${bookId}/answers/check`, { day, answer })
}
