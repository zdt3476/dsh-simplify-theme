import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'tsdown'

const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  name: string
  version: string
  description: string
}

const banner = `/** ${pkg.name} v${pkg.version} — ${pkg.description} */`
/** 注入构建时间：便于确认运行中的到底是哪一版，重启后仍不对时可直接比对。 */
const buildStamp = new Date().toISOString()

export default defineConfig([
  {
    // Host 半：只为让 Loader 有条目，无运行时行为。
    entry: { index: 'src/host/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    // 与 package.json 的 main/types 保持一致：index.js / index.d.ts。
    fixedExtension: false,
    dts: true,
    sourcemap: true,
    clean: true,
    banner: { js: banner },
  },
  {
    // Client 半：DSH 的浏览器插件包格式是 ModuleLoader 注册的 CJS 工厂。
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2024',
    define: { __DSH_SIMPLIFY_BUILD__: JSON.stringify(`${pkg.version}+${buildStamp}`) },
    dts: false,
    sourcemap: true,
    clean: false,
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
