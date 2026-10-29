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
          if (req.url === '/favicon.ico') { res.statusCode = 204; res.end(); return }
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

test('插件设置页完整渲染5大模块与10项配置开关，支持即时切换与持久化', async (t) => {
  const page = await browser.newPage()
  t.after(() => page.close())
  await page.goto(`${origin}/fixture`)

  await page.evaluate(async () => {
    await import('/tests/client/dock-stats-fixture.mjs')
    const { React, ReactDOM, UI_CSS, createPluginSettings } = window.testFixture

    const style = document.createElement('style')
    style.textContent = `
      :root {
        --dsw-alias-bg-base: #f9fafb;
        --dsw-alias-bg-layer-2: #ffffff;
        --dsw-alias-border-l1: rgba(0, 0, 0, 0.08);
        --dsw-alias-border-l2: rgba(0, 0, 0, 0.15);
        --dsw-alias-label-primary: #0f1115;
        --dsw-alias-label-secondary: #4b5563;
        --dsw-alias-label-tertiary: #6b7280;
        --dsw-alias-state-success-primary: #16a34a;
        --dsw-alias-state-success-subtle: rgba(22, 163, 74, 0.12);
        --dsw-alias-state-business-primary: #2563eb;
        --dsw-alias-interactive-bg-hover: rgba(0, 0, 0, 0.04);
        --dsw-alias-interactive-bg-subtle: rgba(0, 0, 0, 0.015);
        --dsw-radius-lg: 12px;
        --dsw-radius-md: 8px;
        --dsw-radius-sm: 4px;
      }
      body {
        margin: 0;
        padding: 32px;
        background: #f9fafb;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      #mount {
        max-width: 680px;
        margin: 0 auto;
      }
      ${UI_CSS}
    `
    document.head.append(style)

    const shared = {
      h: React.createElement,
      hooks: React,
      t: (k) => k
    }

    const SettingsComponent = createPluginSettings(shared)
    const root = ReactDOM.createRoot(document.getElementById('mount'))
    root.render(React.createElement(SettingsComponent, {}))
  })

  await page.waitForSelector('[data-dsh-simplify-settings]')
  await page.screenshot({ path: '/tmp/plugin-settings.png' })

  // 1. 验证标题与分组结构
  const title = await page.locator('.dsh-simplify-settings-title').textContent()
  assert.equal(title, '极简主题与增强功能配置')

  const groups = page.locator('.dsh-simplify-settings-card')
  assert.equal(await groups.count(), 5)

  // 验证各分组标题
  const groupTitles = await page.locator('.dsh-simplify-settings-group-title').allTextContents()
  assert.deepEqual(groupTitles, [
    '底栏用量与性能看板',
    '子代理协同派发图',
    '侧栏界面增强',
    '输入框与交互控件',
    '主题风格层级'
  ])

  // 2. 验证10个功能开关与2个数值步进器（共12项设置）
  const switches = page.locator('.dsh-simplify-switch')
  assert.equal(await switches.count(), 10)
  assert.equal(await switches.nth(0).getAttribute('data-active'), 'true')
  assert.equal(await switches.nth(3).getAttribute('data-active'), 'false') // delegationExpandedDefault

  const steppers = page.locator('.dsh-simplify-stepper')
  assert.equal(await steppers.count(), 2)

  // 验证初始数值显示
  const pinnedStepper = page.locator('[data-dsh-simplify-stepper="sidebarPinnedLimit"]')
  const unpinnedStepper = page.locator('[data-dsh-simplify-stepper="sidebarUnpinnedLimit"]')
  assert.equal(await pinnedStepper.locator('.dsh-simplify-stepper-val').textContent(), '5 个')
  assert.equal(await unpinnedStepper.locator('.dsh-simplify-stepper-val').textContent(), '5 个')

  // 3. 点击切换开关
  await switches.nth(0).click() // 关闭 dockStats
  assert.equal(await switches.nth(0).getAttribute('data-active'), 'false')

  // 点击步进器调整数值
  await pinnedStepper.locator('.is-inc').click() // 5 -> 6
  assert.equal(await pinnedStepper.locator('.dsh-simplify-stepper-val').textContent(), '6 个')

  await unpinnedStepper.locator('.is-dec').click() // 5 -> 4
  assert.equal(await unpinnedStepper.locator('.dsh-simplify-stepper-val').textContent(), '4 个')

  // 验证保存提示短提示
  await page.waitForSelector('.dsh-simplify-settings-notice')
  assert.equal(await page.locator('.dsh-simplify-settings-notice').textContent(), '✓ 设置已更新并即时生效')

  // 验证 localStorage 持久化内容
  const storedConfig = await page.evaluate(() => JSON.parse(localStorage.getItem('dsh.simplify-theme.config')))
  assert.equal(storedConfig.dockStats, false)
  assert.equal(storedConfig.sidebarPinnedLimit, 6)
  assert.equal(storedConfig.sidebarUnpinnedLimit, 4)

  // 4. 点击恢复全部默认设置
  await page.locator('.dsh-simplify-settings-reset-btn').click()
  await page.waitForFunction(() => {
    const sw = document.querySelectorAll('.dsh-simplify-switch')
    return sw[0]?.getAttribute('data-active') === 'true'
  })
  assert.equal(await switches.nth(0).getAttribute('data-active'), 'true')
  assert.equal(await pinnedStepper.locator('.dsh-simplify-stepper-val').textContent(), '5 个')
  assert.equal(await unpinnedStepper.locator('.dsh-simplify-stepper-val').textContent(), '5 个')
})
