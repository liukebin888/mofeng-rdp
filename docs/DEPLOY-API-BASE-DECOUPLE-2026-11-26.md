# 前端 Node / Java 通道环境变量解耦补验（2026-11-26）

> 一句话总结：`PASS_LOCAL_DRILL_ONLY` —— 修复上一轮 `VITE_API_BASE=''` 注入引入的 Java `/api/v1` 连带回归，两个通道拆为独立环境变量；静态三场景 12/12 规则、回退自证 20/20、全六门禁、v4 官方镜像重建与真实浏览器复演全绿，正式演示数据零污染。**AC 判定维持 ⏸ 不翻盘，发布口径仍「内测/演示版」**。

---

## 一、性质定准：这是回归修复，不是新设计决策

2026-11-25 同源链路补验把官方 `deploy/Dockerfile.web` 阶段一改为默认注入 `VITE_API_BASE=''`，使 `repo.ts` 的 `` `${REST_BASE}/api/state` `` 折叠为相对 `/api/state` 命中 nginx 反代。但 `app/src/infra/apiV1.ts` **共用同一变量**作 Java `/api/v1` 基址（默认 `http://127.0.0.1:8088`），注入空串后该通道被连带折叠为相对路径，`/api/v1/*` 会打到 Node 8787 而非 Java 8088（返回 404）。上轮已如实登记为「设计债 / 不宣称打通」。

本轮把它定性为**自身改动引入的连带回归**并修掉：只做变量解耦，让 Java 通道恢复原有默认基址。不改产品方向、不改任何文案/菜单/标题/数字、不触碰外部依赖，属于职责内收尾。上轮「下一步建议 ①」中「是否拆分独立变量」由此落实；而「Java 通道生产化打通」仍属待拍板/外部条件，**本轮未做、不宣称**。

---

## 二、只读摸底：回归影响面（开工前钉死）

| 落点 | 读取变量 | 默认值 | 生产注入 `''` 后 |
|---|---|---|---|
| `app/src/infra/repo.ts:24` | `VITE_API_BASE` | `http://127.0.0.1:8787` | 折叠为相对 `/api`（**预期行为**）|
| `app/src/views/ai/AiChatPanel.vue:185` | `VITE_API_BASE` | `http://127.0.0.1:8787` | 折叠为相对 `/api`（**预期行为**）|
| `app/src/infra/apiV1.ts:30` | `VITE_API_BASE` | `http://127.0.0.1:8088` | 折叠为相对 `/api/v1`（**误伤回归**）|

`API_V1_BASE` 消费方：`apiV1.ts` 内部 `postJson`/`listPlan`、`store/app.ts`、`probeRunner.ts`、`probeMapping.ts`、`ConsistencyProbeView.vue:58,73`（把该基址直接展示；修复后由空串恢复为 `8088`，是修正而非回归）。

现场前置：`main...origin/main = 0 0`、工作区干净、正式数据 sha256 `85af15a8…b4f` / `3727251b…8c5`；用户原有 `…-mofeng-web:latest` / `-server:latest` 两基线镜像保留，8081 空闲。

---

## 三、修复内容（最小解耦，`app/src` 仅 1 文件）

| 文件 | 改动 |
|---|---|
| `app/src/infra/apiV1.ts` | `API_V1_BASE` 改读独立变量 `VITE_API_V1_BASE`（默认 `http://127.0.0.1:8088`），注释说明与 Node 通道刻意解耦的原因与「Java 属内部联调通道、不在此声明打通」 |
| `deploy/Dockerfile.web` | **仅追加** 3 行 2026-11-26 更正注释，声明上一轮「共用变量连带变相对路径」的连带影响已消除；`ARG VITE_API_BASE=` / `ENV` 与既有历史注释**零改写** |
| `repo.ts` / `AiChatPanel.vue` / `ConsistencyProbeView.vue` / `REST-CONTRACT.md` | **零改动**。`docs/REST-CONTRACT.md:484`「复用 `VITE_API_BASE`」为历史描述，按 append-only 不改原句，仅在本报告登记更正索引（与上轮处理 `DEPLOYMENT §8.4` 历史句一致）|

