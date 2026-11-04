import { useEffect, useState } from 'react'
import { api, type RunRow } from './api'
import { Chat, Composer } from './Chat'
import { usd } from './model'

export default function App() {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [cwd, setCwd] = useState(localStorage.getItem('cwd') ?? '')
  const [maxCost, setMaxCost] = useState(Number(localStorage.getItem('maxCost') ?? 20))
  const [sidebar, setSidebar] = useState(true)

  const refresh = () => api.runs().then(setRuns).catch(() => {})
  useEffect(() => { refresh(); const t = setInterval(refresh, 3000); return () => clearInterval(t) }, [])

  const start = async (task: string) => {
    localStorage.setItem('cwd', cwd); localStorage.setItem('maxCost', String(maxCost))
    const { id } = await api.start({ task, cwd: cwd || '.', max_cost_usd: maxCost })
    setSel(id); refresh()
  }
  const current = runs.find((r) => r.id === sel)

  return (
    <div className="flex h-full">
      <aside className="flex min-h-0 shrink-0 flex-col border-r transition-all" style={{ width: sidebar ? 260 : 0, overflow: 'hidden', borderColor: 'var(--border)', background: 'var(--panel)' }}>
        <div className="flex items-center gap-2 px-3 py-3">
          <span className="h-3 w-3 rounded-sm" style={{ background: 'var(--accent)' }} />
          <span className="font-semibold">Harness</span>
          <button className="ml-auto rounded-md px-2 text-sm hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setSel(null)}>+ New</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2">
          {runs.map((r) => (
            <button key={r.id} className="mb-0.5 block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5" style={{ background: sel === r.id ? 'var(--panel-2)' : undefined }} onClick={() => setSel(r.id)}>
              <div className="truncate">{r.task}</div>
              <div className="mono mt-0.5 flex text-[11px]" style={{ color: 'var(--muted)' }}>
                <span style={{ color: r.state === 'done' ? 'var(--ok)' : r.state === 'failed' ? 'var(--err)' : 'var(--warn)' }}>{r.state.replace(/_/g, ' ')}</span>
                <span className="ml-auto">{usd(r.cost_usd)}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="space-y-1 border-t p-3 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          <label className="block">Repository
            <input className="mono mt-0.5 w-full rounded-md border px-2 py-1 text-xs" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="path to repo" value={cwd} onChange={(e) => setCwd(e.target.value)} />
          </label>
          <label className="block">Cost cap (USD)
            <input className="mono mt-0.5 w-full rounded-md border px-2 py-1 text-xs" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} type="number" value={maxCost} onChange={(e) => setMaxCost(Number(e.target.value))} />
          </label>
        </div>
      </aside>
      <main className="relative min-h-0 min-w-0 flex-1">
        <button aria-label="Toggle sidebar" className="absolute left-2 top-2 z-10 rounded-md px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--muted)' }} onClick={() => setSidebar(!sidebar)}>☰</button>
        {sel && current ? (
          <Chat id={sel} task={current.task} onNewRun={start} />
        ) : (
          <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-4">
            <h1 className="mb-6 text-center text-3xl font-semibold tracking-tight">What should we build?</h1>
            <Composer placeholder="Describe the task. The harness will propose a plan before touching code." onSubmit={start} disabled={!cwd} />
            {!cwd && <p className="mt-2 text-center text-xs" style={{ color: 'var(--muted)' }}>Set the repository path in the sidebar first.</p>}
          </div>
        )}
      </main>
    </div>
  )
}
