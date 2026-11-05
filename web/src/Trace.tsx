// The Trace view: every run of a thread on a scrubbable time axis, built from the real event log.
import { useEffect, useState } from 'react'
import { AgentTrace, type TraceSpan } from '@/components/ui/agent-trace'
import { api, type Ev, type RunRow } from './api'

const IO_TOOLS = new Set(['read_file', 'write_file', 'edit_file', 'glob', 'grep', 'load_skill'])

const brief = (name: string, input: any): string => {
  switch (name) {
    case 'read_file': case 'write_file': case 'edit_file': return `${name.split('_')[0]} ${input?.path ?? ''}`
    case 'glob': return `glob ${input?.pattern ?? ''}`
    case 'grep': return `grep /${input?.pattern ?? ''}/`
    case 'bash': return `$ ${String(input?.command ?? '').split('\n')[0]}`
    case 'spawn_worker': return 'spawn_worker'
    default: return name
  }
}

/** Event log → spans. Agents are parents; each model turn and each tool call is a child with real timings. */
export function spansFromEvents(events: Ev[], now = Date.now() / 1000): TraceSpan[] {
  if (!events.length) return []
  const t0 = events[0].ts
  const ms = (ts: number) => Math.max(0, Math.round((ts - t0) * 1000))
  const spans: TraceSpan[] = []
  const agents: Record<string, TraceSpan & { lastTs: number; turns: number }> = {}
  const open: Record<string, TraceSpan> = {} // tool_use_id -> span

  for (const e of events) {
    const p = e.payload
    switch (e.type) {
      case 'agent_start': {
        const a: TraceSpan & { lastTs: number; turns: number } = {
          id: e.agent_id, label: p.name, kind: 'agent', start: ms(e.ts), end: ms(now), parentId: e.parent_id ?? undefined,
          tokens: 0, lastTs: e.ts, turns: 0,
        }
        agents[e.agent_id] = a
        spans.push(a)
        break
      }
      case 'usage': {
        const a = agents[e.agent_id]
        if (!a) break
        a.turns += 1
        a.tokens = (a.tokens ?? 0) + p.input_tokens + p.output_tokens
        spans.push({
          id: `${e.agent_id}:turn${a.turns}`, label: `${p.model.replace('claude-', '')} · turn ${a.turns}`, kind: 'model',
          start: ms(a.lastTs), end: ms(e.ts), parentId: e.agent_id, tokens: p.input_tokens + p.output_tokens,
          detail: `$${p.cost_usd.toFixed(4)}`,
        })
        a.lastTs = e.ts
        break
      }
      case 'tool_call': {
        const s: TraceSpan = {
          id: `tool:${p.tool_use_id}`, label: brief(p.name, p.input), kind: IO_TOOLS.has(p.name) ? 'io' : 'tool',
          start: ms(e.ts), end: ms(now), parentId: e.agent_id,
        }
        open[p.tool_use_id] = s
        spans.push(s)
        break
      }
      case 'tool_result': {
        const s = open[p.tool_use_id]
        if (!s) break
        s.end = ms(e.ts)
        s.status = p.is_error ? 'error' : 'ok'
        s.detail = String(p.output ?? '').split('\n')[0].slice(0, 60)
        const a = agents[e.agent_id]
        if (a) a.lastTs = e.ts
        delete open[p.tool_use_id]
        break
      }
      case 'agent_end': {
        const a = agents[e.agent_id]
        if (!a) break
        a.end = ms(e.ts)
        a.status = p.stop === 'end_turn' ? 'ok' : 'error'
        a.detail = `${p.stop} · $${p.cost_usd.toFixed(4)}`
        break
      }
    }
  }
  return spans
}

const FINISHED = new Set(['done', 'failed', 'cancelled'])

export function TraceView({ runs }: { runs: RunRow[] }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 pt-8 pb-6">
      {runs.map((r) => <RunTrace key={r.id} run={r} />)}
    </div>
  )
}

function RunTrace({ run }: { run: RunRow }) {
  const [events, setEvents] = useState<Ev[]>([])
  const live = !FINISHED.has(run.state)
  useEffect(() => {
    let stop = false
    const load = () => api.events(run.id, ['agent_start', 'agent_end', 'usage', 'tool_call', 'tool_result']).then((e) => { if (!stop) setEvents(e) }).catch(() => {})
    load()
    const t = live ? setInterval(load, 2000) : undefined
    return () => { stop = true; if (t) clearInterval(t) }
  }, [run.id, live])

  const spans = spansFromEvents(events)
  const total = spans.reduce((m, s) => Math.max(m, s.end), 0)
  const cost = run.cost_usd
  return (
    <div>
      <p className="mb-2 truncate text-sm" style={{ color: 'var(--muted)' }}>{run.task.replace(/^\[[^\]]+\]\s*/, '')}</p>
      {spans.length ? (
        <AgentTrace
          spans={spans}
          duration={total || undefined}
          runId={`run_${run.id}`}
          model={`${run.state} · $${cost.toFixed(3)}`}
          defaultTime={total}
          autoPlay={false}
          rowHeight={30}
          labelWidth={220}
        />
      ) : (
        <p className="text-sm" style={{ color: 'var(--dim)' }}>No agent activity recorded yet.</p>
      )}
    </div>
  )
}
