import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { empty, k, reduce, usd, type Agent, type ToolCall, type Turn, type View } from './model'

// ---------- shared bits ----------

export function Md({ text }: { text: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { async: false }) as string), [text])
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}

export function Btn({ children, onClick, secondary, disabled }: { children: React.ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className="rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-40"
      style={{ background: secondary ? 'var(--panel-2)' : 'var(--accent)', color: secondary ? 'var(--text)' : '#fff' }}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function Composer({ placeholder, onSubmit, disabled }: { placeholder: string; onSubmit: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('')
  const send = () => { if (text.trim() && !disabled) { onSubmit(text.trim()); setText('') } }
  return (
    <div className="rounded-2xl border p-2 shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
      <textarea
        className="block w-full resize-none bg-transparent px-2 py-1.5 outline-none"
        rows={2}
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
      />
      <div className="flex items-center justify-end px-1">
        <button aria-label="Send" disabled={disabled || !text.trim()} onClick={send} className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30" style={{ background: 'var(--accent)', color: '#fff' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
        </button>
      </div>
    </div>
  )
}

// ---------- the chat for one run ----------

export function Chat({ id, task, onNewRun }: { id: string; task: string; onNewRun: (text: string) => void }) {
  const [v, setV] = useState<View>(empty)
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => { setV(empty()); return api.stream(id, (e) => setV((prev) => reduce(prev, e))) }, [id])
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }) }, [v.lastId])

  const finished = v.state === 'done' || v.state === 'failed'
  const revising = v.pending?.kind === 'confirm_intake'
  const placeholder = revising ? 'Reply with changes to the plan, or click Proceed' : finished ? 'Start a new task…' : 'Working…'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <UserMsg text={task} />
          <AssistantTurn v={v} id={id} />
          <div ref={bottom} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pb-2">
        <Composer placeholder={placeholder} disabled={!revising && !finished} onSubmit={(t) => (revising ? api.decide(id, false, t) : onNewRun(t))} />
        <CostStrip v={v} />
      </div>
    </div>
  )
}

function UserMsg({ text }: { text: string }) {
  return (
    <div className="mb-6 flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5" style={{ background: 'var(--user)' }}>{text}</div>
    </div>
  )
}

