import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { empty, k, reduce, usd, type Agent, type ToolCall, type View } from './model'

export function RunView({ id }: { id: string }) {
  const [v, setV] = useState<View>(empty)
  useEffect(() => {
    setV(empty())
    return api.stream(id, (e) => setV((prev) => reduce(prev, e)))
  }, [id])

  return (
    <div className="grid h-full min-h-0" style={{ gridTemplateColumns: 'minmax(0,1fr) 420px' }}>
      <Conversation id={id} v={v} />
      <Trace v={v} />
    </div>
  )
}

const STATES = ['intake', 'awaiting_confirmation', 'working', 'diagnosing', 'summarizing', 'awaiting_pr_decision', 'done']

function Conversation({ id, v }: { id: string; v: View }) {
  const [feedback, setFeedback] = useState('')
  const top = v.order.filter((a) => !v.agents[a].parent)
  return (
    <div className="flex min-h-0 flex-col border-r" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 border-b px-4 py-2 text-xs" style={{ borderColor: 'var(--border)' }}>
        {STATES.map((s) => (
          <span key={s} className="rounded px-2 py-0.5" style={{ background: v.state === s ? 'var(--accent)' : STATES.indexOf(s) < STATES.indexOf(v.state) ? 'var(--panel-2)' : 'transparent', color: v.state === s ? '#fff' : 'var(--muted)' }}>
            {s.replace(/_/g, ' ')}
          </span>
        ))}
        {v.state === 'failed' && <span className="rounded px-2 py-0.5" style={{ background: 'var(--err)', color: '#000' }}>failed</span>}
        <span className="ml-auto mono" style={{ color: 'var(--muted)' }}>{usd(v.cost)} · {k(v.tokens.in)} in / {k(v.tokens.out)} out</span>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {v.intake && (
          <Card title="What I understood">
            <p>{v.intake.understanding}</p>
            <ol className="mt-2 list-decimal pl-5">{v.intake.plan.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
            {v.intake.questions?.length > 0 && <ul className="mt-2 list-disc pl-5" style={{ color: 'var(--warn)' }}>{v.intake.questions.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul>}
          </Card>
        )}
        {top.map((aid) => {
          const a = v.agents[aid]
          const text = a.turns.map((t) => t.text).filter(Boolean).join('\n')
          if (!text || a.name === 'intake' || a.name === 'diagnosis') return null
          return <Card key={aid} title={a.name}><pre>{text}</pre></Card>
        })}
        {v.diagnosis && (
          <Card title={`Diagnosis: ${v.diagnosis.complete ? 'complete' : 'gaps found'}`} color={v.diagnosis.complete ? 'var(--ok)' : 'var(--warn)'}>
            {v.diagnosis.gaps?.length > 0 && <ul className="list-disc pl-5">{v.diagnosis.gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>}
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{v.diagnosis.evidence}</p>
          </Card>
        )}
        {(v.branch || v.pr) && <p className="mono text-xs" style={{ color: 'var(--muted)' }}>branch {v.branch} {v.pr && <>· PR <a className="underline" href={v.pr} target="_blank">{v.pr}</a></>}</p>}
        {v.error && <Card title="Error" color="var(--err)"><pre>{v.error}</pre></Card>}
      </div>
      {v.pending && (
        <div className="border-t p-4" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          {v.pending.kind === 'confirm_intake' && (
            <>
              <p className="mb-2 font-medium">Proceed with this plan?</p>
              <textarea className="mb-2 w-full rounded border p-2 text-sm" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }} rows={2} placeholder="Optional feedback if not" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              <div className="flex gap-2">
                <Btn onClick={() => api.decide(id, true)}>Proceed</Btn>
                <Btn secondary onClick={() => { api.decide(id, false, feedback || 'please reconsider'); setFeedback('') }}>Revise</Btn>
              </div>
            </>
          )}
          {v.pending.kind === 'approve_command' && (
            <>
              <p className="mb-2 font-medium">Allow this command?</p>
              <pre className="mb-2 rounded p-2" style={{ background: 'var(--bg)' }}>{v.pending.command}</pre>
              <div className="flex gap-2"><Btn onClick={() => api.decide(id, true)}>Allow</Btn><Btn secondary onClick={() => api.decide(id, false)}>Deny</Btn></div>
            </>
          )}
          {v.pending.kind === 'want_pr' && (
            <>
              <pre className="mb-2 max-h-60 overflow-auto rounded p-2" style={{ background: 'var(--bg)' }}>{v.pending.summary}</pre>
              <div className="flex gap-2"><Btn onClick={() => api.decide(id, true)}>Open PR</Btn><Btn secondary onClick={() => api.decide(id, false)}>Keep on branch</Btn></div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Trace({ v }: { v: View }) {
  const roots = v.order.filter((a) => !v.agents[a].parent)
  const children = (id: string) => v.order.filter((a) => v.agents[a].parent === id)
  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Agents</div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {roots.map((id) => <AgentNode key={id} a={v.agents[id]} kids={children(id).map((c) => v.agents[c])} />)}
      </div>
      <CostBar v={v} />
    </div>
  )
}

function AgentNode({ a, kids, depth = 0 }: { a: Agent; kids: Agent[]; depth?: number }) {
  const [open, setOpen] = useState(depth === 0)
  const running = !a.stop
  return (
    <div className="mb-1" style={{ marginLeft: depth * 12 }}>
      <button className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-white/5" onClick={() => setOpen(!open)}>
        <span className="h-2 w-2 rounded-full" style={{ background: running ? 'var(--warn)' : a.stop === 'end_turn' ? 'var(--ok)' : 'var(--err)' }} />
        <span className="font-medium">{a.name}</span>
        <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{a.model.replace('claude-', '')} · {a.effort}</span>
        <span className="mono ml-auto text-xs" style={{ color: 'var(--muted)' }}>{usd(a.cost)} · {a.turns.length}t</span>
      </button>
      {open && (
        <div className="ml-3 border-l pl-2" style={{ borderColor: 'var(--border)' }}>
          {a.turns.map((t) => (
            <div key={t.n} className="my-1 text-xs">
              {t.thinking && <details><summary className="cursor-pointer" style={{ color: 'var(--muted)' }}>thinking</summary><pre className="thinking">{t.thinking}</pre></details>}
              {t.text && <pre className="my-1">{t.text}</pre>}
              {t.tools.map((c) => <Tool key={c.id} c={c} />)}
              {t.usage && <div className="mono" style={{ color: 'var(--muted)' }}>turn {t.n}: {k(t.usage.input_tokens)} in · {k(t.usage.output_tokens)} out · {k(t.usage.cache_read_input_tokens)} cached · {usd(t.usage.cost_usd)}</div>}
            </div>
          ))}
          {kids.map((c) => <AgentNode key={c.id} a={c} kids={[]} depth={depth + 1} />)}
        </div>
      )}
    </div>
  )
}

function Tool({ c }: { c: ToolCall }) {
  const [open, setOpen] = useState(false)
  const brief = useMemo(() => JSON.stringify(c.input).slice(0, 120), [c.input])
  return (
    <div className="my-1 rounded border" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <button className="flex w-full items-center gap-2 px-2 py-1 text-left" onClick={() => setOpen(!open)}>
        <span className="mono" style={{ color: c.is_error ? 'var(--err)' : 'var(--accent)' }}>{c.name}</span>
        <span className="mono truncate" style={{ color: 'var(--muted)' }}>{brief}</span>
        {c.output === undefined && <span className="ml-auto" style={{ color: 'var(--warn)' }}>…</span>}
      </button>
      {open && (
        <div className="border-t px-2 py-1" style={{ borderColor: 'var(--border)' }}>
          <pre>{JSON.stringify(c.input, null, 2)}</pre>
          {c.output !== undefined && <pre className="mt-1 max-h-60 overflow-auto" style={{ color: c.is_error ? 'var(--err)' : 'var(--text)' }}>{c.output}</pre>}
        </div>
      )}
    </div>
  )
}

function CostBar({ v }: { v: View }) {
  const rows = v.order.map((id) => v.agents[id])
  return (
    <div className="border-t p-3 text-xs" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <div className="mb-1 flex items-baseline justify-between"><span className="font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Cost</span><span className="text-base font-semibold">{usd(v.cost)}</span></div>
      <div className="mono mb-2" style={{ color: 'var(--muted)' }}>{k(v.tokens.in)} in · {k(v.tokens.out)} out · {k(v.tokens.cache)} cache reads</div>
      {rows.map((a) => (
        <div key={a.id} className="flex items-center gap-2 py-0.5">
          <span className="w-24 truncate">{a.name}</span>
          <div className="h-1.5 flex-1 rounded" style={{ background: 'var(--panel-2)' }}><div className="h-1.5 rounded" style={{ width: `${v.cost ? (a.cost / v.cost) * 100 : 0}%`, background: 'var(--accent)' }} /></div>
          <span className="mono w-16 text-right">{usd(a.cost)}</span>
        </div>
      ))}
    </div>
  )
}

function Card({ title, color, children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: color ?? 'var(--border)', background: 'var(--panel)' }}>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide" style={{ color: color ?? 'var(--muted)' }}>{title}</div>
      {children}
    </div>
  )
}

export function Btn({ children, onClick, secondary }: { children: React.ReactNode; onClick: () => void; secondary?: boolean }) {
  return (
    <button className="rounded px-3 py-1.5 text-sm font-medium" style={{ background: secondary ? 'var(--panel-2)' : 'var(--accent)', color: secondary ? 'var(--text)' : '#fff' }} onClick={onClick}>
      {children}
    </button>
  )
}
