// One flood-assistant conversation. Sending a question asks the model for its next turn; while that
// turn calls tools, they run here (services/assistant/tools.ts) and their results go back, up to a
// few rounds, until the model answers in text. Only the question, the answer and the list of data
// used are shown; the raw turns (with tool results) stay in a ref and go along with the next question.
import { useCallback, useEffect, useRef, useState } from 'react'
import { askAssistant } from '../services/assistant/client'
import { runTool, type ToolContext } from '../services/assistant/tools'
import { callsIn, textOf, toolLabel, toolResultsTurn, type Content } from '../scripting/assistant'
import { isAbort } from '../services/http'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  /** The data the answer used, in plain words ("Rain forecast at … (Open-Meteo)"). */
  used: string[]
  isError?: boolean
}

const MAX_ROUNDS = 6

export function useAssistant(getContext: () => string, showOnMap: ToolContext['showOnMap']) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activity, setActivity] = useState<string | null>(null)
  const contents = useRef<Content[]>([])
  const ctl = useRef<AbortController | null>(null)
  const nextId = useRef(1)
  // The latest callbacks, so a running conversation uses the current map state.
  const latest = useRef({ getContext, showOnMap })
  useEffect(() => { latest.current = { getContext, showOnMap } })
  useEffect(() => () => ctl.current?.abort(), [])

  const isBusy = activity !== null

  const send = useCallback(async (question: string) => {
    const text = question.trim()
    if (!text || ctl.current) return
    const controller = new AbortController()
    ctl.current = controller
    const add = (m: Omit<ChatMessage, 'id'>) => setMessages((list) => [...list, { ...m, id: nextId.current++ }])
    add({ role: 'user', text, used: [] })
    const start = contents.current.length
    contents.current = [...contents.current, { role: 'user', parts: [{ text }] }]
    const used: string[] = []
    setActivity('Thinking')
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const turn = await askAssistant(contents.current, latest.current.getContext(), controller.signal)
        contents.current = [...contents.current, turn]
        const calls = callsIn(turn)
        if (!calls.length) {
          add({ role: 'assistant', text: textOf(turn) || 'I have no answer for that.', used })
          return
        }
        const labels = calls.map(toolLabel)
        setActivity(labels.join(' · '))
        const results = await Promise.all(calls.map((c) => runTool(c, { signal: controller.signal, showOnMap: latest.current.showOnMap })))
        for (const l of labels) if (!used.includes(l)) used.push(l)
        contents.current = [...contents.current, toolResultsTurn(calls, results)]
        setActivity('Reading the data')
      }
      add({ role: 'assistant', text: "That took too many steps. Try asking a narrower question.", used, isError: true })
      contents.current = contents.current.slice(0, start)
    } catch (e) {
      // The question stays on screen, but its unfinished turns leave the history sent next time.
      contents.current = contents.current.slice(0, start)
      if (isAbort(e) || controller.signal.aborted) return
      add({ role: 'assistant', text: e instanceof Error ? e.message : 'Something went wrong.', used: [], isError: true })
    } finally {
      if (ctl.current === controller) ctl.current = null
      setActivity(null)
    }
  }, [])

  const reset = useCallback(() => {
    ctl.current?.abort()
    ctl.current = null
    contents.current = []
    setMessages([])
    setActivity(null)
  }, [])

  const stop = useCallback(() => { ctl.current?.abort() }, [])

  return { messages, activity, isBusy, send, reset, stop }
}
