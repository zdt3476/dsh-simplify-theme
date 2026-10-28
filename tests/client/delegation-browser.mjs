// Playwright 不属于项目依赖；通过 PLAYWRIGHT_MODULE 指向现有安装的 index.mjs。
// PLAYWRIGHT_MODULE=/绝对路径/playwright/index.mjs node --test tests/client/delegation-browser.mjs
// 如 Playwright 对应版本的浏览器未安装，可用 CHROMIUM_EXECUTABLE 指定本机 Chromium。
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

// Vite 是 Vitest 的现有依赖；pnpm 严格布局下不直接暴露在项目根目录。
const require = createRequire(import.meta.url)
const vitePath = require.resolve('vite', { paths: [require.resolve('vitest/package.json')] })
const { createServer } = await import(pathToFileURL(vitePath).href)
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href)
  : await import('playwright')
let server, browser, origin
before(async () => {
  server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'test-page', configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url !== '/fixture') return next()
        res.setHeader('Content-Type', 'text/html')
        res.end('<!doctype html><html><head></head><body><main id="chat"></main></body></html>')
      })
    } }] })
  await server.listen()
  origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) })
})
after(async () => { await browser?.close(); await server?.close() })

// UUID 显式对应会话，避免兜底认领掩盖匹配错误。
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '33333333-3333-3333-3333-333333333333'
const D = '44444444-4444-4444-4444-444444444444'
const hosts = '.subagent-topology-host'
const summary = '.subagent-topology-summary'

async function setup(t, { batches = true, running = false } = {}) {
  const page = await browser.newPage()
  const errors = []
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', error => errors.push(String(error)))
  t.after(async () => {
    await page.close()
    assert.deepEqual(errors, [], '浏览器不应出现运行时错误')
  })
  await page.goto(`${origin}/fixture`)
  await page.evaluate(async ({ A, B, C, D, batches, running }) => {
    const { mountDelegationPanel } = await import('/src/client/delegation-panel.ts')
    const { UI_CSS } = await import('/src/client/styles.ts')
    const style = document.createElement('style')
    style.textContent = UI_CSS
    document.head.append(style)
    const child = (id, title, parentId = 'session-a', active = false) => ({
      id, origin: 'subagent', parentId, displayTitle: title, running: active,
      projectionValues: { modelSelection: { model: 'model-a' }, sessionStats: { steps: 2 },
        subagentTiming: active ? { settledMs: 1000, active: { since: Date.now() - 1000 } } : { settledMs: 5000 } }
    })
    const state = window.fixture = { session: 'session-a',
      rows: { [A]: child(A, 'Alpha', 'session-a', running), [B]: child(B, 'Beta'),
        [C]: child(C, 'Gamma'), [D]: child(D, 'Delta', 'session-b') },
      listener: () => {}, opened: [], stopped: [] }
    const node = (key, tool, id) => `<div data-chat-turn="turn-1" data-chat-node-key="${key}"><div data-tool="${tool}" data-state="done">${id}</div></div>`
    document.querySelector('#chat').innerHTML = `<div id="step" data-step-process data-chat-turn="turn-1">
      ${node('one', 'subagent', A)}${node('two', 'subagent_fork', B)}
      ${batches ? node('break', 'bash', 'ordinary tool') + node('three', 'subagent', C) : ''}</div>`
    const dict = { 'delegation.batch': p => `Batch ${p.index}`, 'delegation.agents': p => `${p.count} agents`,
      'delegation.state.done': () => 'Done', 'delegation.state.running': () => 'Running',
      'delegation.state.failed': () => 'Failed', 'delegation.steps': p => `${p.count} steps`,
      'duration.s': () => 's', 'duration.m': () => 'm' }
    state.handle = mountDelegationPanel({
      sessions: { getSnapshot: () => ({ byId: state.rows }), subscribe: fn => { state.listener = fn; return () => { state.listener = () => {} } } },
      currentSessionId: () => state.session, locale: (key, params = {}) => dict[key]?.(params) ?? key,
      openSession: id => state.opened.push(id), canCancel: () => true, cancelSession: id => state.stopped.push(id)
    })
  }, { A, B, C, D, batches, running })
  return page
}
async function waitCount(page, selector, count) {
  await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count,
    { selector, count }, { timeout: 2500 })
}

