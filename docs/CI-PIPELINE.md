# CI 流水线说明（P1）

> 文档编号：MOFENG-RDP-CI-001　｜　版本：v1.0　｜　日期：2026-11-24
> 对应流水线：`.github/workflows/ci.yml`（push/PR 到 main、手动触发）

## 一、目的与边界

把此前「靠脚本人肉跑」的六门禁和安全验收，固化为**代码仓库内可复跑、失败即阻断**的自动化流水线。它是复验报告 §四剩余 7 项中**唯一纯代码可闭环**的一项；其余 5 项（性能压测、等保密评/国密网关、真实 UAT 签署、灰度/回滚演练、AI 真实 Key）仍是外部依赖，CI **不伪造通过**。NFR-017 无障碍取证于 2026-11-24 二次补充后已纳入 CI（`a11y:evidence` 产出证据 + `a11y:keyboard --strict` 真实门禁），但其取证覆盖边界（其余键位 / 读屏器 / 弹窗内控件）仍如实保留，不判 100% 达标。

## 二、触发方式与作业划分

| 触发 | `push` / `pull_request` 到 `main`，或 `workflow_dispatch` 手动 |
|---|---|
| 作业 A · `frontend-gates` | 前端六门禁 + 覆盖率 + Node 安全验收（ubuntu-latest / Node 22 / 30 min 超时） |
| 作业 B · `java-tests` | Java 后端 `mvn test`（ubuntu-latest / JDK21 Temurin / 20 min 超时） |

两个作业并行、互不依赖：Java 测试失败不阻塞前端门禁结论，反之亦然；GitHub 会汇总为整体失败。

## 三、作业 A 步骤（严格顺序，失败即停）

| # | 步骤 | 命令 | 失败含义 |
|---|---|---|---|
| 前置 | 锁定依赖 | `npm ci`（`app/package-lock.json` 缓存） | 依赖不可复现 |
| 1/6 | 类型检查 | `npm run typecheck` | TS 类型错误 |
| 2/6 | 单测 + 覆盖率 | `npm run coverage` | 用例失败 **或覆盖率低于阈值** |
| 3/6 | 生产构建 | `npm run build` | Vite 构建失败 |
| 前置 | 浏览器安装 | `npx playwright-core install chromium --with-deps` | CI 无浏览器则 smoke/e2e 无法运行 |
| 前置 | 隔离后端 + preview | `MOFENG_DATA_DIR=<临时目录>` 起 8787；`npm run preview -- --port 4180` | 服务未就绪即中止 |
| 4/6 | 路由冒烟 | `npm run smoke` | 路由渲染/控制台错误 |
| 5/6 | 端到端交互 | `npm run e2e` | 交互链路失败 |
| 6/6 | 审计链 | `GET /api/audit` → `chainOk===true` | 审计哈希链断裂 |
| 附加 | Node 安全验收 | `test-security` / `test-isolation` / `test-contract` / `test-sms` | fail-closed、隔离、契约同源、短信验证码回归 |
| 附加 | 依赖安全审计 | `npm run audit:check` | 存在**未豁免**生产依赖漏洞 |
| 附加 | AI 验证自证 | `verify-wma.js --self-test` / `--mock` | 验证工具自身失准（真实 Key 仍 ⏸ 外部依赖） |

覆盖率报告通过 `actions/upload-artifact` 上传（`if: always()`，失败也留证据）。

## 四、覆盖率口径与阈值（基于真实基线，非拍脑袋）

实测命令：`npm run coverage`（vitest 2.1.9 + `@vitest/coverage-v8` 2.1.9，V8 provider）。
统计范围：`src/domain/**/*.ts`（纯函数业务规则）+ `src/store/**/*.ts`（状态编排层）。

| 指标 | 实测基线 | CI 阈值 |
|---|---|---|
| Lines | 84.52% | 84% |
| Statements | 84.52% | 84% |
| Functions | 94.72% | 84% |
| Branches | 85.02% | 80% |

- **如实说明**：`src/store/app.ts` 单测覆盖显示 0%——它是 Pinia 编排层，业务逻辑已下沉到 domain（100% 可测），编排正确性由 `smoke`（104 路由）+ `e2e`（33 交互）覆盖，**不重复统计**。阈值按 domain 真实基线设定，任一指标跌破即失败。
- 阈值收紧须以实测提升为前提，禁止直接下调阈值「刷绿」。

## 五、数据隔离（CI 不污染仓库 / 不依赖演示数据）

- 后端以 `MOFENG_DATA_DIR=<mktemp -d>/data` 启动，`server/index.js` 会自动创建该目录；CI 结束后进程 kill，临时目录随 runner 销毁。
- CI **不读、不写**仓库 `server/data/`，也不注入演示数据（1 项目/1 样件/1 试制单/3 采购单）。本地保留的演示数据是开发态资产，与 CI 无关。
- `test-security`/`test-isolation`/`test-contract`/`test-sms` 各自用独立临时目录+空闲端口起 server 实例，互相不干扰，也不碰 8787 主实例。

## 六、npm audit 处置（如实豁免，不吞错）

`npm run audit:check`（`app/scripts/audit-check.cjs`）执行 `npm audit --omit=dev --json`，对每条漏洞核对豁免清单：**有任意未豁免漏洞 → exit 1，CI 失败**。绝不用 `|| true` 吞掉。

