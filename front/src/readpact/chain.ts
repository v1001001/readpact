import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  type Eip1193Provider,
  type JsonRpcPayload,
  type JsonRpcResult,
} from 'ethers'
import { create } from 'zustand'
import http from '@/api/http'
import abi from '@/readpact/abi-v3.json'
export interface Config {
  contractVersion: number
  chainId: number
  rpcUrl: string
  contractAddress: string
  explorer: string
  bookTitle: string
}
export interface Submission {
  bookId: string
  contractAddress: string
  answer: number
  contentHash: string
  wallet: string
  challengeId: string
  day: number
  reflection: string
  signingMessage: string
  expiresAt: number
  signature?: string
}
export interface ReadingTask {
  day: number
  title: string
  card: string
  question: string
  options: string[]
}
class HttpProvider extends JsonRpcProvider {
  private pending: Promise<unknown> = Promise.resolve()
  private windowStartedAt = 0
  private windowCalls = 0
  async _send(payload: JsonRpcPayload | JsonRpcPayload[]): Promise<JsonRpcResult[]> {
    const request = this.pending.then(async () => {
      const calls = Array.isArray(payload) ? payload : [payload]
      const results: JsonRpcResult[] = []
      // Public testnet RPC permits 15 calls/sec. Pace all queries sharing this provider.
      for (let i = 0; i < calls.length; i += 5) {
        const batch = calls.slice(i, i + 5)
        if (Date.now() - this.windowStartedAt >= 1100) {
          this.windowStartedAt = Date.now()
          this.windowCalls = 0
        }
        if (this.windowCalls + batch.length > 5) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.max(0, 1100 - (Date.now() - this.windowStartedAt))),
          )
          this.windowStartedAt = Date.now()
          this.windowCalls = 0
        }
        this.windowCalls += batch.length
        const { data } = await http.post<JsonRpcResult | JsonRpcResult[]>(
          this._getConnection().url,
          batch,
          { timeout: 8000 },
        )
        results.push(...(Array.isArray(data) ? data : [data]))
      }
      return results
    })
    this.pending = request.catch(() => undefined)
    return request
  }
}
const providers = new Map<string, HttpProvider>()
export function readContract(config: Config) {
  let p = providers.get(config.rpcUrl)
  if (!p) {
    p = new HttpProvider(config.rpcUrl, config.chainId, { staticNetwork: true })
    providers.set(config.rpcUrl, p)
  }
  return new Contract(config.contractAddress, abi, p)
}
export const useWallet = create<{ account: string; connect: () => Promise<void> }>((set) => ({
  account: '',
  connect: async () => {
    const p = walletProvider()
    const accounts = (await p.send('eth_requestAccounts', [])) as string[]
    set({ account: accounts[0] ?? '' })
  },
}))
function injected() {
  const ethereum = (
    window as Window & {
      ethereum?: Eip1193Provider & {
        on?: (event: string, listener: (accounts: string[]) => void) => void
      }
    }
  ).ethereum
  if (!ethereum) throw Error('请在安装 MetaMask 的浏览器打开')
  return ethereum
}
export function walletProvider() {
  return new BrowserProvider(injected())
}
export async function signer(config: Config) {
  const ethereum = injected()
  const chainId = `0x${config.chainId.toString(16)}`
  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId,
          chainName: 'Monad Testnet',
          rpcUrls: [config.rpcUrl],
          nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
          blockExplorerUrls: [config.explorer],
        },
      ],
    })
  }
  const p = walletProvider()
  if ((await p.getNetwork()).chainId !== 10143n) throw Error('仅允许 Monad 测试网')
  const s = await p.getSigner()
  useWallet.setState({ account: await s.getAddress() })
  return s
}
export async function writeContract(config: Config) {
  return new Contract(config.contractAddress, abi, await signer(config))
}
export function watchWallet() {
  const e = (
    window as Window & {
      ethereum?: {
        on?: (event: string, listener: () => void) => void
        removeListener?: (event: string, listener: () => void) => void
      }
    }
  ).ethereum
  const reset = () => useWallet.setState({ account: '' })
  e?.on?.('accountsChanged', reset)
  e?.on?.('chainChanged', reset)
  return () => {
    e?.removeListener?.('accountsChanged', reset)
    e?.removeListener?.('chainChanged', reset)
  }
}
export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
