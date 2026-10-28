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
    style.textContent = UI_CSS
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
        decodeTokens: 116532,
        ttftMs: 3704044,
        decodeMs: 570592,
        llmMs: 4291888
      },
      tokenUsage: {
        totals: {
          uncachedInputTokens: 133284,
          cacheReadTokens: 23333115,
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

  // 2. 平铺状态栏正确渲染并且内容准确
  await page.waitForSelector('[data-dsh-simplify-dock-center]')
  const contextText = await page.locator('.dsh-simplify-stat-item.is-context').textContent()
  const tpsText = await page.locator('.dsh-simplify-stat-item.is-tps').textContent()
  const cacheText = await page.locator('.dsh-simplify-stat-item.is-cache').textContent()
  const durationText = await page.locator('.dsh-simplify-stat-item.is-duration').textContent()

  assert.equal(contextText, '121k / 500k (24%)')
  // 验证真实 TPS（包含首字延迟，而非虚高的 204）
  assert.equal(tpsText, '27.2 t/s')
  // 验证缓存命中率
  assert.equal(cacheText, '缓存 99%')
  // 验证单轮耗时
  assert.equal(durationText, '4.2 秒')

  // 3. 验证 Tooltip 包含详细说明
  const tpsTooltip = await page.locator('.dsh-simplify-stat-item.is-tps').getAttribute('title')
  assert.match(tpsTooltip, /端到端生成速率（含首字延迟\/思考等待）/)
  assert.match(tpsTooltip, /总产出: 116,532 tokens/)
})