当前生产依赖 `xlsx@0.18.5` 有 1 个 high 漏洞包（含 2 条公告），**逐条论证豁免**：

| 公告 | 性质 | 豁免依据 |
|---|---|---|
| `GHSA-4r6h-8v6p-xvw6` | 原型污染（CWE-1321，触发于解析不可信工作簿） | 全量检索确认 `xlsx` 仅用于导出（`exportXlsx.ts` 只用 `book_new`/`aoa_to_sheet`/`writeFile`），从不调用 `XLSX.read`/`readFile`；所有导入入口是 `.csv` 且平台自解析，不经 SheetJS |
| `GHSA-5pgg-2g8v-p4x9` | ReDoS（CWE-1333，触发于解析特制内容） | 读路径不存在；导出在浏览器端执行、数据来自平台内部 state（非攻击者直控），不构成服务端可用性风险 |

补充事实：npm 仓库无修复版（修复版仅发布于 `cdn.sheetjs.com`），当前无可用 npm 升级路径。

**豁免失效条件**：一旦代码引入 `xlsx` 读取/导入（调用 `XLSX.read` 等），两条豁免立即失效，须改用 CDN 修复版或替换库，并同步更新 `audit-check.cjs`。脚本经**变异验证**：移除任一豁免条目即报 FAIL（`exit 1`），非恒真。

## 七、Playwright 浏览器路径（CI 可移植性）

旧脚本硬编码 Windows 路径 `.../chromium-1247/chrome-win64/chrome.exe`，在 Linux CI 直接失效。现由 `app/scripts/browser-path.cjs` 统一解析，优先级：

1. 环境变量 `CHROME_PATH` / `MOFENG_CHROME_PATH`（显式指定优先）
2. `playwright-core` 的 `chromium.executablePath()`（若文件真实存在）
3. 扫描 `~/.cache/ms-playwright`、`~/AppData/Local/ms-playwright`、`~/Library/Caches/ms-playwright` 下所有 `chromium-*`，取版本号最大者

全落空即抛错并提示 `npx playwright install chromium`，**不静默回退硬编码**。`smoke`/`e2e-click`/`probe-consistency`/`probe-e2e`/`qa-ui-check` 五个脚本均已改造；本地实测解析到 1247、CI 由 `install chromium` 提供对应版本。

## 八、本地复跑命令（与 CI 等价）

```bash
# 前端六门禁 + 覆盖率
cd app && npm ci && npm run typecheck && npm run coverage && npm run build
#（另开终端）node server/index.js  +  cd app && npm run preview -- --port 4180
cd app && npm run smoke && npm run e2e && npm run a11y:keyboard -- --strict && npm run a11y:evidence
# 安全与验收
cd .. && node server/test-security.cjs && node server/test-isolation.cjs \
  && node server/test-contract.cjs && node server/test-sms.cjs
cd app && npm run audit:check
cd .. && node server/scripts/verify-wma.js --self-test && node server/scripts/verify-wma.js --mock
# Java
mvn test -pl mofeng-application -am   # JDK21 + Maven 在 PATH
```

## 九、仍为外部依赖（CI 不覆盖，不伪造）

| 项 | 状态 | 取证方式 |
|---|---|---|
| 性能压测 / 5000 并发 / RTO-RPO 演练 | ⏸ | k6 压测报告 + 备份恢复演练记录 |
| 等保三级 / 密评 / 国密 SM2 双证书网关 | ⏸ | 有资质机构测评报告 + 协议套件扫描 |
| 真实 UAT 签署 | ⏸ | 用户方签字记录 |
| 无障碍真实 DOM 取证 | ✅ 机制 + 真实缺陷已闭环（CI 双门禁）；🟡 覆盖边界保留 | `npm run a11y:keyboard -- --strict` + `npm run a11y:evidence` → `docs/A11Y-KEYBOARD.json/.md`、`A11Y-EVIDENCE.json/.md`；标签违规 57→0、动态键盘 7 组 tab + 2 组 input-number 全 PASS，静态 27 项键盘违规为快照口径边界、计数如实保留 |

**NFR-017 取证步骤**（2026-11-24 追加，位于门禁 6/6 之后、停服务之前）：真实 Chromium 遍历 `router/index.ts` 全部静态路由，逐页调用页面自身的 `window.__MOFENG_A11Y__.collect()`（判定与 `domain/accessibility.ts` 同源，脚本不另写一份判定），产出 `docs/A11Y-EVIDENCE.json/.md` 并上传 artifact。脚本披露取样页数 / total>0 页数 / 采样元素数 / 内容变化数 / 违规数，并做「注入已知违规样本 → 必须检出 → 移除后恢复」的变异验证；样本为空或变异验证失败即 `exit 1`。**取证只产出证据、不宣称无障碍达标**，故 CI 不加 `--strict`。
| 灰度 / 回滚演练 | ⏸ | 演练记录 |
| AI 真实 Key / 短信网关凭据 | ⏸ | `verify-wma.js` 真实模式 `realModel:true`（脚本已就绪，缺 Key） |

**发布口径不变**：CI 全绿仅代表「工程门禁自动化 + 可复跑」，当前仍只能宣称**内测/演示版**，不得据此宣称正式生产发布。
