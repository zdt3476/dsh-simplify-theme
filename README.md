# dsh-simplify-theme

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的极简主题插件。

它不改语义色、不改字号，只压掉界面里的装饰性噪音：

- 去掉全部投影，浮层只留一圈发丝描边；
- 菜单改成不透明实底，关掉毛玻璃；
- 收紧圆角，并退出 `corner-shape: superellipse`；
- 用户气泡、hover / active 改成中性灰，不再被品牌色染色；
- 代码块改用贴近画布的中性底。

亮色、暗色、跟随系统都会自动生效，因为插件是在当前配色之上叠一层
token，而不是新增一个独立主题。

## 为什么用 token 层而不是主题 id

DSH 的 `ctx.theme.register()` 可以注册第三方主题 id，但 Appearance 设置
只列 `light` / `dark` / `system` 三个内置项，注册的 id 没有选择入口，也
无法跟随系统配色。

本项目改用 `ctx.theme.overrideTokens(source, tokens)`：每个 token 给出
`{ light, dark }` 一对值，由 ui-theme 按当前配色选值，再经 ui-layout
写到 `body` 上。未覆盖的 token 全部继承内置值，因此 DSH 升级新增 token
时不需要跟进。

## 安装

插件包必须构建出 `lib/index.js`、`lib/client.js` 后才能被加载。

```sh
pnpm install
pnpm build
```

以本地 link 方式装进当前 profile（示例为 Desktop 使用的 `desktop`）：

```sh
dsh plugin --profile desktop add link:"$PWD"
```

也可以从 GUI 的 **Plugins** 页面安装本地目录。安装后重启 DSH；若 profile
启用了 HMR，插件管理操作会自动生效。

## 关闭与卸载

- 临时关闭：Plugins 页面禁用 `dsh-simplify-theme`，token 层被移除后界面
  立即还原。
- 彻底卸载：`dsh plugin --profile desktop remove dsh-simplify-theme`。

插件不写任何用户偏好，禁用或卸载都不会留下需要清理的设置。

## 开发

```sh
pnpm test        # typecheck + vitest
pnpm build       # 产出 lib/index.js（Host）与 lib/client.js（Client）
pnpm check       # 上面两步
```

项目结构与 [dsh-metrics](https://github.com/zdt3476/dsh-metrics) 保持一致：

| 路径 | 作用 |
| --- | --- |
| `src/host/index.ts` | 空 Host 插件，只为让 Loader 有条目并下发 `dsh.client` |
| `src/client/index.ts` | Client 入口，激活时注册 token 层，卸载时移除 |
| `src/client/tokens.ts` | 主题的唯一事实源，所有覆盖值都在这里 |
| `cordis.patch.yml` | bundle patch，插入 `simplify-theme` 条目 |
| `tests/` | token 形状与入口注册行为的单元测试 |

Client 半由 tsdown 打成 CJS，并用 `window.__ModuleLoader__.load({...})`
包成 DSH 浏览器插件包；不需要手写 bundle。

### 调整主题

只改 `src/client/tokens.ts`，然后 `pnpm build` 并重启（或等 HMR 重载）。
新增覆盖时注意：

- key 必须是 `--dsw-*`；值必须是 `{ light, dark }` 而不是裸字符串，否则
  用户切换配色后会直接不可读；
- 优先用语义 alias（如 `--dsw-alias-*`、`--dsw-specific-*`），不要直接
  改静态色板 `--dsw-static-*`；
- 能用现有 alias 引用表达的就引用（`var(--dsw-...)`），别复制色值。

## 已知限制

- 主题只做 token 覆盖，不改组件结构；某个组件写死了颜色或阴影时它不会被
  影响。
- 没有 Appearance 里的独立入口，这受 DSH 当前设置 schema 限制。
- 未覆盖的 token 保持内置值，因此这不是一套完整的第三方配色，而是叠在
  内置亮暗主题上的皮肤。

## License

MIT
