import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CachedImage from './CachedImage'

afterEach(() => { vi.unstubAllGlobals() })

it('eager images render immediately even when intersection observation is available', () => {
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    disconnect() {}
  })

  render(<CachedImage loading="eager" src="/generated-result.png" alt="生成结果" />)

  expect(screen.getByAltText('生成结果')).toBeInTheDocument()
})