---

## 四、三场景静态实测（真实 vite 构建，非推断）

| 场景 | `VITE_API_BASE` | `VITE_API_V1_BASE` | 8787 | 8088 | 覆盖 host | 主 JS |
|---|---|---|---|---|---|---|
| S0 dev | 未注入 | 未注入 | 1 | 1 | 0 | `index-CC7WV40D.js` |
| **S1 prod** | `''` | 未注入 | **0** | **1** ✅ | 0 | `index-sx90vn81.js` |
| S2 override | `''` | `http://java-probe.invalid:9999` | 0 | 0 | 1 | `index-MVwmWztI.js` |

决定性证据（minified 产物）：

- S0：`Xl=(gh==null?void 0:gh.VITE_API_BASE)??"http://127.0.0.1:8787"`、`v9=(wh==null?void 0:wh.VITE_API_V1_BASE)??"http://127.0.0.1:8088"` —— 两变量独立、各自默认。
- **S1**：`h9=(bh==null?void 0:bh.VITE_API_V1_BASE)??"http://127.0.0.1:8088"` —— Vite 对**未定义**的独立变量保留为 `import.meta.env` 属性访问，`??` 回退生效，Java 基址不再被空串误伤；同时 `VITE_API_BASE` 字面量归 0（Node 通道仍折叠）。
- S2：`m9="http://java-probe.invalid:9999"` —— 独立变量被编译期静态替换，证明 ARG/环境变量真接上、可单独覆盖。

> 这同时反证了上一轮「注入 `/api` 会双前缀」的纠偏正确：`repo.ts` 拼接含 `/api` 后缀，`VITE_API_BASE` 必须是空串。

---

## 五、单一权威判定与回退自证

- `deploy/api-base-verdict.cjs`：纯函数单一权威，三场景共 **12 条规则**（D1~D3 / P1~P5 / O1~O4），含 `isLegacyRegression()` 死样本识别（Node 折叠且 8088 也消失 = 旧共用变量回归）与 `assertAll()` 三场景齐全 + 产物 bytes 不得全同（零差异假阳性护栏）；空/失败/伪造样本一律 fail-closed 抛错。
- `deploy/api-base-probe.cjs`：真实构建采集器，用 `spawnSync(process.execPath, [viteBin, ...])` 精确控制 env、不拼 shell（已实测 Windows 空串 `has:true, val:""`），三场景构建 → `assertAll` → 落盘证据 `PASS_LOCAL_STATIC_ONLY · 12/12`。
- `deploy/api-base-verdict-selftest.cjs`：**20/20 PASS**（5 活 + 6 死 + 7 空/伪造 + 2 变异）。

**自证脚本自身缺陷留痕**：首轮输出逐例 `PASS` 但汇总 `0/20 PASS`，原因是 `record()` 写字段 `ok`、汇总读 `c.pass`（字段名不一致）。已修正并重跑得到 `20/20 PASS`；原始输出未掩盖，属统计 bug 而非判定逻辑问题。

> probe 经 `spawnSync` 与先前 bash 构建产出的三个文件名/计数逐字一致，构成跨实现交叉验证。

---

## 六、全六门禁复核（本轮动了 `app/src`，门禁 4/5 不再跳过）

| 门禁 | 结果 |
|---|---|
| 1 `vue-tsc --noEmit` | ✅ 0 error |
| 2 `vitest run --no-file-parallelism` | ✅ **1862/1862，117 文件** |
| 3 `vite build` | ✅ OK（未注入基线 `index-CC7WV40D.js`）|
| 4 `npm run smoke` | ✅ **104/104，bad=0，errors=0** |
| 5 `npm run e2e` | ✅ **33 PASS / 0 FAIL，0 pageerror** |
| 6 `GET /api/audit`（正式后端只读）| ✅ `chainOk=true count=18 checked=18 brokenAt=null` |

### 隔离铁律与两次 FAIL 留痕（不掩盖）

