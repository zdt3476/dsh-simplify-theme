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
        if (req.url === '/favicon.ico') { res.statusCode = 204; res.end(); return }
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
  await page.screenshot({ path: '/tmp/delegation-collapsed.png' })
  assert.equal(await page.locator(summary).getAttribute('aria-expanded'), 'false')
  assert.equal(await page.locator('.subagent-topology-detail').isVisible(), false)
  await page.locator(summary).click()
  assert.equal(await page.locator(summary).getAttribute('aria-expanded'), 'true')
  assert.equal(await page.locator('.subagent-topology-detail').isVisible(), true)
  await page.waitForFunction(() => document.querySelector('.subagent-topology-lines path')?.getAttribute('d'))
  await page.screenshot({ path: '/tmp/delegation-expanded.png' })
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

test('子代理全部认领后，多余的工具行保留原生展示', async t => {
  const page = await setup(t, { batches: false })
  await waitCount(page, hosts, 1)
  // session-a 下共有 A、B、C 三个子代理；注入两个多余工具行（一个将认领 C，另一个无会话可认领）
  await page.evaluate(({ C }) => {
    document.querySelector('#step').insertAdjacentHTML('beforeend', `<div data-chat-turn="turn-1" data-chat-node-key="new"><div data-tool="subagent">${C}</div></div><div data-chat-turn="turn-1" data-chat-node-key="extra"><div data-tool="subagent">extra without session</div></div>`)
    window.fixture.listener()
  }, { C })
  await page.waitForFunction(() => document.querySelector('[data-chat-node-key="extra"] [data-tool]') && !document.querySelector('[data-chat-node-key="extra"] [data-tool]')?.hasAttribute('data-dsh-simplify-delegation-source'))
  await page.locator(summary).click()
  assert.deepEqual(await page.locator('.subagent-topology-node-title').allTextContents(), ['Alpha', 'Beta', 'Gamma'])
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

test('模拟真实宿主折叠工具行（无 UUID，仅描述与状态文本），正常生成委派卡片并准确匹配', async t => {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.goto(`${origin}/fixture`)
  await page.evaluate(async ({ A, B }) => {
    const { mountDelegationPanel } = await import('/src/client/delegation-panel.ts')
    const { UI_CSS } = await import('/src/client/styles.ts')
    const style = document.createElement('style')
    style.textContent = UI_CSS
    document.head.append(style)
    const child = (id, title) => ({
      id, origin: 'subagent', parentId: 'session-live', displayTitle: title, running: false,
      projectionValues: { modelSelection: { model: 'model-a' }, sessionStats: { steps: 2 }, subagentTiming: { settledMs: 5000 } }
    })
    const state = window.fixture = {
      session: 'session-live',
      rows: { [A]: child(A, 'Inspect server disconnect'), [B]: child(B, 'Inspect client disconnect') },
      listener: () => {}, opened: [], stopped: []
    }
    // 真实宿主结构：工具行折叠时只有子智能体文字和描述，完全无 UUID
    document.querySelector('#chat').innerHTML = `<div id="step" data-step-process data-chat-turn="turn-1">
      <div data-chat-turn="turn-1" data-chat-node-key="k1"><div data-tool="subagent" data-state="ok"><span>子智能体</span><span>Inspect server disconnect · 已完成</span></div></div>
      <div data-chat-turn="turn-1" data-chat-node-key="k2"><div data-tool="subagent" data-state="ok"><span>子智能体</span><span>Inspect client disconnect · 已完成</span></div></div>
    </div>`
    const dict = { 'delegation.batch': p => `Batch ${p.index}`, 'delegation.agents': p => `${p.count} agents`,
      'delegation.state.done': () => 'Done', 'delegation.state.running': () => 'Running',
      'delegation.state.failed': () => 'Failed', 'delegation.steps': p => `${p.count} steps`,
      'duration.s': () => 's', 'duration.m': () => 'm' }
    state.handle = mountDelegationPanel({
      sessions: {
        getSnapshot: () => ({ byId: state.rows, projectionsBySession: { 'session-live': { values: { subagentCatalog: [{ id: A, label: 'Inspect server disconnect' }, { id: B, label: 'Inspect client disconnect' }] } } } }),
        subscribe: fn => { state.listener = fn; return () => { state.listener = () => {} } }
      },
      currentSessionId: () => state.session,
      locale: (key, params = {}) => dict[key]?.(params) ?? key,
      openSession: id => state.opened.push(id)
    })
  }, { A, B })

  await waitCount(page, hosts, 1)
  assert.equal(await page.locator('.subagent-topology-summary-counts').textContent(), '2 agents · 2 Done')
  await page.locator(summary).click()
  assert.deepEqual(await page.locator('.subagent-topology-node-title').allTextContents(), ['Inspect server disconnect', 'Inspect client disconnect'])
  // 点击能正确打开对应子代理会话
  await page.locator('.subagent-topology-node-header').first().click()
  assert.deepEqual(await page.evaluate(() => window.fixture.opened), [A])
})

test('多轮对话中，第二轮发起新委派应编号为递增批次并正确展示第二轮的子代理', async t => {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.goto(`${origin}/fixture`)
  await page.evaluate(async ({ A, B }) => {
    const { mountDelegationPanel } = await import('/src/client/delegation-panel.ts')
    const { UI_CSS } = await import('/src/client/styles.ts')
    const style = document.createElement('style')
    style.textContent = UI_CSS
    document.head.append(style)
    const child = (id, title) => ({
      id, origin: 'subagent', parentId: 'session-multi-turn', displayTitle: title, running: false,
      projectionValues: { modelSelection: { model: 'model-a' }, sessionStats: { steps: 2 }, subagentTiming: { settledMs: 5000 } }
    })
    const state = window.fixture = {
      session: 'session-multi-turn',
      rows: { [A]: child(A, 'Task 1 in Turn 1'), [B]: child(B, 'Task 2 in Turn 2') },
      listener: () => {}, opened: [], stopped: []
    }
    // 模拟真实宿主结构：Turn 1 和 Turn 2 两个独立回合
    document.querySelector('#chat').innerHTML = `
      <div id="step-1" data-step-process data-chat-turn="turn-1">
        <div data-chat-turn="turn-1" data-chat-node-key="t1-node"><div data-tool="subagent" data-state="ok"><span>子智能体</span><span>Task 1 in Turn 1 · 已完成</span></div></div>
      </div>
      <div id="step-2" data-step-process data-chat-turn="turn-2">
        <div data-chat-turn="turn-2" data-chat-node-key="t2-node"><div data-tool="subagent" data-state="ok"><span>子智能体</span><span>Task 2 in Turn 2 · 已完成</span></div></div>
      </div>
    `
    const dict = { 'delegation.batch': p => `Batch ${p.index}`, 'delegation.agents': p => `${p.count} agents`,
      'delegation.state.done': () => 'Done', 'delegation.state.running': () => 'Running',
      'delegation.state.failed': () => 'Failed', 'delegation.steps': p => `${p.count} steps`,
      'duration.s': () => 's', 'duration.m': () => 'm' }
    state.handle = mountDelegationPanel({
      sessions: {
        getSnapshot: () => ({ byId: state.rows, projectionsBySession: { 'session-multi-turn': { values: { subagentCatalog: [{ id: A, label: 'Task 1 in Turn 1' }, { id: B, label: 'Task 2 in Turn 2' }] } } } }),
        subscribe: fn => { state.listener = fn; return () => { state.listener = () => {} } }
      },
      currentSessionId: () => state.session,
      locale: (key, params = {}) => dict[key]?.(params) ?? key,
      openSession: id => state.opened.push(id)
    })
  }, { A, B })

  await waitCount(page, hosts, 2)
  const labels = await page.locator('.subagent-topology-summary-label').allTextContents()
  assert.deepEqual(labels, ['Batch 1', 'Batch 2'])
  const summaries = page.locator(summary)
  await summaries.nth(0).click()
  await summaries.nth(1).click()
  const titles = await page.locator('.subagent-topology-node-title').allTextContents()
  assert.deepEqual(titles, ['Task 1 in Turn 1', 'Task 2 in Turn 2'])
})

test('第一轮对话完成后，动态开启第二轮对话派发子代理，不覆盖旧图且递增计数为第2次委派', async t => {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.goto(`${origin}/fixture`)
  await page.evaluate(async ({ A, B }) => {
    const { mountDelegationPanel } = await import('/src/client/delegation-panel.ts')
    const { UI_CSS } = await import('/src/client/styles.ts')
    const style = document.createElement('style')
    style.textContent = UI_CSS
    document.head.append(style)
    const child = (id, title) => ({
      id, origin: 'subagent', parentId: 'session-dynamic-turns', displayTitle: title, running: false,
      projectionValues: { modelSelection: { model: 'model-a' }, sessionStats: { steps: 2 }, subagentTiming: { settledMs: 5000 } }
    })
    const state = window.fixture = {
      session: 'session-dynamic-turns',
      rows: { [A]: child(A, 'Task 1 in Round 1') },
      catalog: [{ id: A, label: 'Task 1 in Round 1' }],
      listener: () => {}, opened: [], stopped: []
    }
    // 初始状态：只有第一轮对话及其委派
    document.querySelector('#chat').innerHTML = `
      <div id="round-1" data-step-process data-chat-turn="turn-1">
        <div data-chat-turn="turn-1" data-chat-node-key="r1-node"><div data-tool="subagent" data-state="ok"><span>子智能体</span><span>Task 1 in Round 1 · 已完成</span></div></div>
      </div>
    `
    const dict = { 'delegation.batch': p => `Batch ${p.index}`, 'delegation.agents': p => `${p.count} agents`,
      'delegation.state.done': () => 'Done', 'delegation.state.running': () => 'Running',
      'delegation.state.failed': () => 'Failed', 'delegation.steps': p => `${p.count} steps`,
      'duration.s': () => 's', 'duration.m': () => 'm' }
    state.handle = mountDelegationPanel({
      sessions: {
        getSnapshot: () => ({ byId: state.rows, projectionsBySession: { 'session-dynamic-turns': { values: { subagentCatalog: state.catalog } } } }),
        subscribe: fn => { state.listener = fn; return () => { state.listener = () => {} } }
      },
      currentSessionId: () => state.session,
      locale: (key, params = {}) => dict[key]?.(params) ?? key,
      openSession: id => state.opened.push(id)
    })
  }, { A, B })

  // 第一轮：生成 Batch 1
  await waitCount(page, hosts, 1)
  assert.equal(await page.locator('.subagent-topology-summary-label').textContent(), 'Batch 1')
  await page.locator(summary).click()
  assert.equal(await page.locator('.subagent-topology-node-title').textContent(), 'Task 1 in Round 1')

  // 模拟开启第二轮聊天：用户发送新指令，模型开启 round-2 并产生新的 subagent 调用
  await page.evaluate(({ B }) => {
    const child = (id, title) => ({
      id, origin: 'subagent', parentId: 'session-dynamic-turns', displayTitle: title, running: false,
      projectionValues: { modelSelection: { model: 'model-b' }, sessionStats: { steps: 3 }, subagentTiming: { settledMs: 8000 } }
    })
    window.fixture.rows[B] = child(B, 'Task 2 in Round 2')
    window.fixture.catalog.push({ id: B, label: 'Task 2 in Round 2' })

    // 第一轮步骤已被折叠（拥有 hidden 属性与已隐藏工具行），追加第二轮步骤容器
    document.querySelector('#chat').insertAdjacentHTML('beforeend', `
      <div id="round-2" data-step-process data-chat-turn="turn-2">
        <div data-chat-turn="turn-2" data-chat-node-key="r2-node"><div data-tool="subagent" data-state="ok"><span>子智能体</span><span>Task 2 in Round 2 · 已完成</span></div></div>
      </div>
    `)
    window.fixture.listener()
  }, { B })

  // 验证第二轮追加后生成两个独立宿主
  await waitCount(page, hosts, 2)
  const labels = await page.locator('.subagent-topology-summary-label').allTextContents()
  // 核心断言：第二轮编号为 Batch 2，绝不可回退重置为 Batch 1
  assert.deepEqual(labels, ['Batch 1', 'Batch 2'])

  // 展开第二轮卡片
  await page.locator(summary).nth(1).click()
  const titles = await page.locator('.subagent-topology-node-title').allTextContents()
  // 核心断言：第二轮必须显示 Task 2，绝不可显示第一轮的旧图 Task 1
  assert.deepEqual(titles, ['Task 1 in Round 1', 'Task 2 in Round 2'])
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
