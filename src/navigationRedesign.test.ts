import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
describe('JOS mobile navigation redesign', () => {
  it('uses a primary navigation and module panel', () => {
    expect(appSource).toContain('jos-primary-nav')
    expect(appSource).toContain('jos-module-panel')
    expect(appSource).toContain('jos-quick-add')
  })

  it('keeps specialist modules accessible', () => {
    for (const tab of ['review', 'orders', 'pipeline', 'intelligence', 'sourcecheck', 'backup']) {
      expect(appSource).toContain(`changeTab('${tab}')`)
    }
  })
})
