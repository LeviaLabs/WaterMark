// The flood assistant: a tab at the bottom of the map that opens a chat panel (closed when the page
// opens). Questions go to Google Gemini through our assistant function; the model looks things up
// with the map's own data sources and answers from them, listing the data it used under each answer.
// Optional voice: the browser's speech recognition for the mic and speech synthesis to read answers.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../common/Icon'
import { ScrollArea } from '../common/ScrollArea'
import { usePresence } from '../../hooks/usePresence'
import { useAssistant } from '../../hooks/useAssistant'
import { blocksOf, speakableText, suggestionsFor, type Inline } from '../../scripting/assistant'
import type { LngLat } from '../../scripting/types'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** The place on the map, for the header and the suggested questions. */
  placeName: string | null
  isUS: boolean
  getContext: () => string
  showOnMap: (at: LngLat, label: string) => void
}

// Minimal typing for the Web Speech API's recognizer (not in TypeScript's DOM types).
interface Recognizer {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}
type RecognizerClass = new () => Recognizer
const Recognition: RecognizerClass | undefined = typeof window === 'undefined'
  ? undefined
  : (window as unknown as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: RecognizerClass }).webkitSpeechRecognition
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

const READ_ALOUD_KEY = 'watermark-assistant-read-aloud'
function loadReadAloud(): boolean {
  try { return localStorage.getItem(READ_ALOUD_KEY) === '1' } catch { return false }
}

function Line({ parts }: { parts: Inline[] }) {
  return <>{parts.map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>))}</>
}

function Reply({ text }: { text: string }) {
  return (
    <>
      {blocksOf(text).map((b, i) => (b.kind === 'p'
        ? <p key={i}><Line parts={b.parts} /></p>
        : <ul key={i}>{b.items.map((item, j) => <li key={j}><Line parts={item} /></li>)}</ul>))}
    </>
  )
}