function AssistantTurn({ v, id }: { v: View; id: string }) {
  const agents = v.order.map((a) => v.agents[a])
  const intake = agents.find((a) => a.name === 'intake')
  const summarizer = agents.find((a) => a.name === 'summarizer')
  const work = agents.filter((a) => !a.parent && a.name !== 'intake' && a.name !== 'summarizer')
  const supervisorText = agents.filter((a) => a.name === 'supervisor').map((a) => a.turns.map((t) => t.text).join('')).filter(Boolean).pop()

  return (
    <div className="flex gap-3">
      <div className="mt-1 h-6 w-6 shrink-0 rounded-md" style={{ background: 'var(--accent)' }} />
      <div className="min-w-0 flex-1 space-y-4">
        {intake && <Steps agents={[intake]} v={v} />}
        {v.intake ? (
          <Md text={`${v.intake.understanding}\n\n**Plan**\n${v.intake.plan.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}${v.intake.questions?.length ? `\n\n**Questions**\n${v.intake.questions.map((q: string) => `- ${q}`).join('\n')}` : ''}`} />
        ) : v.state === 'intake' ? <Dots label="Reading the request" /> : null}
        {v.pending?.kind === 'confirm_intake' && (
          <div className="flex items-center gap-2">
            <Btn onClick={() => api.decide(id, true)}>Proceed</Btn>
            <span className="text-sm" style={{ color: 'var(--muted)' }}>or reply below with changes</span>
          </div>
        )}
        {v.branch && <p className="mono text-xs" style={{ color: 'var(--muted)' }}>working on branch {v.branch}</p>}
        {work.length > 0 && <Steps agents={work} v={v} />}
        {v.pending?.kind === 'approve_command' && (
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--warn)' }}>
            <p className="mb-2 text-sm font-medium">Allow this command?</p>
            <pre className="mb-2 rounded-lg p-2" style={{ background: 'var(--code)' }}>{v.pending.command}</pre>
            <div className="flex gap-2"><Btn onClick={() => api.decide(id, true)}>Allow</Btn><Btn secondary onClick={() => api.decide(id, false)}>Deny</Btn></div>
          </div>
        )}
        {v.state === 'working' && !v.pending && <Dots label="Working" />}
        {supervisorText && v.state !== 'working' && <Md text={supervisorText} />}
        {v.state === 'diagnosing' && <Dots label="Verifying the result against your request" />}
        {v.diagnosis && (
          <div className="flex items-start gap-2 text-sm" style={{ color: v.diagnosis.complete ? 'var(--ok)' : 'var(--warn)' }}>
            <span>{v.diagnosis.complete ? '✓' : '!'}</span>
            <div>
              <span className="font-medium">{v.diagnosis.complete ? 'Verified complete' : 'Gaps found'}</span>
              {v.diagnosis.gaps?.length > 0 && <ul className="mt-1 list-disc pl-5" style={{ color: 'var(--text)' }}>{v.diagnosis.gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>}
            </div>
          </div>
        )}
        {v.state === 'summarizing' && <Dots label="Writing the summary" />}
        {v.summary && <Md text={v.summary.replace(/\nTITLE:.*$/s, '')} />}
        {summarizer && <Steps agents={[summarizer]} v={v} compact />}
        {v.pending?.kind === 'want_pr' && (
          <div className="flex items-center gap-2">
            <Btn onClick={() => api.decide(id, true)}>Open a PR</Btn>
            <Btn secondary onClick={() => api.decide(id, false)}>Keep it on the branch</Btn>
          </div>
        )}
        {v.pr && <p className="text-sm">PR opened: <a className="underline" style={{ color: 'var(--accent)' }} href={v.pr} target="_blank">{v.pr}</a></p>}
        {v.state === 'done' && !v.pr && v.branch && <p className="text-sm" style={{ color: 'var(--muted)' }}>Done. The work is committed on {v.branch}.</p>}
        {v.error && <pre className="rounded-lg p-2 text-sm" style={{ background: 'var(--code)', color: 'var(--err)' }}>{v.error}</pre>}
      </div>
    </div>
  )
}

function Dots({ label }: { label: string }) {
  return <p className="animate-pulse text-sm" style={{ color: 'var(--muted)' }}>{label}…</p>
}

// ---------- activity steps (Claude Code style tool blocks) ----------

function Steps({ agents, v, compact }: { agents: Agent[]; v: View; compact?: boolean }) {
  const kids = (id: string) => v.order.filter((a) => v.agents[a].parent === id).map((a) => v.agents[a])
  return <div className="space-y-1">{agents.map((a) => <AgentSteps key={a.id} a={a} kids={kids(a.id)} compact={compact} />)}</div>
}

function AgentSteps({ a, kids, depth = 0, compact }: { a: Agent; kids: Agent[]; depth?: number; compact?: boolean }) {
  const [open, setOpen] = useState(depth > 0 || !compact)
  const steps = a.turns.reduce((n, t) => n + t.tools.length, 0)
  const running = !a.stop
  if (steps === 0 && !a.turns.some((t) => t.thinking) && compact) return null
  // the n-th spawn_worker call produced the n-th child agent
  const spawnIds = a.turns.flatMap((t) => t.tools.filter((c) => c.name === 'spawn_worker').map((c) => c.id))
  const childFor = (c: ToolCall) => (c.name === 'spawn_worker' ? kids[spawnIds.indexOf(c.id)] : undefined)
  return (
    <div style={{ marginLeft: depth * 16 }}>
      <button className="flex items-center gap-2 py-0.5 text-sm" style={{ color: 'var(--muted)' }} onClick={() => setOpen(!open)}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: running ? 'var(--warn)' : a.stop === 'end_turn' ? 'var(--ok)' : 'var(--err)' }} />
        <span className="font-medium" style={{ color: 'var(--text)' }}>{a.name}</span>
        <span className="mono text-xs">{a.model.replace('claude-', '')} · {steps} step{steps === 1 ? '' : 's'} · {usd(a.cost)}</span>
        <span className="text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="ml-1 border-l pl-3" style={{ borderColor: 'var(--border)' }}>
          {a.turns.map((t) => <TurnSteps key={t.n} t={t} childFor={childFor} />)}
        </div>
      )}
    </div>
  )
}

