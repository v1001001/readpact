import http from '@/api/http'
export interface DemoProgress {
  id: string
  bookId: string
  currentDay: number
  completedDays: string
  reflection: string
  submitted: boolean
  witnessOne: boolean
  witnessTwo: boolean
}
export const demoProgressKey = ['algorithm-demo-progress']
export const getDemoProgress = async () =>
  (await http.get<DemoProgress>('/readpact/demos/algorithms')).data
export const submitDemo = async (answer: number, reflection: string) =>
  (await http.post<DemoProgress>('/readpact/demos/algorithms/submit', { answer, reflection })).data
export const confirmDemo = async (witness: number) =>
  (await http.post<DemoProgress>('/readpact/demos/algorithms/confirm', { witness })).data
export const completedDemoDays = (p: DemoProgress) => [
  ...p.completedDays.split(',').map(Number),
  ...(p.witnessOne && p.witnessTwo ? [p.currentDay] : []),
]

export const resetDemo = async () =>
  (await http.post<DemoProgress>('/readpact/demos/algorithms/reset')).data