`app/dist` 未注入构建的 `REST_BASE` 硬编码 `http://127.0.0.1:8787`，而本机 8787 正是承载正式演示数据的后端。若直接跑 preview，前端会向正式后端 `PUT /api/state` 播种造成污染。新增 `deploy/gate-isolated.cjs` 单进程编排做到三重隔离：

1. 用 `VITE_API_BASE=http://127.0.0.1:8788` 单独构建 `gate-dist`（不写 `app/dist`）；
2. 隔离后端 `PORT=8788` + `MOFENG_DATA_DIR=<系统临时>/data`；
3. 隔离 preview `4181` + `SMOKE_BASE`/`E2E_BASE` 指向它，`MOFENG_DATA_DIR` 同步传给 e2e 的 `resetBackendState()`，使其只清临时目录、**绝不误删仓库 `server/data`**。

| 轮次 | 证据 | 结果 |
|---|---|---|
| attempt1 | `.attempt1.json` | ❌ smoke `exit=1`，`104/104` 但 `errors=1`（未定位）|
| attempt2 | `.attempt2.json` | ❌ 补 error 明细后复现：`Failed to load resource: 404 (Not Found)` |
| attempt3（有效）| `DEPLOY-GATE-ISOLATED-2026-11-26.json` | ✅ `PASS_ISOLATED_GATES_4_5_6` |

**根因与处置（不改验收脚本、不放宽判定）**：`server/index.js:613` 规定空卷首次 `GET /api/state` 返回 NOT_FOUND（设计行为），浏览器把该 404 记为 `console.error`，而 `smoke.cjs` 仅排除 favicon；正式后端恒有 state，从无此噪声。attempt3 用真实浏览器做了 **404 URL 定位**（`http://127.0.0.1:8788/api/state`）并**预热对齐基准态**（让应用自己播种，`/api/state` 404→200）后复跑，`smoke.cjs` / `e2e-click.cjs` 判定逻辑一字未改、104 路由判定条件未放宽。隔离目录真实生成 `state-T-1001.json`，证明写入确实落在临时目录。

正式数据 sha256 首尾比对 `unchanged=true`；`app/shots/*.png` 已被 `.gitignore:55` 忽略；编排结束自动 kill 两个子进程，8788/4181 已释放。

---

## 七、v4 官方镜像重建与真实浏览器复演

| 项 | 结果 |
|---|---|
| 镜像 | `mofeng-drill-web:v4` `ff5d444b709d`、`mofeng-drill-server:v4` `6f41d0ac316d`（当前源码多阶段构建）|
| 镜像内静态实测 | `8787=0`、`8088=1`、`VITE_API_V1_BASE 字面量=1`、`VITE_API_BASE 字面量=0`、`/api/state=2`、`index-sx90vn81.js` |
| 字节级交叉验证 | 镜像内主 JS sha256 `f931502178943d918edf5706cf6d7165fc4428216f7570aed93a5525f20333b9` 与**本地 prod 场景产物逐字一致** |
| 与上轮对照 | v3 `5c376f4e4539` / `index-9vWnONnC.js`（共用变量，Java 被误伤）→ v4 `ff5d444b709d` / `index-sx90vn81.js`（独立变量，Java 恢复 8088）|
| 隔离编排 | `DRILL_TAG=v4`，独立 project / 8081 / 独立卷，`GET /api/health 200` |
| 真实 Chromium 取证 | `PASS_LOCAL_DRILL_ONLY`：**17 请求 / 5 个 `/api` / 3 应用自发 / 2 探针 / 0 forbidden / 0 跨源 / core2xx=2 / renderOk / 0 pageerror**；R1~R5 全绿 |
| 请求形态 | `GET /api/health 200 → GET /api/state 404`（隔离空卷，设计行为）`→ PUT /api/state 200`（自动播种）；**零 `8787/8088/api-v1` 请求** |
| 附加路由 | `basic/naming` 生效（`#/basic/naming`，`bodyTextLen=1747`、`rootHtmlLen=125339`）|

结论：**Node 通道同源 `/api` 链路未因本轮解耦回退**，上轮 `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md` 的结论继续成立；本轮另存 11-26 证据，不覆盖上轮。