test('同回合兄弟节点分批编号、排序，且宿主步骤折叠后摘要可见', async t => {
  const page = await setup(t)
  await waitCount(page, hosts, 2)
  assert.deepEqual(await page.locator('.subagent-topology-summary-label').allTextContents(), ['Batch 1', 'Batch 2'])
  assert.deepEqual(await page.locator('.subagent-topology-summary-counts').allTextContents(), ['2 agents · 2 Done', '1 agents · 1 Done'])
})

test('宿主步骤折叠时摘要仍然可见', async t => {
  const page = await setup(t)
  await waitCount(page, hosts, 2)
  assert.equal(await page.locator('#step').evaluate(el => el.querySelectorAll('.subagent-topology-host').length), 0)
  await page.locator('#step').evaluate(el => { el.style.display = 'none' })
  assert.equal(await page.locator(summary).first().isVisible(), true)
  assert.equal(await page.locator(summary).last().isVisible(), true)
})

test('摘要默认折叠、展开后可打开子会话及绘制连接线', async t => {
  const page = await setup(t, { batches: false })
  await waitCount(page, hosts, 1)
  assert.equal(await page.locator(summary).getAttribute('aria-expanded'), 'false')
  assert.equal(await page.locator('.subagent-topology-detail').isVisible(), false)
  await page.locator(summary).click()
  assert.equal(await page.locator(summary).getAttribute('aria-expanded'), 'true')
  assert.equal(await page.locator('.subagent-topology-detail').isVisible(), true)
  await page.waitForFunction(() => document.querySelector('.subagent-topology-lines path')?.getAttribute('d'))
  await page.locator('.subagent-topology-node-header').first().click()
  assert.deepEqual(await page.evaluate(() => window.fixture.opened), [A])
  await page.locator(summary).click()
  assert.equal(await page.locator(summary).getAttribute('aria-expanded'), 'false')
})

test('订阅更新时保持展开并更新状态、名称、步数', async t => {
  const page = await setup(t, { batches: false, running: true })
  await waitCount(page, hosts, 1)
  await page.locator(summary).click()
  await page.evaluate(({ A }) => {
    const row = window.fixture.rows[A]
    row.running = false; row.displayTitle = 'Alpha updated'
    row.projectionValues.sessionStats.steps = 9
    row.projectionValues.subagentTiming = { settledMs: 9000 }
    window.fixture.listener()
  }, { A })
  await page.waitForFunction(() => document.querySelector('.subagent-topology-summary-counts')?.textContent.includes('2 Done'), null, { timeout: 2500 })
  assert.equal(await page.locator(summary).getAttribute('aria-expanded'), 'true')
  assert.equal(await page.locator('.subagent-topology-node-title').first().textContent(), 'Alpha updated')
  assert.equal(await page.locator('.subagent-topology-node-steps').first().textContent(), '9 steps')
})

test('仅修改标题时更新展开的节点', async t => {
  const page = await setup(t, { batches: false })
  await waitCount(page, hosts, 1)
  await page.locator(summary).click()
  await page.evaluate(({ A }) => { window.fixture.rows[A].displayTitle = 'Renamed'; window.fixture.listener() }, { A })
  await page.waitForFunction(() => document.querySelector('.subagent-topology-node-title')?.textContent === 'Renamed', null, { timeout: 2500 })
  assert.equal(await page.locator(summary).getAttribute('aria-expanded'), 'true')
})

