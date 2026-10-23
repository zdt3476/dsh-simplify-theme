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

## 效果对照

左为内置外观，右为启用本插件后（同一页面、同一缩放）：

| 内置外观 | 极简主题 |
| --- | --- |
| ![启用前：菜单](docs/images/before-menu.png) | ![启用后：菜单](docs/images/after-menu.png) |
| ![启用前：设置](docs/images/before-settings.png) | ![启用后：设置](docs/images/after-settings.png) |

最容易观察到的三处差异：菜单从半透明模糊变成不透明白底、浮层投影消失、
设置面板圆角从 28px 收到 20px。

## 功能增强

除配色皮肤外，插件还带三组交互增强：

**侧栏归档分页** — 「工作区」标题下方提供两页 tab（未归档 / 已归档），点击写回 DSH 原生的 `archivedFilter` 视图状态。

**工作区快速筛选** — 使用固定高度的输入行替代原生搜索和视图过滤按钮，旁边保留工作区 / 目录树 / 全部会话分组选择，写回原生分组状态。输入框对已渲染的会话/工作区行做 type-to-filter；命中会话时保留其工作区组头，命中工作区时保留组头本身，Escape 清空筛选。

**输入框下方控件条** — 模型、思考等级、权限三颗控件移到输入框下方的
dock 行（与上下文用量同一行），输入框内只留附件、模式和发送：

- 模型与思考等级各自独立展开；思考等级入口始终可见，展开后是带填充轨道的滑块（标题行显示当前档位、刻度标出全部档位），拖动预览、释放提交；供应商未声明默认档位时保留「供应商默认」，无可调档位时说明不可用；
- 模型列表按供应商分组（DeepSeek 账号/官方优先），每供应商一列，供应商过多时自动换行、面板在视口内滚动；
- 选中的模型显示 `供应商 / 模型名` 前缀；
- 权限控件与内置选择器同源（同一 catalog RPC、同一 `/permission`
  提交通道），完全权限/自动审查保留两步确认；
- 入口按业界选择器做法加了强调：浅底 + 发丝边、品牌色圆点、展开时品牌色描边；权限按风险着色（只读绿、工作区蓝、完全权限红、自动审查橙）。

dock 行里的百分比统计按数值上色：缓存命中越高越绿、上下文占用越高越红，中间区间为橙色；环形进度的描边与数字同色。

新建会话与普通会话使用相同的下方控件布局：模型和思考等级在卡片左下、权限在右下；原生 tps、Token 用量和上下文统计全部保留在中间。模型/思考弹层沿卡片左缘展开，权限弹层沿右缘展开，均受视口边界约束。

工作区列表提供本地置顶菜单、可见会话数量徽标和超出 5 个工作区的折叠入口。置顶组优先，其余按当前分页内会话的最近活跃时间降序排列；没有可用会话时采用工作区创建时间。默认保留最近活跃的 5 个普通工作区，置顶不占额度，筛选时暂时展开隐藏组。徽标表示当前已渲染的会话数量，不代表全部历史数量。置顶和折叠偏好只存当前浏览器 localStorage。

| 侧栏分页 | 快速筛选 |
| --- | --- |
| ![侧栏归档分页](docs/images/sidebar-tabs.png) | ![工作区筛选](docs/images/sidebar-filter.png) |
| **dock 控件条** | **权限弹层** |
| ![dock 控件条](docs/images/dock-controls.png) | ![权限弹层](docs/images/permission-popup.png) |

已知限制：侧栏 tabs/筛选走 DOM 注入（WorkspaceBrowser 未暴露列表上方
slot），DSH 大版本更新可能需要跟进选择器；dock 弹层是自绘而非
MenuSurface，键盘导航由 Escape/外点关闭兜底。

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

配色覆盖不修改内置外观偏好；归档 tab 使用原生视图状态，置顶和折叠偏好保存在浏览器 localStorage。插件自带中英文字典，宿主未解析某个键时会用内置文案兜底并在控制台告警一次，避免界面出现内部键名。禁用时移除界面改动，保留这些偏好以便再次启用。

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
