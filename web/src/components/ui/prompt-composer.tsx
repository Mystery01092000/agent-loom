"use client"

import * as React from "react"
import { gsap } from "gsap"

/*
 * Prompt Composer: the liquid-glass prompt box of an AI app builder. The
 * placeholder types example prompts out and deletes them again; platform
 * chips are a radio group; the model picker is a real menu (arrow keys,
 * Escape); attachments go through a real file input and show as removable
 * chips; the send button breathes once there is something to send. Enter
 * sends, Shift + Enter breaks the line.
 *
 * Sending hands the prompt to `onSubmit`. With `simulate` on (the default)
 * the card then morphs into a five-step build log and into a preview card
 * for the app it "made". Nothing is generated: it is a front end.
 */

export type ComposerIcon = "spark" | "eye" | "code" | "chat" | "phone" | "rocket" | "window" | "bars" | "game" | "bolt"
export type ComposerAccent = "ice" | "ember" | "lime"

export type ComposerPlatform = {
  label: string
  icon: ComposerIcon
}

export type ComposerSubmit = {
  prompt: string
  platform: string
  model: string
  files: string[]
}

export interface PromptComposerProps {
  /** Example prompts the placeholder types out, one after another. */
  prompts?: string[]
  /** Shown instead of the typing examples while the field has focus. */
  placeholder?: string
  platforms?: ComposerPlatform[]
  models?: string[]
  /** One line under each model in the menu. Defaults to fastest, balanced, most careful. */
  modelNotes?: string[]
  /** Steps of the demo build log. */
  buildSteps?: string[]
  /** Play the build log and preview after sending. Off: the prompt is handed over and the box clears. */
  simulate?: boolean
  /** The keyboard hint under the box. */
  hint?: boolean
  accent?: ComposerAccent
  onSubmit?: (submission: ComposerSubmit) => void
  className?: string
}

const DEFAULT_PROMPTS = [
  "A habit tracker with streaks, gentle reminders and a weekly recap...",
  "A booking app for a small yoga studio, with class passes and a waitlist...",
  "A shared grocery list that sorts itself by supermarket aisle...",
  "A dashboard for my store's daily sales, refunds and best sellers...",
]

const DEFAULT_PLATFORMS: ComposerPlatform[] = [
  { label: "Mobile app", icon: "phone" },
  { label: "Web app", icon: "window" },
  { label: "Dashboard", icon: "bars" },
  { label: "Game", icon: "game" },
]

const DEFAULT_STEPS = ["Reading your idea", "Sketching the screens", "Writing components", "Wiring data and sign-in", "Polishing the details"]

const ACCENTS = {
  ice: { a1: "#e8f6ff", a2: "#a9dcff", a3: "#5fb2f2", glow: "rgba(95,178,242,.42)", ink: "#06233a" },
  ember: { a1: "#fcc8a6", a2: "#f49d70", a3: "#e07a45", glow: "rgba(224,122,69,.42)", ink: "#3a1606" },
  lime: { a1: "#efffc4", a2: "#c4f26a", a3: "#8fcf2e", glow: "rgba(143,207,46,.38)", ink: "#1c2a05" },
}

const ICONS: { [k: string]: string } = {
  spark: "...#.../...#.../..###../#######/..###../...#.../...#...",
  eye: "......./..###../.#...#./#..#..#/.#...#./..###../.......",
  code: ".##.##./.#...#./#.....#/#.....#/#.....#/.#...#./.##.##.",
  chat: "#######/#.....#/#.#.#.#/#.....#/#######/.##..../.#.....",
  phone: ".#####./.#...#./.#...#./.#...#./.#####./.##.##./.#####.",
  rocket: "...#.../..###../..#.#../..###../.#####./#.###.#/..#.#..",
  window: "#######/#.#.#.#/#######/#.....#/#.....#/#.....#/#######",
  bars: "......#/....#.#/....#.#/..#.#.#/..#.#.#/#.#.#.#/#######",
  game: "...#.../...#.../..###../.#####./#######/#.#.#.#/#######",
  bolt: "....##./...##../..##.../.######/...##../..##.../.##....",
  check: "......./......#/.....#./#...#../.#.#.../..#..../.......",
  arrow: "...#.../..###../.#.#.#./#..#..#/...#.../...#.../...#...",
  clip: "..###../.#...#./.#.#.#./.#.#.#./.#.#.#./.#...#./..###..",
}

