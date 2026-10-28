import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const vitePath = require.resolve('vite', { paths: [require.resolve('vitest/package.json')] })
const { createServer } = await import(pathToFileURL(vitePath).href)
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href)
  : await import('playwright')

let server, browser, origin
before(async () => {
  server = await createServer({
    root: '/Users/zdt/Code/dsh/dsh-simplify-theme',
    configFile: false,
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'test-page',
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url !== '/fixture') return next()
          res.setHeader('Content-Type', 'text/html')
          const html = await vite.transformIndexHtml('/fixture', '<!doctype html><html><head></head><body><div id="mount"></div></body></html>')
          res.end(html)
        })
      }
    }]
  })
  await server.listen()
  origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {})
  })
})

after(async () => {
  await browser?.close()
  await server?.close()
})

test('底部栏平铺展示上下文、真实 TPS、缓存命中与耗时，并隐藏原生弹窗胶囊', async (t) => {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.goto(`${origin}/fixture`)

  await page.evaluate(async () => {
    await import('/tests/client/dock-stats-fixture.mjs')
    const { React, ReactDOM, UI_CSS, createDockStats } = window.testFixture

    const style = document.createElement('style')
    style.textContent = `
      :root {
        --dsw-alias-bg-base: #fff;
        --dsw-alias-bg-layer-2: #fff;
        --dsw-alias-border-l1: rgba(0, 0, 0, 0.08);
        --dsw-alias-border-l2: rgba(0, 0, 0, 0.12);
        --dsw-alias-label-primary: #0f1115;
        --dsw-alias-label-secondary: #4b5563;
        --dsw-alias-label-tertiary: #6b7280;
        --dsw-alias-state-error-primary: #dc2626;
        --dsw-alias-state-success-primary: #16a34a;
        --dsw-alias-state-business-primary: #2563eb;
        --dsw-alias-interactive-bg-hover: rgba(0, 0, 0, 0.05);
        --dsw-radius-md: 8px;
        --dsw-radius-lg: 12px;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #f9fafb;
        height: 100vh;
      }
      #mount {
        position: fixed;
        bottom: 24px;
        left: calc(50% - 380px);
        width: 760px;
        max-width: calc(100vw - 32px);
      }
      ${UI_CSS}
    `
    document.head.append(style)

    // 模拟 DSH 真实底部 DOM 结构：原生 [data-composer-dock] 内含原生胶囊和上下文环
    const mount = document.getElementById('mount')
    mount.innerHTML = `
      <div data-composer-seat>
        <div data-composer-dock>
          <div data-dsh-simplify-dock>
            <div data-dsh-simplify-dock-left><button id="btn-model">GPT-5</button></div>
            <div id="stats-mount"></div>
            <div data-dsh-simplify-dock-right><button id="btn-perm">只读</button></div>
          </div>
          <!-- 原生应被隐藏的状态胶囊 -->
          <span data-composer-stat="activity"><button>4 轮 · 204 token/秒</button></span>
          <span data-composer-stat="usage"><button>24.5k · 缓存命中 82%</button></span>
          <span><button aria-label="上下文 24%"><svg><circle></circle></svg><span>24%</span></button></span>
        </div>
      </div>
      <!-- 最后一轮耗时标记 -->
      <div data-turn-tail><div data-clock="end"><span data-dsh-simplify-duration>4.2 秒</span></div></div>
    `

    // 会话投影模拟数据
    const projections = {
      sessionStats: {
        turns: 9,
        steps: 126,
        decodeTokens: 116532,
        ttftMs: 3704044,
        ttftSteps: 122,
        decodeMs: 570592,
        llmMs: 4291888,
        toolMs: 87811
      },
      tokenUsage: {
        totals: {
          uncachedInputTokens: 133284,
          cacheReadTokens: 23333115,
          cacheWriteTokens: 500169,
          outputTokens: 116862
        }
      },
      contextPressure: {
        pressureTokens: 121055,
        contextWindow: 500000
      }
    }

    const shared = {
      h: React.createElement,
      hooks: React,
      t: (key) => key
    }

    const StatsComponent = createDockStats(shared)
    const root = ReactDOM.createRoot(document.getElementById('stats-mount'))
    root.render(React.createElement(StatsComponent, {
      useProjection: (key) => projections[key]
    }))
  })

  // 1. 原生统计胶囊和上下文环必须被 CSS 完全隐藏 (display: none)
  await page.waitForFunction(() => {
    const act = document.querySelector('[data-composer-stat="activity"]')
    const use = document.querySelector('[data-composer-stat="usage"]')
    const ring = document.querySelector('[data-composer-dock] > span:has(> button > svg)')
    if (!act || !use || !ring) return false
    return getComputedStyle(act).display === 'none' &&
           getComputedStyle(use).display === 'none' &&
           getComputedStyle(ring).display === 'none'
  })

  // 2. 平铺状态栏正确渲染并且内容准确充足（包含轮步、容量、真实TPS、缓存命中、单轮耗时）
  await page.waitForSelector('[data-dsh-simplify-dock-center]')
  await page.screenshot({ path: '/tmp/dock-stats-flat.png' })
  const trigger = page.locator('.dsh-simplify-dock-stats-trigger')
  assert.equal(await trigger.evaluate(el => getComputedStyle(el).fontSize), '12.5px')

  const activityText = await page.locator('.dsh-simplify-stat-item.is-activity').textContent()
  const contextText = await page.locator('.dsh-simplify-stat-item.is-context').textContent()
  const tpsText = await page.locator('.dsh-simplify-stat-item.is-tps').textContent()
  const cacheText = await page.locator('.dsh-simplify-stat-item.is-cache').textContent()
  const durationText = await page.locator('.dsh-simplify-stat-item.is-duration').textContent()

  assert.equal(activityText, '9 轮 · 126 步')
  assert.equal(contextText, '121k / 500k (24%)')
  // 验证上下文颜色提示（<=50% 呈现 good 绿色）
  assert.equal(await page.locator('.dsh-simplify-stat-item.is-context').getAttribute('data-dsh-simplify-pct'), 'good')
  // 验证真实 TPS（包含首字延迟，而非虚高的 204）
  assert.equal(tpsText, '27.2 t/s')
  // 验证缓存命中率
  assert.equal(cacheText, '缓存 99%')
  // 验证单轮耗时
  assert.equal(durationText, '4.2 秒')

  // 3. 点击平铺栏展开结构化看板浮层（Popover）
  assert.equal(await page.locator('[data-dsh-simplify-stats-popover]').count(), 0)
  await trigger.click()
  await page.waitForSelector('[data-dsh-simplify-stats-popover][style*="left"]')
  await page.waitForTimeout(100)
  const popover = page.locator('[data-dsh-simplify-stats-popover]')
  await page.screenshot({ path: '/tmp/dock-stats-popover.png' })

  // 检查看板内容：标题、已用徽标、进度条、真实TPS卡片、Token明细与耗时
  assert.equal(await popover.locator('.dsh-simplify-stats-popover-title').textContent(), '会话用量与性能看板')
  assert.equal(await popover.locator('.dsh-simplify-stats-popover-badge').textContent(), '24% 已用')
  assert.equal(await popover.locator('.dsh-simplify-stats-progress-header strong').textContent(), '121k / 500k')
  assert.match(await popover.locator('.dsh-simplify-stats-card').first().textContent(), /27\.2 t\/s/)

  // 检查明细数据
  const detailText = await popover.locator('.dsh-simplify-stats-detail-list').textContent()
  assert.match(detailText, /未缓存输入 Tokens133,284/)
  assert.match(detailText, /缓存读取 Tokens \(Cache Read\)23,333,115/)
  assert.match(detailText, /累计消耗总 Tokens24,083,430/)

  // 检查会话活动与模型耗时拆解
  const footerText = await popover.locator('.dsh-simplify-stats-footer').textContent()
  assert.match(footerText, /9 轮 · 126 步骤/)
  assert.match(footerText, /模型总耗时/)
  assert.match(footerText, /工具耗时/)

  // 4. 按 Escape 关闭看板浮层
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[data-dsh-simplify-stats-popover]') === null)
})

