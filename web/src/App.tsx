import { useEffect, useState } from 'react'
import { api, type RunRow } from './api'
import { Btn, RunView } from './RunView'
import { usd } from './model'

export default function App() {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [task, setTask] = useState('')
  const [cwd, setCwd] = useState(localStorage.getItem('cwd') ?? '')
  const [maxCost, setMaxCost] = useState(20)

  const refresh = () => api.runs().then(setRuns).catch(() => {})
  useEffect(() => { refresh(); const t = setInterval(refresh, 3000); return () => clearInterval(t) }, [])

  const start = async () => {
    if (!task.trim()) return
    localStorage.setItem('cwd', cwd)
    const { id } = await api.start({ task, cwd: cwd || '.', max_cost_usd: maxCost })
    setTask(''); setSel(id); refresh()
  }

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: '280px minmax(0,1fr)' }}>
      <aside className="flex min-h-0 flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
        <div className="border-b p-3" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-2 flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: 'var(--accent)' }} /><span className="font-semibold">Harness</span></div>
          <textarea className="mb-2 w-full rounded border p-2 text-sm" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }} rows={4} placeholder="What should the agents do?" value={task} onChange={(e) => setTask(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start() }} />
          <input className="mono mb-2 w-full rounded border p-1.5 text-xs" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }} placeholder="repo path (cwd)" value={cwd} onChange={(e) => setCwd(e.target.value)} />
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--muted)' }}>cap $<input className="mono w-14 rounded border px-1" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }} type="number" value={maxCost} onChange={(e) => setMaxCost(Number(e.target.value))} /></label>
            <span className="ml-auto"><Btn onClick={start}>Run</Btn></span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {runs.map((r) => (
            <button key={r.id} className="block w-full border-b px-3 py-2 text-left hover:bg-white/5" style={{ borderColor: 'var(--border)', background: sel === r.id ? 'var(--panel-2)' : undefined }} onClick={() => setSel(r.id)}>
              <div className="truncate text-sm">{r.task}</div>
              <div className="mono mt-0.5 flex gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                <span style={{ color: r.state === 'done' ? 'var(--ok)' : r.state === 'failed' ? 'var(--err)' : 'var(--warn)' }}>{r.state}</span>
                <span className="ml-auto">{usd(r.cost_usd)}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>
      <main className="min-h-0">
        {sel ? <RunView id={sel} /> : <div className="flex h-full items-center justify-center" style={{ color: 'var(--muted)' }}>Start a run or pick one on the left.</div>}
      </main>
    </div>
  )
}
