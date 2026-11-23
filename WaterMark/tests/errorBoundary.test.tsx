// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../src/components/common/ErrorBoundary'

function mount(node: ReactNode) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => { root.render(node) })
  return {
    host,
    unmount() {
      act(() => { root.unmount() })
      host.remove()
    },
  }
}

describe('error boundary', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('shows a recoverable fallback instead of an empty page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let fail = true
    function Boom() {
      if (fail) throw new Error('Cannot read properties of null (reading \'toFixed\')')
      return <p>Report recovered</p>
    }
    const view = mount(
      <ErrorBoundary label="The area report">
        <Boom />
      </ErrorBoundary>,
    )
    expect(view.host.textContent).toContain('The area report hit a problem')
    expect(view.host.textContent).toContain('not an all-clear')
    expect(view.host.textContent).not.toContain('Report recovered')
    const retry = view.host.querySelector('button')
    expect(retry?.textContent).toBe('Try again')
    fail = false
    act(() => { retry?.click() })
    expect(view.host.textContent).toContain('Report recovered')
    expect(view.host.textContent).not.toContain('hit a problem')
    view.unmount()
  })
})