---

## 八、边界与如实披露（不翻盘）

- Java `/api/v1` 恢复为 `http://127.0.0.1:8088` 属**内部联调基址**；按项目口径生产唯一对外后端仍是 Node 8787。本轮**未验证 Java 通道运行时可用性、未宣称打通**；若生产页面未来真实触发该通道，会跨源直连 8088，是既定口径下的已知边界，不在本轮处置范围。
- 本轮仅做静态三场景 + 镜像静态实测 + Node 通道真实浏览器复演，**未做全业务 DOM 流程、未做 Java 后端联调**。
- 隔离门禁非纯只读取证（隔离卷内应用自动播种）；正式 `server/data` 全程零写入。
- `docs/REST-CONTRACT.md:484`、`deploy/Dockerfile.web` 历史注释均为历史描述，只追加更正、零改写；`DEPLOYMENT §8.6`、`DECISION-LIST §12.7`、上轮两份报告亦仅 append 索引。
- **AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38 在验收矩阵维持 ⏸ 一字未改**；发布口径继续「内测/演示版」；5 项外部依赖（k6 压测、等保密评/国密网关、真实 UAT 签署、生产集群灰度、AI 真实 Key）不变。
- U5 报告「16 组/107」与源码「18 组/104」口径统一仍需用户明确授权，本轮未擅动。

---

## 九、证据文件清单与复跑方式

| 文件 | 说明 |
|---|---|
| `docs/DEPLOY-API-BASE-DECOUPLE-2026-11-26.json` | 三场景真实构建采集 + 12/12 判定（`PASS_LOCAL_STATIC_ONLY`）|
| `docs/DEPLOY-API-BASE-SELFTEST-2026-11-26.json` | 20/20 死活空变异回退自证 |
| `docs/DEPLOY-GATE-ISOLATED-2026-11-26.json` | 隔离门禁 4/5/6 有效证据（含 404 定位与预热）|
| `docs/DEPLOY-GATE-ISOLATED-2026-11-26.attempt1.json` / `.attempt2.json` | 两次 FAIL 原始留痕 |
| `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-26.json` | v4 真实浏览器同源取证 |
| `deploy/api-base-verdict.cjs` / `-selftest.cjs` / `api-base-probe.cjs` | 判定单一权威 / 自证 / 构建采集 |
| `deploy/gate-isolated.cjs` | 隔离门禁编排（单进程自起自清）|

```bash
# 1) 三场景静态构建采集
node deploy/api-base-probe.cjs
# 2) 判定回退自证
node deploy/api-base-verdict-selftest.cjs
# 3) 隔离门禁 4/5/6（自起 8788/4181，结束自动清理）
node deploy/gate-isolated.cjs
# 4) 官方镜像 + 隔离编排 + 浏览器复演
docker build -f deploy/Dockerfile.web -t mofeng-drill-web:v4 .
docker build -f server/Dockerfile -t mofeng-drill-server:v4 ./server
DRILL_TAG=v4 docker compose -p mofeng-drill -f deploy/docker-compose.drill.yml up -d --force-recreate
node deploy/browser-sameorigin.cjs --base http://127.0.0.1:8081 --routes basic/naming --wait 3500 --out <证据路径>
```

---

## 十、结论

✅ 回归已修复且可复现：Node 通道与 Java 通道环境变量解耦，生产注入 `VITE_API_BASE=''` 不再误伤 Java 基址；静态三场景、单一权威判定、20/20 自证、全六门禁、v4 官方镜像与真实浏览器复演形成完整证据链，正式演示数据零污染。

⏸ **但**：Java `/api/v1` 通道生产化处置、U5 报告口径统一与 5 项外部依赖仍需授权/外部条件；验收判定与发布口径维持不翻盘。

**下一步建议（需授权/外部条件，未擅动）**：① Java `/api/v1` 是否纳入生产对外链路（涉及网关反代与认证，需拍板）；② U5 报告口径统一需明确授权；③ 5 项外部依赖仍待外部取证。
