// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/index.ts'
import { StatusLine, cacheHitPercentValue, type StatusLineProps } from '../src/client/skeleton/StatusLine.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as StatusLineProps['t']

const USAGE = {
  uncachedInputTokens: 100,
  cacheReadTokens: 700,
  cacheWriteTokens: 200,
  outputTokens: 50,
}

function projections(values: Record<string, unknown>): StatusLineProps['useProjection'] {
  return (key: string) => values[key]
}

function line(values: Record<string, unknown>) {
  return render(<StatusLine useProjection={projections(values)} t={t} />)
}

describe('cacheHitPercentValue', () => {
  it('is the read share of prompt-side input', () => {
    expect(cacheHitPercentValue({ ...USAGE })).toBe(70)
  })

  it('is null before anything was measured', () => {
    expect(cacheHitPercentValue(undefined)).toBeNull()
    expect(cacheHitPercentValue({ ...USAGE, uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeNull()
  })
})

describe('StatusLine', () => {
  it('renders both figures once pressure and usage are known', () => {
    const view = line({
      contextPressure: { projectedTokens: 64_000, contextWindow: 128_000 },
      tokenUsage: { ...USAGE },
    })
    expect(view.container.textContent).toContain('上下文 50%')
    expect(view.container.textContent).toContain('缓存命中 70%')
  })

  it('renders the occupancy alone when no usage was measured', () => {
    const view = line({ contextPressure: { projectedTokens: 32_000, contextWindow: 128_000 } })
    expect(view.container.textContent).toContain('上下文 25%')
    expect(view.container.textContent).not.toContain('缓存命中')
  })

  it('renders nothing while nothing is measurable', () => {
    expect(line({}).container.textContent).toBe('')
    expect(line({ contextPressure: { pressureTokens: 32_000 } }).container.textContent).toBe('')
  })
})