export function Assistant({ isOpen, onOpenChange, placeName, isUS, getContext, showOnMap }: Props) {
  const id = useId()
  const presence = usePresence(isOpen)
  const { messages, activity, isBusy, send, reset, stop } = useAssistant(getContext, showOnMap)
  const [draft, setDraft] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [readAloud, setReadAloud] = useState(loadReadAloud)
  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const recognizer = useRef<Recognizer | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const end = useRef<HTMLSpanElement>(null)
  const spoken = useRef(0)

  // Keep the newest message in view.
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length, activity])
  // Focus the question box when the panel opens.
  useEffect(() => { if (isOpen) input.current?.focus({ preventScroll: true }) }, [isOpen])

  // Read each new answer aloud when asked to.
  useEffect(() => {
    const last = messages.at(-1)
    if (!canSpeak || !readAloud || !last || last.role !== 'assistant' || last.id === spoken.current) return
    spoken.current = last.id
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(speakableText(last.text))
    u.lang = navigator.language
    speechSynthesis.speak(u)
  }, [messages, readAloud])
  useEffect(() => () => { if (canSpeak) speechSynthesis.cancel(); recognizer.current?.stop() }, [])
  useEffect(() => { if (!isOpen && canSpeak) speechSynthesis.cancel() }, [isOpen])

  const ask = (q: string) => {
    if (!q.trim() || isBusy) return
    setDraft('')
    void send(q)
  }
  const onSubmit = (e: FormEvent) => { e.preventDefault(); ask(draft) }

  const toggleReadAloud = () => {
    const next = !readAloud
    setReadAloud(next)
    if (!next && canSpeak) speechSynthesis.cancel()
    try { localStorage.setItem(READ_ALOUD_KEY, next ? '1' : '0') } catch { /* private mode: not remembered */ }
  }

  const listen = () => {
    if (!Recognition) return
    if (isListening) { recognizer.current?.stop(); return }
    const r = new Recognition()
    r.lang = navigator.language
    r.interimResults = true
    r.onresult = (e) => {
      const said = Array.from(e.results).map((res) => res[0]?.transcript ?? '').join('')
      setDraft(said)
      const last = e.results[e.results.length - 1]
      if (last?.isFinal) { r.stop(); ask(said) }
    }
    r.onend = () => setIsListening(false)
    r.onerror = () => setIsListening(false)
    recognizer.current = r
    setIsListening(true)
    r.start()
  }

  const newConversation = () => { reset(); if (canSpeak) speechSynthesis.cancel(); setDraft(''); input.current?.focus() }
  const suggestions = suggestionsFor(placeName, isUS)

  return (
    <>
      <button type="button" className={isOpen ? 'map-card assistant-tab is-hidden' : 'map-card assistant-tab'}
        aria-expanded={isOpen} aria-controls={id} onClick={() => onOpenChange(true)} tabIndex={isOpen ? -1 : 0}>
        <Icon name="chat" size={20} />
        <span className="assistant-tab-label">Ask about floods</span>
      </button>
      {presence.isMounted ? (
        <section id={id} aria-label="Flood assistant" {...presence.bind}
          className={presence.isClosing ? 'map-card assistant is-closing' : 'map-card assistant'}>
          <header className="assistant-head">
            <h2 className="assistant-title">
              <Icon name="spark" size={18} />
              Flood assistant
              <span className="assistant-where">· {placeName ?? 'World'}</span>
            </h2>
            <button type="button" className="assistant-link" onClick={newConversation} disabled={!messages.length && !isBusy}>
              New conversation
            </button>
            <button type="button" className="assistant-icon-btn" aria-label="Close the assistant" onClick={() => onOpenChange(false)}>
              <Icon name="close" size={18} />
            </button>
          </header>
          <div className="assistant-note">
            <div className="assistant-note-bar">
              {canSpeak ? (
                <button type="button" role="switch" aria-checked={readAloud} className="assistant-switch" onClick={toggleReadAloud}>
                  <span className="assistant-switch-track" aria-hidden="true"><span className="assistant-switch-thumb" /></span>
                  Read answers aloud
                </button>
              ) : null}
              <button type="button" className="assistant-note-toggle" aria-expanded={isNoteOpen} aria-controls={`${id}-note`}
                onClick={() => setIsNoteOpen(!isNoteOpen)}>
                About these answers
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
              </button>
            </div>
            <p>AI can make mistakes. Check official warnings before you act.</p>
            {isNoteOpen ? (
              <div id={`${id}-note`} className="assistant-note-more">
                <p>
                  Answers come from Google Gemini, which looks up the same sources as this map (GDACS, NOAA, Open-Meteo,
                  NWS) and lists what it used. In an emergency call your local emergency number.
                </p>
                {Recognition ? <p>The mic uses your browser's speech service; in Chrome that sends audio to Google.</p> : null}
              </div>
            ) : null}
          </div>
          <ScrollArea className="assistant-scroll">
            <div className="assistant-log" aria-live="polite">
              {messages.length === 0 ? (
                <div className="assistant-empty">
                  <p className="assistant-intro">
                    Ask about floods anywhere on Earth: how often a place floods, rain on the way, river levels, warnings in
                    effect, or how to stay safe. When it looks up a place, it opens it on the map for you.
                  </p>
                  <p className="assistant-try">Try{placeName ? `, for ${placeName}` : ''}</p>
                  <ul className="assistant-suggestions">
                    {suggestions.map((s) => (
                      <li key={s}><button type="button" className="assistant-suggestion" onClick={() => ask(s)}>{s}</button></li>
                    ))}
                  </ul>
                </div>
              ) : messages.map((m) => (
                <article key={m.id} className={`assistant-msg assistant-msg--${m.role}${m.isError ? ' is-error' : ''}`}>
                  {m.role === 'user' ? <p>{m.text}</p> : <Reply text={m.text} />}
                  {m.used.length ? (
                    <details className="assistant-used">
                      <summary>Data used ({m.used.length})</summary>
                      <ul>{m.used.map((u) => <li key={u}>{u}</li>)}</ul>
                    </details>
                  ) : null}
                </article>
              ))}
              {activity ? (
                <p className="assistant-activity" role="status">
                  <span className="assistant-dots" aria-hidden="true"><span /><span /><span /></span>
                  {activity}…
                </p>
              ) : null}
              <span ref={end} />
            </div>
          </ScrollArea>
          <form className="assistant-form" onSubmit={onSubmit}>
            <input ref={input} className="assistant-input" value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder={isListening ? 'Listening…' : 'Ask about a place, a flood or the rain'} aria-label="Your question"
              maxLength={600} enterKeyHint="send" />
            {Recognition ? (
              <button type="button" className={isListening ? 'assistant-icon-btn is-on' : 'assistant-icon-btn'} onClick={listen}
                aria-label={isListening ? 'Stop listening' : 'Ask by voice'} aria-pressed={isListening}>
                <Icon name="mic" size={18} />
              </button>
            ) : null}
            {isBusy ? (
              <button type="button" className="assistant-send" onClick={stop} aria-label="Stop">
                <Icon name="stop" size={16} />
              </button>
            ) : (
              <button type="submit" className="assistant-send" aria-label="Send" disabled={!draft.trim()}>
                <Icon name="arrowRight" size={18} />
              </button>
            )}
          </form>
        </section>
      ) : null}
    </>
  )
}
