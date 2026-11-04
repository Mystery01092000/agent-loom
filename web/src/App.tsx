import { useEffect, useState } from 'react'
import { api, type RunRow } from './api'
import { Chat, NewTaskComposer } from './Chat'
import { usd } from './model'

export default function App() {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [cwd, setCwd] = useState(localStorage.getItem('cwd') ?? '')
  const [maxCost, setMaxCost] = useState(Number(localStorage.getItem('maxCost') ?? 20))
  const [sidebar, setSidebar] = useState(true)

  const refresh = () => api.runs().then(setRuns).catch(() => {})
  useEffect(() => { refresh(); const t = setInterval(refresh, 3000); return () => clearInterval(t) }, [])

  const start = async (task: string, kind: string, model: string) => {
    if (!cwd) { setSidebar(true); return }
    localStorage.setItem('cwd', cwd); localStorage.setItem('maxCost', String(maxCost))
    const text = kind && kind !== 'Feature' ? `[${kind}] ${task}` : task
    const { id } = await api.start({ task: text, cwd, main_model: model, max_cost_usd: maxCost })
    setSel(id); refresh()
  }
  const current = runs.find((r) => r.id === sel)
  const field = 'mono mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs outline-none'
  const fieldStyle = { background: 'rgba(0,0,0,.35)', boxShadow: 'inset 0 0 0 1px var(--line)', color: 'var(--text)' }

  return (
    <div className="flex h-full p-3 gap-3">
      <aside className="glass flex min-h-0 shrink-0 flex-col rounded-3xl transition-all" style={{ width: sidebar ? 264 : 0, overflow: 'hidden', opacity: sidebar ? 1 : 0 }}>
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <span className="h-3 w-3 rounded-md" style={{ background: 'linear-gradient(160deg,#e8f6ff,#5fb2f2)', boxShadow: '0 0 12px rgba(95,178,242,.6)' }} />
          <span className="font-semibold tracking-tight">Harness</span>
          <button className="pill ml-auto rounded-lg px-2.5 py-1 text-xs" onClick={() => setSel(null)}>+ New</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 py-1">
          {runs.map((r) => (
            <button key={r.id} className="mb-1 block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/5" style={{ background: sel === r.id ? 'rgba(255,255,255,.08)' : undefined }} onClick={() => setSel(r.id)}>
              <div className="truncate">{r.task.replace(/^\[[^\]]+\]\s*/, '')}</div>
              <div className="mono mt-0.5 flex text-[11px]" style={{ color: 'var(--dim)' }}>
                <span style={{ color: r.state === 'done' ? 'var(--ok)' : r.state === 'failed' || r.state === 'cancelled' ? 'var(--err)' : 'var(--warn)' }}>{r.state.replace(/_/g, ' ')}</span>
                <span className="ml-auto">{usd(r.cost_usd)}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="space-y-2 px-4 pb-4 pt-2 text-xs" style={{ color: 'var(--muted)', boxShadow: 'inset 0 1px 0 var(--line)' }}>
          <label className="block">Repository
            <input className={field} style={fieldStyle} placeholder="path to repo" value={cwd} onChange={(e) => setCwd(e.target.value)} />
          </label>
          <label className="block">Cost cap (USD)
            <input className={field} style={fieldStyle} type="number" value={maxCost} onChange={(e) => setMaxCost(Number(e.target.value))} />
          </label>
        </div>
      </aside>
      <main className="relative min-h-0 min-w-0 flex-1">
        <button aria-label="Toggle sidebar" className="absolute left-1 top-1 z-10 rounded-lg px-2 py-1 text-sm hover:bg-white/5" style={{ color: 'var(--muted)' }} onClick={() => setSidebar(!sidebar)}>☰</button>
        {sel && current ? (
          <Chat id={sel} task={current.task.replace(/^\[[^\]]+\]\s*/, '')} onNewRun={start} />
        ) : (
          <div className="mx-auto flex h-full max-w-3xl flex-col justify-center px-4">
            <h1 className="mb-2 text-center text-4xl font-semibold tracking-tight">What should we build?</h1>
            <p className="mb-8 text-center" style={{ color: 'var(--muted)' }}>Intake proposes a plan, a supervisor delegates to workers, diagnosis verifies, and the result lands on a branch.</p>
            <NewTaskComposer onSubmit={start} />
            {!cwd && <p className="mt-3 text-center text-xs" style={{ color: 'var(--warn)' }}>Set the repository path in the sidebar first.</p>}
          </div>
        )}
      </main>
    </div>
  )
}
