import { useId, useState, type CSSProperties } from 'react'
import type { AssistantMessage } from '../../scripting/content/featureExamples'
import { Icon } from '../common/Icon'
import { LogoMark } from '../common/Logo'

type Props = {
  messages: readonly AssistantMessage[]
  isExample?: boolean
  /** False until the assistant service is connected: the composer says so instead of pretending. */
  isConnected?: boolean
  /** Shows the live voice mic + read-aloud preview state on the landing page. */
  voicePreview?: boolean
}

/**
 * Conversation with the WaterMark assistant. Every answer carries chips that
 * link to the evidence it summarized, colored by kind of evidence. The
 * assistant only summarizes data WaterMark fetched (AGENTS.md, LLM/voice).
 */
export function AssistantThread({ messages, isExample = false, isConnected = false, voicePreview = false }: Props) {
  const inputId = useId()
  const [readAloud, setReadAloud] = useState(true)
  return (
    <article className="evidence-panel assistant" aria-label={isExample ? 'Assistant, example conversation' : 'Assistant'}>
      <header className="evidence-panel-head">
        <h3>Ask WaterMark</h3>
        <span className="evidence-panel-tags">
          {voicePreview && (
            <button
              type="button"
              className={`voice-pill ${readAloud ? 'is-on' : ''}`}
              aria-pressed={readAloud}
              onClick={() => setReadAloud((on) => !on)}
            >
              <Icon name="mic" size={12} /> {readAloud ? 'Read aloud on · ElevenLabs' : 'Read aloud off'}
            </button>
          )}
          {isExample && <span className="example-badge">Example conversation</span>}
        </span>
      </header>

      <ol className="assistant-thread">
        {messages.map((message, index) => (
          <li
            key={message.id}
            className={`bubble bubble--${message.role}`}
            style={{ '--i': index } as CSSProperties}
          >
            {message.role === 'assistant' && (
              <span className="bubble-avatar" aria-hidden="true">
                <LogoMark size={22} />
              </span>
            )}
            <span className="bubble-body">
              <span className="visually-hidden">{message.role === 'user' ? 'You asked: ' : 'WaterMark answered: '}</span>
              {message.text}
              {message.citations && (
                <span className="bubble-cites">
                  {message.citations.map((cite) => (
                    <a
                      key={cite.label}
                      className={`cite cite--${cite.kind}`}
                      href={cite.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {cite.label}
                    </a>
                  ))}
                </span>
              )}
            </span>
          </li>
        ))}
        <li className="bubble bubble--assistant bubble--typing" style={{ '--i': messages.length } as CSSProperties} aria-hidden="true">
          <span className="bubble-avatar">
            <LogoMark size={22} />
          </span>
          <span className="bubble-body">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        </li>
      </ol>

      <form className="assistant-composer" onSubmit={(event) => event.preventDefault()}>
        <label className="visually-hidden" htmlFor={inputId}>
          Ask a question
        </label>
        <input
          id={inputId}
          className="assistant-input"
          placeholder={isConnected || voicePreview ? 'Ask by text or voice on /map…' : 'The assistant is not connected yet'}
          disabled={!isConnected}
        />
        <button type="button" className="assistant-icon-button" disabled={!isConnected} aria-label="Speak your question">
          <Icon name="mic" size={18} />
        </button>
        <button type="submit" className="assistant-icon-button assistant-send" disabled={!isConnected} aria-label="Send">
          <Icon name="send" size={18} />
        </button>
      </form>
      <p className="evidence-limit">
        Answers run Gemini tool calls over cited WaterMark data and support voice input plus ElevenLabs or browser read-aloud.
      </p>
    </article>
  )
}