test('运行中计时刷新后保持展开，并且停止按钮只触发停止', async t => {
  const page = await setup(t, { batches: false, running: true })
  await waitCount(page, hosts, 1)
  await page.locator(summary).click()
  const initial = await page.locator('.subagent-topology-node-status').first().textContent()
  await page.waitForFunction(initial => document.querySelector('.subagent-topology-node-status')?.textContent !== initial, initial, { timeout: 3500 })
  assert.equal(await page.locator(summary).getAttribute('aria-expanded'), 'true')
  await page.locator('.subagent-stop-button').click()
  assert.deepEqual(await page.evaluate(() => window.fixture.stopped), [A])
  assert.deepEqual(await page.evaluate(() => window.fixture.opened), [])
})

test('移除委派源后清理对应摘要及隐藏标记', async t => {
  const page = await setup(t)
  await waitCount(page, hosts, 2)
  await page.locator('[data-chat-node-key="three"]').evaluate(el => el.remove())
  await waitCount(page, hosts, 1)
  await page.locator('[data-chat-node-key="one"]').evaluate(el => el.remove())
  await page.locator('[data-chat-node-key="two"]').evaluate(el => el.remove())
  await waitCount(page, hosts, 0)
  assert.equal(await page.locator('[data-dsh-simplify-delegation-source]').count(), 0)
})

test('切换会话并替换聊天内容，不残留旧摘要与展开状态', async t => {
  const page = await setup(t, { batches: false })
  await waitCount(page, hosts, 1)
  await page.locator(summary).click()
  await page.evaluate(({ D }) => {
    window.fixture.session = 'session-b'
    document.querySelector('#chat').innerHTML = `<div data-step-process data-chat-turn="turn-1"><div data-chat-turn="turn-1" data-chat-node-key="new"><div data-tool="subagent">${D}</div></div></div>`
    window.fixture.listener()
  }, { D })
  await waitCount(page, hosts, 1)
  await page.waitForFunction(() => document.querySelector('.subagent-topology-summary-counts')?.textContent.includes('1 agents'), null, { timeout: 2500 })
  assert.equal(await page.locator(summary).getAttribute('aria-expanded'), 'false')
  await page.locator(summary).click()
  assert.deepEqual(await page.locator('.subagent-topology-node-title').allTextContents(), ['Delta'])
})

test('无法识别子会话时保留原工具行，不猜测关联', async t => {
  const page = await setup(t, { batches: false })
  await waitCount(page, hosts, 1)
  await page.locator('[data-chat-node-key="one"] [data-tool]').evaluate(el => { el.textContent = '无子会话标识' })
  await page.evaluate(() => window.fixture.listener())
  await page.waitForFunction(() => !document.querySelector('[data-chat-node-key="one"] [data-tool]')?.hasAttribute('data-dsh-simplify-delegation-source'))
  await page.locator(summary).click()
  assert.deepEqual(await page.locator('.subagent-topology-node-title').allTextContents(), ['Beta'])
})

test('连续追加委派时更新同一摘要而不留下旧卡片', async t => {
  const page = await setup(t, { batches: false })
  await waitCount(page, hosts, 1)
  await page.locator(summary).click()
  await page.evaluate(({ C }) => {
    document.querySelector('#step').insertAdjacentHTML('beforeend', `<div data-chat-turn="turn-1" data-chat-node-key="new"><div data-tool="subagent">${C}</div></div>`)
  }, { C })
  await page.waitForFunction(() => document.querySelector('.subagent-topology-summary-counts')?.textContent.includes('3 agents'))
  assert.equal(await page.locator(hosts).count(), 1)
  assert.equal(await page.locator(summary).getAttribute('aria-expanded'), 'true')
})

test('卸载后删除摘要并恢复原工具行', async t => {
  const page = await setup(t, { batches: false })
  await waitCount(page, hosts, 1)
  assert.equal(await page.locator('[data-dsh-simplify-delegation-source]').count(), 2)
  await page.evaluate(() => window.fixture.handle.dispose())
  assert.equal(await page.locator(hosts).count(), 0)
  assert.equal(await page.locator('[data-dsh-simplify-delegation-source]').count(), 0)
  assert.equal(await page.locator('[data-tool="subagent"]').isVisible(), true)
})