function TurnSteps({ t, childFor }: { t: Turn; childFor: (c: ToolCall) => Agent | undefined }) {
  return (
    <div className="my-1">
      {t.thinking && <Thinking text={t.thinking} />}
      {t.tools.map((c) => <Tool key={c.id} c={c} child={childFor(c)} />)}
    </div>
  )
}

function Thinking({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="my-1 text-sm">
      <button className="italic" style={{ color: 'var(--muted)' }} onClick={() => setOpen(!open)}>{open ? 'Hide thinking' : 'Thought about it'} {open ? '▾' : '▸'}</button>
      {open && <pre className="mt-1 italic" style={{ color: 'var(--muted)' }}>{text}</pre>}
    </div>
  )
}

const brief = (c: ToolCall): string => {
  const i = c.input || {}
  switch (c.name) {
    case 'read_file': return `Read ${i.path}`
    case 'write_file': return `Write ${i.path}`
    case 'edit_file': return `Edit ${i.path}`
    case 'glob': return `Find ${i.pattern}`
    case 'grep': return `Search /${i.pattern}/ in ${i.path}`
    case 'bash': return `$ ${i.command}`
    case 'spawn_worker': return `Delegate: ${String(i.task).split('\n')[0]}`
    default: return `${c.name} ${JSON.stringify(i)}`
  }
}

function Tool({ c, child }: { c: ToolCall; child?: Agent }) {
  const [open, setOpen] = useState(false)
  const pending = c.output === undefined
  return (
    <div className="my-1">
      <button className="flex w-full items-start gap-2 rounded-md px-1 py-0.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5" onClick={() => setOpen(!open)}>
        <span className="mono mt-0.5 shrink-0 text-xs" style={{ color: c.is_error ? 'var(--err)' : pending ? 'var(--warn)' : 'var(--accent)' }}>{pending ? '○' : c.is_error ? '✕' : '●'}</span>
        <span className="mono min-w-0 flex-1 truncate">{brief(c)}</span>
      </button>
      {open && (
        <div className="ml-5 mt-1 rounded-lg border text-xs" style={{ borderColor: 'var(--border)', background: 'var(--code)' }}>
          <pre className="max-h-48 overflow-auto p-2">{JSON.stringify(c.input, null, 2)}</pre>
          {c.output !== undefined && <pre className="max-h-64 overflow-auto border-t p-2" style={{ borderColor: 'var(--border)', color: c.is_error ? 'var(--err)' : 'var(--text)' }}>{c.output}</pre>}
        </div>
      )}
      {child && <div className="ml-5"><AgentSteps a={child} kids={[]} depth={0} /></div>}
    </div>
  )
}

// ---------- cost strip ----------

function CostStrip({ v }: { v: View }) {
  const [open, setOpen] = useState(false)
  const rows = v.order.map((id) => v.agents[id])
  return (
    <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
      <button className="mono w-full py-1 text-center hover:underline" onClick={() => setOpen(!open)}>
        {usd(v.cost)} · {k(v.tokens.in)} in · {k(v.tokens.out)} out · {k(v.tokens.cache)} cached {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="rounded-lg border p-2" style={{ borderColor: 'var(--border)' }}>
          {rows.map((a) => (
            <div key={a.id} className="flex items-center gap-2 py-0.5">
              <span className="w-24 truncate">{a.name}</span>
              <span className="mono w-28">{a.model.replace('claude-', '')}</span>
              <div className="h-1 flex-1 rounded" style={{ background: 'var(--panel-2)' }}><div className="h-1 rounded" style={{ width: `${v.cost ? (a.cost / v.cost) * 100 : 0}%`, background: 'var(--accent)' }} /></div>
              <span className="mono w-16 text-right">{k(a.tokens.in + a.tokens.out)}</span>
              <span className="mono w-16 text-right">{usd(a.cost)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