// #region app-name
const FILLER = new Set(["a", "an", "the", "app", "application", "for", "that", "with", "build", "make", "me", "my", "i", "want", "need", "please", "to", "of", "and", "simple", "small", "new", "create", "which", "where", "who", "lets", "let"])

/** Names the "built" app from its prompt: the first two meaningful words, capitalised. */
export function appNameFrom(prompt: string) {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
  if (!words.length) return "Untitled"
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}
// #endregion app-name

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false)
  useIsoLayoutEffect(() => {
    if (typeof matchMedia !== "function") return
    const mq = matchMedia("(prefers-reduced-motion: reduce)")
    const on = () => setReduced(mq.matches)
    on()
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return reduced
}

function PixelIcon({ name }: { name: string }) {
  const rows = (ICONS[name] || ICONS.spark).split("/")
  const cells: number[][] = []
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === "#") cells.push([x, y])
  })
  return (
    <svg className="ppc-icon" viewBox="0 0 7 7" aria-hidden="true" focusable="false">
      {cells.map(([x, y], i) => (
        <rect key={i} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.12} />
      ))}
    </svg>
  )
}

export default function PromptComposer({
  prompts = DEFAULT_PROMPTS,
  placeholder = "Describe your app in a sentence or two...",
  platforms = DEFAULT_PLATFORMS,
  models = ["Turbo", "Studio", "Deep"],
  modelNotes,
  buildSteps = DEFAULT_STEPS,
  simulate = true,
  hint = true,
  accent = "ice",
  onSubmit,
  className,
}: PromptComposerProps) {
  const reduced = useReducedMotion()
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const tone = ACCENTS[accent] || ACCENTS.ice

  const cardRef = React.useRef(null as HTMLFormElement | null)
  const inputRef = React.useRef(null as HTMLTextAreaElement | null)
  const fileRef = React.useRef(null as HTMLInputElement | null)
  const modelBtnRef = React.useRef(null as HTMLButtonElement | null)
  const menuRef = React.useRef(null as HTMLDivElement | null)
  const prevHeight = React.useRef(0)
  const buildTl = React.useRef(null as gsap.core.Timeline | null)

  const [prompt, setPrompt] = React.useState("")
  const [platform, setPlatform] = React.useState(0)
  const [model, setModel] = React.useState(0)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [files, setFiles] = React.useState([] as string[])
  const [phase, setPhase] = React.useState("idle" as "idle" | "building" | "done")
  const [step, setStep] = React.useState(0)
  const [built, setBuilt] = React.useState({ name: "", platform: "", prompt: "" })
  const [typed, setTyped] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const [nudge, setNudge] = React.useState(false)

  const note = (i: number) => (modelNotes && modelNotes[i]) || (i === 0 ? "Fastest drafts" : i === models.length - 1 ? "Most careful" : "Balanced")

  const submit = (e?: { preventDefault: () => void }) => {
    if (e) e.preventDefault()
    const text = prompt.trim()
    if (!text) {
      setNudge(true)
      window.setTimeout(() => setNudge(false), 500)
      inputRef.current?.focus()
      return
    }
    onSubmit?.({ prompt: text, platform: platforms[platform]?.label || "", model: models[model] || "", files })
    if (!simulate) {
      setPrompt("")
      setFiles([])
      return
    }
    if (cardRef.current) prevHeight.current = cardRef.current.offsetHeight
    setBuilt({ name: appNameFrom(text), platform: platforms[platform]?.label || "App", prompt: text })
    setStep(0)
    setPhase("building")
  }

  const reset = (keep: boolean) => {
    buildTl.current?.kill()
    if (cardRef.current) prevHeight.current = cardRef.current.offsetHeight
    if (!keep) {
      setPrompt("")
      setFiles([])
    }
    setPhase("idle")
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30)
  }

  // the build log: one step at a time, then the preview
  React.useEffect(() => {
    if (phase !== "building") return
    const tl = gsap.timeline()
    buildSteps.forEach((_, i) => tl.call(() => setStep(i + 1), undefined, (i + 1) * (reduced ? 0.35 : 0.72)))
    tl.call(
      () => {
        if (cardRef.current) prevHeight.current = cardRef.current.offsetHeight
        setPhase("done")
      },
      undefined,
      "+=0.45",
    )
    buildTl.current = tl
    return () => {
      tl.kill()
    }
  }, [phase, reduced])

  // the card morphs between its three bodies instead of jumping
  useIsoLayoutEffect(() => {
    const card = cardRef.current
    if (!card || !prevHeight.current) return
    const from = prevHeight.current
    prevHeight.current = 0
    if (reduced) return
    const kids = card.querySelectorAll(".ppc-enter")
    const tw = gsap.fromTo(card, { height: from }, { height: card.offsetHeight, duration: 0.6, ease: "expo.out", clearProps: "height" })
    const tk = gsap.fromTo(kids, { opacity: 0, y: 12, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, stagger: 0.05, ease: "power3.out", clearProps: "filter,transform" })
    return () => {
      tw.kill()
      tk.kill()
    }
  }, [phase, reduced])

  // the placeholder types the example prompts out
  const promptKey = prompts.join("|")
  React.useEffect(() => {
    if (!prompts.length) return
    if (reduced) {
      setTyped(prompts[0])
      return
    }
    let i = 0
    let n = 0
    let back = false
    let id = 0
    const tick = () => {
      const full = prompts[i % prompts.length]
      if (!back) {
        n++
        setTyped(full.slice(0, n))
        if (n >= full.length) {
          back = true
          id = window.setTimeout(tick, 2200)
          return
        }
        id = window.setTimeout(tick, 26 + Math.random() * 40)
      } else {
        n = Math.max(0, n - 3)
        setTyped(full.slice(0, n))
        if (n === 0) {
          back = false
          i++
          id = window.setTimeout(tick, 380)
          return
        }
        id = window.setTimeout(tick, 14)
      }
    }
    id = window.setTimeout(tick, 900)
    return () => window.clearTimeout(id)
  }, [promptKey, reduced])

  // the model menu closes on outside press and Escape
  React.useEffect(() => {
    if (!menuOpen) return
    const first = menuRef.current?.querySelector("[role=menuitemradio]") as HTMLElement | null
    first?.focus()
    const down = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node) || modelBtnRef.current?.contains(e.target as Node)) return
      setMenuOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false)
        modelBtnRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", down)
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("pointerdown", down)
      document.removeEventListener("keydown", key)
    }
  }, [menuOpen])

  const menuKeys = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    e.preventDefault()
    const items = Array.from(menuRef.current?.querySelectorAll("[role=menuitemradio]") || []) as HTMLElement[]
    const at = items.indexOf(document.activeElement as HTMLElement)
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus()
  }

  // the glass sheen follows the pointer
  const sheen = (e: SheenEvent) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%")
    el.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%")
  }

  const empty = !prompt
  const ids = { input: uid + "-input", menu: uid + "-menu" }
  const style = {
    "--ppc-a1": tone.a1,
    "--ppc-a2": tone.a2,
    "--ppc-a3": tone.a3,
    "--ppc-glow": tone.glow,
    "--ppc-ink": tone.ink,
  } as React.CSSProperties

  return (
    <div className={"ppc-root" + (className ? " " + className : "")} style={style}>
      <style>{PPC_CSS}</style>
      <form ref={cardRef} className="ppc-card" data-phase={phase} data-nudge={nudge ? "true" : "false"} onSubmit={submit} onPointerMove={sheen} aria-label="Describe your app">
        <span className="ppc-sheen" aria-hidden="true" />
        {phase === "idle" && (
          <>
            <div className="ppc-field ppc-enter">
              <label htmlFor={ids.input} className="ppc-sr">
                Describe the app you want
              </label>
              <textarea
                ref={inputRef}
                id={ids.input}
                className="ppc-input"
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
                }}
              />
              {empty && (
                <span className="ppc-ph" aria-hidden="true">
                  {focused ? placeholder : typed}
                  {!focused && <i className="ppc-caret" />}
                </span>
              )}
            </div>
            {files.length > 0 && (
              <ul className="ppc-files ppc-enter" aria-label="Attached files">
                {files.map((f, i) => (
                  <li key={f + i} className="ppc-file">
                    <PixelIcon name="clip" />
                    <span>{f}</span>
                    <button type="button" aria-label={"Remove " + f} onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}>
                      x
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="ppc-tools ppc-enter">
              <div className="ppc-chips" role="radiogroup" aria-label="What are you building?">
                {platforms.map((p, i) => (
                  <button key={p.label} type="button" role="radio" aria-checked={platform === i} className="ppc-chip" onClick={() => setPlatform(i)}>
                    <PixelIcon name={p.icon} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
              <div className="ppc-right">
                <div className="ppc-model-wrap">
                  <button
                    ref={modelBtnRef}
                    type="button"
                    className="ppc-model"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-controls={ids.menu}
                    onClick={() => setMenuOpen((o) => !o)}
                  >
                    <PixelIcon name="bolt" />
                    <span>{models[model]}</span>
                    <svg className="ppc-chev" viewBox="0 0 10 6" aria-hidden="true">
                      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {menuOpen && (
                    <div ref={menuRef} id={ids.menu} className="ppc-menu" role="menu" aria-label="Model" onKeyDown={menuKeys}>
                      {models.map((m, i) => (
                        <button
                          key={m}
                          type="button"
                          role="menuitemradio"
                          aria-checked={model === i}
                          className="ppc-menu-item"
                          onClick={() => {
                            setModel(i)
                            setMenuOpen(false)
                            modelBtnRef.current?.focus()
                          }}
                        >
                          <span>{m}</span>
                          <small>{note(i)}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" className="ppc-attach" aria-label="Attach a sketch or screenshot" onClick={() => fileRef.current?.click()}>
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      d="M13.5 6.5l-5.8 5.8a1.6 1.6 0 002.3 2.3l6-6a3.2 3.2 0 00-4.5-4.5l-6.2 6.2a4.8 4.8 0 006.8 6.8l5.3-5.3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.fig,.sketch"
                  className="ppc-sr"
                  tabIndex={-1}
                  onChange={(e) => {
                    const list = Array.from(e.target.files || []).map((f) => f.name)
                    if (list.length) setFiles((fs) => fs.concat(list).slice(0, 4))
                    e.target.value = ""
                  }}
                />
                <button type="submit" className="ppc-send" aria-label="Build it" data-ready={empty ? "false" : "true"}>
                  <PixelIcon name="arrow" />
                </button>
              </div>
            </div>
          </>
        )}

        {phase === "building" && (
          <div className="ppc-build" role="status" aria-live="polite">
            <div className="ppc-build-head ppc-enter">
              <span className="ppc-build-title">Building {built.name}</span>
              <span className="ppc-build-pct">{Math.round((step / buildSteps.length) * 100)}%</span>
            </div>
            <div className="ppc-progress ppc-enter" aria-hidden="true">
              <span style={{ transform: "scaleX(" + step / buildSteps.length + ")" }} />
            </div>
            <ol className="ppc-steps">
              {buildSteps.map((s, i) => (
                <li key={s} className="ppc-step ppc-enter" data-state={i < step ? "done" : i === step ? "active" : "todo"}>
                  <span className="ppc-step-mark" aria-hidden="true">
                    {i < step ? <PixelIcon name="check" /> : <i />}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="ppc-build-foot ppc-enter">
              <button type="button" className="ppc-ghost" onClick={() => reset(true)}>
                Stop
              </button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="ppc-done">
            <div className="ppc-done-copy">
              <span className="ppc-done-kicker ppc-enter">
                <PixelIcon name="check" /> Preview ready
              </span>
              <p className="ppc-done-title ppc-enter">{built.name}</p>
              <p className="ppc-done-prompt ppc-enter">{built.prompt}</p>
              <div className="ppc-done-actions ppc-enter">
                <button type="button" className="ppc-ghost" onClick={() => reset(true)}>
                  Refine prompt
                </button>
                <button type="button" className="ppc-solid" onClick={() => reset(false)}>
                  New app
                </button>
              </div>
            </div>
            <div className="ppc-device ppc-enter" data-kind={/mobile|phone/i.test(built.platform) ? "phone" : "screen"} aria-hidden="true">
              <div className="ppc-device-top">
                <i />
                <span>{built.name}</span>
              </div>
              <div className="ppc-device-hero" />
              <div className="ppc-device-row">
                <i />
                <span />
              </div>
              <div className="ppc-device-row">
                <i />
                <span />
              </div>
              <div className="ppc-device-row">
                <i />
                <span />
              </div>
              <div className="ppc-device-tabs">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        )}
      </form>
      {hint && (
        <p className="ppc-hint">
          <kbd>Enter</kbd> to build <span aria-hidden="true">/</span> <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
        </p>
      )}
    </div>
  )
}

type SheenEvent = React.PointerEvent<HTMLElement>

const PPC_CSS = `
.ppc-root{--ppc-fg:#f5f5f6;--ppc-mute:#a3a3ab;--ppc-line:rgba(214,228,255,.13);--ppc-glass:rgba(32,32,36,.62);width:min(720px,100%);margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:14px;color:var(--ppc-fg);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;text-align:left;line-height:1.5}
.ppc-root :where(svg){display:block;max-width:none}
.ppc-root :where(button){font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ppc-root :where(p,ul,ol,li){margin:0;padding:0}
.ppc-root :where(ul,ol){list-style:none}
.ppc-root :where(button,textarea):focus-visible{outline:2px solid var(--ppc-a2);outline-offset:3px;border-radius:8px}
.ppc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.ppc-icon{fill:currentColor}

.ppc-card{--mx:50%;--my:0%;position:relative;width:100%;border-radius:26px;padding:22px 18px 16px 24px;background:var(--ppc-glass);backdrop-filter:blur(26px) saturate(150%);-webkit-backdrop-filter:blur(26px) saturate(150%);box-shadow:inset 0 0 0 1px var(--ppc-line),inset 0 1px 0 rgba(255,255,255,.08),0 24px 70px rgba(0,0,0,.5);transition:box-shadow .35s ease}
.ppc-card:focus-within{box-shadow:inset 0 0 0 1px rgba(214,228,255,.24),inset 0 1px 0 rgba(255,255,255,.1),0 0 0 6px rgba(255,255,255,.035),0 24px 70px rgba(0,0,0,.55)}
.ppc-card[data-nudge="true"]{animation:ppc-nudge .45s cubic-bezier(.36,.07,.19,.97)}
@keyframes ppc-nudge{20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}}
.ppc-sheen{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;pointer-events:none;background:radial-gradient(420px circle at var(--mx) var(--my),rgba(255,255,255,.075),transparent 55%);opacity:.9}
.ppc-field{position:relative}
.ppc-input{display:block;width:100%;min-height:52px;max-height:180px;resize:none;border:0;outline:0;background:transparent;color:var(--ppc-fg);font:inherit;font-size:16px;line-height:1.55;letter-spacing:.005em;padding:0;field-sizing:content}
.ppc-root .ppc-input:focus-visible{outline:none}
.ppc-ph{position:absolute;left:0;top:0;right:0;font-size:16px;line-height:1.55;color:#85868b;pointer-events:none;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ppc-caret{display:inline-block;width:2px;height:1.05em;margin-left:2px;vertical-align:-2px;background:var(--ppc-a2);animation:ppc-blink 1s steps(1) infinite}
@keyframes ppc-blink{50%{opacity:0}}
.ppc-files{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.ppc-file{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 6px 0 9px;border-radius:9px;font-size:12px;color:#c9c9ce;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);max-width:220px}
.ppc-file span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ppc-file .ppc-icon{width:11px;height:11px;fill:var(--ppc-a2);flex:none}
.ppc-file button{width:18px;height:18px;border-radius:6px;font-size:11px;color:#9a9aa2;display:grid;place-items:center}
.ppc-file button:hover{background:rgba(255,255,255,.1);color:#fff}
.ppc-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:22px}
.ppc-chips{display:flex;flex-wrap:wrap;gap:6px}
.ppc-chip{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 11px 0 9px;border-radius:10px;font-size:12.5px;font-weight:500;color:#9d9da4;background:linear-gradient(180deg,rgba(255,255,255,.085),rgba(255,255,255,.04));box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);transition:color .2s,background .2s,box-shadow .2s,transform .2s}
.ppc-chip .ppc-icon{width:12px;height:12px}
.ppc-chip:hover{color:#d4d4d8;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.07))}
.ppc-chip[aria-checked="true"]{color:#fff;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.08));box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
.ppc-chip[aria-checked="true"] .ppc-icon{fill:var(--ppc-a2)}
.ppc-chip:active{transform:scale(.96)}
.ppc-right{display:flex;align-items:center;gap:6px;flex:none}
.ppc-model-wrap{position:relative}
.ppc-model{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 10px;border-radius:10px;font-size:12.5px;color:#a3a3aa;transition:background .2s,color .2s}
.ppc-model:hover,.ppc-model[aria-expanded="true"]{background:rgba(255,255,255,.07);color:#fff}
.ppc-model .ppc-icon{width:11px;height:11px;fill:var(--ppc-a2)}
.ppc-chev{width:9px;height:6px;transition:transform .3s}
.ppc-model[aria-expanded="true"] .ppc-chev{transform:rotate(180deg)}
.ppc-menu{position:absolute;right:0;bottom:calc(100% + 10px);z-index:5;min-width:200px;padding:6px;border-radius:14px;background:rgba(22,22,26,.94);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 18px 50px rgba(0,0,0,.55);transform-origin:90% 100%;animation:ppc-pop .28s cubic-bezier(.16,1,.3,1)}
@keyframes ppc-pop{from{opacity:0;transform:translateY(6px) scale(.96)}}
.ppc-menu-item{display:flex;width:100%;align-items:baseline;justify-content:space-between;gap:16px;padding:9px 10px;border-radius:9px;font-size:13.5px;text-align:left}
.ppc-menu-item small{font-size:11.5px;color:#7d7d85}
.ppc-menu-item:hover,.ppc-menu-item:focus-visible{background:rgba(255,255,255,.08)}
.ppc-menu-item[aria-checked="true"] span{color:var(--ppc-a2)}
.ppc-attach{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#a6a6ad;transition:background .2s,color .2s}
.ppc-attach svg{width:19px;height:19px}
.ppc-attach:hover{color:#fff;background:rgba(255,255,255,.07)}
.ppc-send{position:relative;width:38px;height:38px;margin-left:4px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(160deg,var(--ppc-a1),var(--ppc-a2) 48%,var(--ppc-a3));box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 4px 16px var(--ppc-glow);transition:transform .3s cubic-bezier(.16,1,.3,1),filter .2s}
.ppc-send .ppc-icon{width:14px;height:14px;fill:var(--ppc-ink)}
.ppc-send[data-ready="false"]{filter:saturate(.35) brightness(.8)}
.ppc-send[data-ready="true"]{animation:ppc-ready 2.4s ease-in-out infinite}
@keyframes ppc-ready{50%{box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 4px 26px var(--ppc-glow),0 0 0 6px rgba(255,255,255,.04)}}
.ppc-send:hover{transform:scale(1.07)}
.ppc-send:active{transform:scale(.94)}
.ppc-hint{font-size:12px;color:var(--ppc-mute);letter-spacing:.01em;text-shadow:0 1px 8px rgba(0,0,0,.8)}
.ppc-hint kbd{font:inherit;font-size:11px;padding:1px 6px;border-radius:5px;background:rgba(20,20,24,.7);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);color:#e2e2e7}

.ppc-build{display:flex;flex-direction:column;gap:14px;padding:2px 6px 0 0}
.ppc-build-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.ppc-build-title{font-size:16px;font-weight:600;letter-spacing:-.01em}
.ppc-build-pct{font-size:13px;color:var(--ppc-a2);font-variant-numeric:tabular-nums}
.ppc-progress{height:4px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden}
.ppc-progress span{display:block;width:100%;height:4px;border-radius:4px;background:linear-gradient(90deg,var(--ppc-a3),var(--ppc-a1));transform-origin:0 50%;transition:transform .6s cubic-bezier(.16,1,.3,1)}
.ppc-steps{display:grid;gap:8px}
.ppc-step{display:flex;align-items:center;gap:10px;font-size:14px;color:#6f6f77;transition:color .4s}
.ppc-step[data-state="active"]{color:#fff}
.ppc-step[data-state="done"]{color:#b4b4bb}
.ppc-step-mark{width:16px;height:16px;display:grid;place-items:center;flex:none}
.ppc-step-mark .ppc-icon{width:13px;height:13px;fill:var(--ppc-a2)}
.ppc-step-mark i{width:6px;height:6px;border-radius:1.5px;background:currentColor;opacity:.5}
.ppc-step[data-state="active"] .ppc-step-mark i{opacity:1;background:var(--ppc-a2);box-shadow:8px 0 0 -1px var(--ppc-a2),-8px 0 0 -1px var(--ppc-a2);animation:ppc-spin 1s steps(4) infinite}
@keyframes ppc-spin{to{transform:rotate(360deg)}}
.ppc-build-foot{display:flex;justify-content:flex-end}
.ppc-ghost,.ppc-solid{display:inline-grid;place-items:center;height:38px;padding:0 16px;border-radius:11px;font-size:14px;font-weight:550;letter-spacing:-.005em;transition:background .2s,filter .2s,transform .2s}
.ppc-ghost{background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.ppc-ghost:hover{background:rgba(255,255,255,.13)}
.ppc-solid{color:var(--ppc-ink);background:linear-gradient(160deg,var(--ppc-a1),var(--ppc-a2) 55%,var(--ppc-a3));box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 6px 20px var(--ppc-glow)}
.ppc-solid:hover{filter:brightness(1.06)}
.ppc-ghost:active,.ppc-solid:active{transform:translateY(1px)}

.ppc-done{display:grid;grid-template-columns:1fr auto;gap:22px;align-items:center}
.ppc-done-copy{display:flex;flex-direction:column;gap:8px;min-width:0}
.ppc-done-kicker{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ppc-a2)}
.ppc-done-kicker .ppc-icon{width:12px;height:12px}
.ppc-done-title{font-size:26px;font-weight:650;letter-spacing:-.025em;line-height:1.1}
.ppc-done-prompt{font-size:13.5px;color:var(--ppc-mute);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ppc-done-actions{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.ppc-device{width:150px;padding:10px;border-radius:20px;background:linear-gradient(180deg,#17171b,#0f0f12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 16px 40px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:7px;transform:rotate(3deg)}
.ppc-device[data-kind="screen"]{width:210px;border-radius:14px;transform:rotate(-2deg)}
.ppc-device-top{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:600;color:#ececef;white-space:nowrap;overflow:hidden}
.ppc-device-top i{width:12px;height:12px;border-radius:4px;flex:none;background:linear-gradient(160deg,var(--ppc-a1),var(--ppc-a3))}
.ppc-device-hero{height:46px;border-radius:9px;background:linear-gradient(120deg,var(--ppc-a3),var(--ppc-a1) 60%,rgba(255,255,255,.8));opacity:.85}
.ppc-device-row{display:flex;align-items:center;gap:6px}
.ppc-device-row i{width:16px;height:16px;border-radius:5px;background:rgba(255,255,255,.12);flex:none}
.ppc-device-row span{height:6px;flex:1;border-radius:3px;background:linear-gradient(90deg,rgba(255,255,255,.08),rgba(255,255,255,.2),rgba(255,255,255,.08));background-size:200% 100%;animation:ppc-shim 1.8s linear infinite}
.ppc-device-row:nth-child(4) span{width:70%;flex:none}
@keyframes ppc-shim{to{background-position:-200% 0}}
.ppc-device-tabs{display:flex;justify-content:space-around;padding-top:6px;border-top:1px solid rgba(255,255,255,.08)}
.ppc-device-tabs i{width:10px;height:10px;border-radius:3px;background:rgba(255,255,255,.18)}
.ppc-device-tabs i:first-child{background:var(--ppc-a2)}

@media (max-width:760px){
.ppc-card{padding:18px 14px 14px 18px;border-radius:22px}
.ppc-tools{flex-direction:column;align-items:stretch;gap:14px;margin-top:16px}
.ppc-right{justify-content:flex-end}
.ppc-model-wrap{margin-right:auto}
.ppc-menu{left:0;right:auto;transform-origin:10% 100%}
.ppc-done{grid-template-columns:1fr}
.ppc-device{justify-self:center}
.ppc-hint{display:none}
}
@media (max-width:420px){
.ppc-chip{height:30px;padding:0 9px 0 8px;font-size:12px}
.ppc-input,.ppc-ph{font-size:15px}
}
@media (prefers-reduced-motion:reduce){
.ppc-root *{animation:none;transition-duration:.01ms}
}
`
