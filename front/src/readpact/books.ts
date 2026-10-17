export interface ReadingBook {
  id: string
  slug: string
  name: string
  title: string
  author: string
  cover: string
  categories: string[]
  tone: string
  accent: string
  challengeEnabled: boolean
  sortOrder: number
}