test('真实会话复杂投影数据（高轮数、大上下文、平铺 tokenUsage）完整渲染', async (t) => {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.goto(`${origin}/fixture`)

  await page.evaluate(async () => {
    await import('/tests/client/dock-stats-fixture.mjs')
    const { React, ReactDOM, UI_CSS, createDockStats } = window.testFixture

    const style = document.createElement('style')
    style.textContent = `
      :root {
        --dsw-alias-bg-base: #fff;
        --dsw-alias-bg-layer-2: #fff;
        --dsw-alias-border-l1: rgba(0, 0, 0, 0.08);
        --dsw-alias-border-l2: rgba(0, 0, 0, 0.12);
        --dsw-alias-label-primary: #0f1115;
        --dsw-alias-label-secondary: #4b5563;
        --dsw-alias-label-tertiary: #6b7280;
        --dsw-alias-state-error-primary: #dc2626;
        --dsw-alias-state-success-primary: #16a34a;
        --dsw-alias-state-business-primary: #2563eb;
        --dsw-alias-interactive-bg-hover: rgba(0, 0, 0, 0.05);
        --dsw-radius-md: 8px;
        --dsw-radius-lg: 12px;
      }
      body {
        margin: 0;
        background: #f9fafb;
        height: 100vh;
      }
      #mount {
        position: fixed;
        bottom: 24px;
        left: calc(50% - 380px);
        width: 760px;
        max-width: calc(100vw - 32px);
      }
      ${UI_CSS}
    `
    document.head.append(style)

    const mount = document.getElementById('mount')
    mount.innerHTML = `
      <div data-composer-seat>
        <div data-composer-dock>
          <div data-dsh-simplify-dock>
            <div data-dsh-simplify-dock-left><button id="btn-model">DeepSeek-V3</button></div>
            <div id="stats-mount"></div>
            <div data-dsh-simplify-dock-right><button id="btn-perm">只读</button></div>
          </div>
        </div>
      </div>
    `

    // 用户真实会话的投影数据（tokenUsage 是宿主返回的平铺结构）
    const projections = {
      sessionStats: {
        turns: 85,
        steps: 1979,
        decodeTokens: 917801,
        ttftMs: 43579887,
        ttftSteps: 1966,
        decodeMs: 10230270,
        llmMs: 53810157,
        toolMs: 5561012
      },
      tokenUsage: {
        uncachedInputTokens: 15425147,
        cacheReadTokens: 559962931,
        cacheWriteTokens: 1482880,
        outputTokens: 917801
      },
      contextPressure: {
        pressureTokens: 573751,
        contextWindow: 1048576
      }
    }

    const shared = {
      h: React.createElement,
      hooks: React,
      t: (key) => key
    }

    const StatsComponent = createDockStats(shared)
    const root = ReactDOM.createRoot(document.getElementById('stats-mount'))
    root.render(React.createElement(StatsComponent, {
      useProjection: (key) => projections[key]
    }))
  })

  await page.waitForSelector('[data-dsh-simplify-dock-center]')
  const trigger = page.locator('.dsh-simplify-dock-stats-trigger')

  // 1. 验证平铺栏各项数据充足完整
  assert.equal(await page.locator('.dsh-simplify-stat-item.is-activity').textContent(), '85 轮 · 1979 步')
  assert.equal(await page.locator('.dsh-simplify-stat-item.is-context').textContent(), '574k / 1M (55%)')
  // 验证上下文颜色提示（55% 呈 warn 橙黄色提醒）
  assert.equal(await page.locator('.dsh-simplify-stat-item.is-context').getAttribute('data-dsh-simplify-pct'), 'warn')
  assert.equal(await page.locator('.dsh-simplify-stat-item.is-tps').textContent(), '17.1 t/s')
  assert.equal(await page.locator('.dsh-simplify-stat-item.is-cache').textContent(), '缓存 97%')
  assert.match(await page.locator('.dsh-simplify-stat-item.is-duration').textContent(), /14 小时 56 分/)

  // 2. 点击展开看板浮层
  await trigger.click()
  await page.waitForSelector('[data-dsh-simplify-stats-popover][style*="left"]')
  await page.screenshot({ path: '/tmp/dock-stats-user-session.png' })
  const popover = page.locator('[data-dsh-simplify-stats-popover]')

  // 检查看板内容
  assert.equal(await popover.locator('.dsh-simplify-stats-popover-title').textContent(), '会话用量与性能看板')
  assert.equal(await popover.locator('.dsh-simplify-stats-popover-badge').textContent(), '55% 已用')
  assert.equal(await popover.locator('.dsh-simplify-stats-progress-header strong').textContent(), '574k / 1M')

  // 检查 4 个卡片均完整渲染
  const cards = popover.locator('.dsh-simplify-stats-card')
  assert.equal(await cards.count(), 4)
  assert.match(await cards.nth(0).textContent(), /17\.1 t\/s/)
  assert.match(await cards.nth(1).textContent(), /97%/)
  assert.match(await cards.nth(2).textContent(), /22\.2s/)
  assert.match(await cards.nth(3).textContent(), /14 小时 56 分/)

  // 检查 Token 详细构成完整展示
  const detailText = await popover.locator('.dsh-simplify-stats-detail-list').textContent()
  assert.match(detailText, /未缓存输入 Tokens15,425,147/)
  assert.match(detailText, /缓存读取 Tokens \(Cache Read\)559,962,931/)
  assert.match(detailText, /缓存写入 Tokens \(Cache Write\)1,482,880/)
  assert.match(detailText, /模型输出 Tokens \(含思考内容\)917,801/)
  assert.match(detailText, /累计消耗总 Tokens577,788,759/)

  // 检查脚注
  const footerText = await popover.locator('.dsh-simplify-stats-footer').textContent()
  assert.match(footerText, /85 轮 · 1979 步骤/)
  assert.match(footerText, /模型总耗时 14 小时 56 分/)
  assert.match(footerText, /工具耗时 1 小时 32 分/)
})
