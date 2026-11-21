import { useId, type CSSProperties } from 'react'
import type { AssistantMessage } from '../../scripting/content/featureExamples'
import { Icon } from '../common/Icon'
import { LogoMark } from '../common/Logo'

type Props = {
  messages: readonly AssistantMessage[]
  isExample?: boolean
  /** False until the assistant service is connected: the composer says so instead of pretending. */
  isConnected?: boolean
}

/**
 * Conversation with the WaterMark assistant. Every answer carries chips that
 * link to the evidence it summarized, colored by kind of evidence. The
 * assistant only summarizes data WaterMark fetched (AGENTS.md, LLM/voice).
 */
export function AssistantThread({ messages, isExample = false, isConnected = false }: Props) {
  const inputId = useId()
  return (
    <article className="evidence-panel assistant" aria-label={isExample ? 'Assistant, example conversation' : 'Assistant'}>
      <header className="evidence-panel-head">
        <h3>Ask WaterMark</h3>
        <span className="evidence-panel-tags">
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
          placeholder={isConnected ? 'Ask about this place…' : 'The assistant is not connected yet'}
          disabled={!isConnected}
        />
        <button type="button" className="assistant-icon-button" disabled={!isConnected} aria-label="Speak your question">
          <Icon name="mic" size={18} />
        </button>
        <button type="submit" className="assistant-icon-button assistant-send" disabled={!isConnected} aria-label="Send">
          <Icon name="send" size={18} />
        </button>
      </form>
      <p className="evidence-limit">Answers summarize cited WaterMark data only. Official warnings always take priority.</p>
    </article>
  )
}
