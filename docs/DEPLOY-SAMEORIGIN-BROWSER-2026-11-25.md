# 前端 VITE_API_BASE 生产注入与浏览器同源 /api 链路补验报告（2026-11-25）

> **一句话结论**：✅ `PASS_LOCAL_DRILL_ONLY` —— 官方前端镜像注入空字符串后，真实 Chromium 的应用自发 `/api` 请求全部同源命中 nginx 反代，零 `127.0.0.1:8787/8088` 直连；判定规则 **12/12 回退自证**、门禁 1/2/3/6 复核通过、正式演示数据 sha256 零污染。**验收判定维持 ⏸ 不翻盘，发布口径继续「内测 / 演示版」**。

---

## 一、补验起因：消除上轮登记的唯一链路缺口

`docs/DECISION-LIST.md §12.6` 与 `docs/DEPLOYMENT.md §8.5` 在完成「当前源码前端镜像复演」后，如实登记了剩余边界：

> 前端 `REST_BASE` 仍硬编码 `http://127.0.0.1:8787`（官方 `Dockerfile.web` 未注入 `VITE_API_BASE`）；本演练仅验证静态资源版本代表性，**未验证浏览器相对路径 `/api` 链路**。

这是一个真实的生产缺陷：浏览器在用户侧访问的是 `http://127.0.0.1:8787`（用户自己的机器），而后端只在容器内网 `mofeng-server:8787` 可达，因此未注入的前端镜像在真实部署中根本连不上后端。本轮即为补齐该缺口。

用户指令为「按建议下一步」，取上一轮建议中的「前端 `VITE_API_BASE` 生产注入 / 浏览器相对 `/api` 链路验证」。U5 报告口径统一（需授权）、k6 性能压测、等保密评/国密网关、真实 UAT、生产集群灰度一律不碰。

---

## 二、只读核查先行：纠正上一轮建议的技术错误

开工前先只读核查，未直接改代码，结果推翻了上一轮自己给出的方案。

| 文件 | 关键事实 | 影响 |
|---|---|---|
| `app/src/infra/repo.ts` | `REST_BASE = env.VITE_API_BASE ?? 'http://127.0.0.1:8787'`；请求为 `` fetch(`${REST_BASE}/api/state`) `` | 注入 `/api` → `/api/api/state` **双前缀（错误）**；注入 `''` → 相对 `/api/state`（正确） |
| `app/src/views/ai/AiChatPanel.vue` | 第二处 `REST_BASE`，同样读取 `VITE_API_BASE` | 同步受注入影响，压缩后 `yh=Xl` 复用 |
| `app/src/infra/apiV1.ts` | `API_V1_BASE = env.VITE_API_BASE ?? 'http://127.0.0.1:8088'`，**共用同一变量** | 注入 `''` 后 Java `/api/v1` 亦变相对路径（连带影响，见 §九） |
| `app/vite.config.ts` | `server: { port: 5178, host: '127.0.0.1', strictPort: true }`，**无 dev proxy** | 本地 dev 注入 `''` 会失效；故注入只能发生在 Docker 生产构建，本地 dev 保持 8787 直连 |
| `deploy/nginx.conf.template` | `location /api/ { proxy_pass http://mofeng-server:8787; }`（无尾斜杠，原样转发） | `/api/state` → `http://mofeng-server:8787/api/state`，链路闭合 |

**纠偏结论**：上一轮写的「注入 `VITE_API_BASE=/api`」是错的，正确值是**空字符串 `''`**。该纠偏由 AI 主动自检发现，用户未介入。

---

## 三、编译期折叠证据：空字符串注入可行性实测

用 `VITE_API_BASE= npx vite build --outDir .probe-api-dist`（临时目录，不碰 `app/dist`；核验后已用系统级删除清理，工作区零残留）与主 JS 逐字比对：

| 项 | 未注入基线 `app/dist` | 注入 `VITE_API_BASE=` |
|---|---|---|
| 主 JS | `index-BGV6B8Cf.js` | `index-9vWnONnC.js` |
| `REST_BASE` 折叠 | `Xl=(gh==null?void 0:gh.VITE_API_BASE)??"http://127.0.0.1:8787"` | `Xl=""` |
| AiChatPanel 复用 | — | `yh=Xl` |
| `API_V1_BASE` 折叠 | `v9=(wh==null?void 0:wh.VITE_API_BASE)??"http://127.0.0.1:8088"` | `m9=""` |
| 主 JS 中 `8787` / `8088` 计数 | 1 / 1 | **0 / 0** |
| `/api/state` 字面量 | `` `${Xl}/api/state` `` | `` `${Xl}/api/state` ``（2 处，模板字符串，故按 `"/api/state"` 精确 grep 无输出） |

> 关键点：`??` 只对 `null/undefined` 回退，空字符串被保留；Vite 在编译期把 `import.meta.env.VITE_API_BASE` 替换为 `""`，minifier 再把 `"" ?? 'http://…'` 整条 fallback 折叠消掉，因此产物中硬编码彻底消失。

**ARG 覆盖活样本**（证明 `ARG` 真实接上，而非把值写死）：注入 `VITE_API_BASE=http://arg-probe.invalid:9999` 后产物为 `index-DC-vs-qF.js`，`Xl="http://arg-probe.invalid:9999"`（`override_host_count=2`，含共用变量），`8787/8088` 归零。产物输出到系统临时目录，git 工作区零污染。

---

## 四、Dockerfile.web 最小改动（前端源码零改动）

仅 `deploy/Dockerfile.web` 阶段一新增 8 行注释 + 2 行指令，放在 `RUN npm run build` 前：

```dockerfile
ARG VITE_API_BASE=
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build
```

语义与边界（已写入文件注释）：

- 生产镜像默认注入空字符串 → 相对 `/api/*` 命中 nginx 反代；
- 本地 dev 不经过该 Dockerfile → 保持 `127.0.0.1:8787` 直连；
- 可用 `--build-arg VITE_API_BASE=http://<host>:8787` 覆盖为绝对地址（§三 活样本已验证）；
- `apiV1.ts` 共用变量，Java `/api/v1` 连带变相对路径，按项目口径属内部联调通道，**不验证、不宣称打通**。

`app/src/**` 零改动，故本轮不涉及品牌名、菜单、路由、文案变更。

---

## 五、镜像构建与静态实测

| 镜像 | ID | 说明 |
|---|---|---|
| `mofeng-drill-web:v3` | `5c376f4e4539` | 官方 `Dockerfile.web` 从当前源码构建，默认空注入 |
| `mofeng-drill-server:v2` | `2b95f28ec93b` | 当前源码 `server/Dockerfile`（含 `security.js` COPY 修复） |
| `mofeng-drill-server:v3` | `2b95f28ec93b` | 与上同 ID 的配套 tag（compose 用同一 `DRILL_TAG`） |

**镜像内静态实测**（`docker run --entrypoint sh`，直接读 nginx 托管目录）：

| 检查项 | 结果 |
|---|---|
| `127.0.0.1:8787` 计数 | **0** |
| `127.0.0.1:8088` 计数 | **0** |
| `Xl=""` 折叠 | 1 处 |
| `m9=""` 折叠 | 1 处 |
| `index.html` 主 JS | `assets/index-9vWnONnC.js` |
| `/api/state` 字面量 | 2 处 |

对照：本地未注入基线 `app/dist/assets/index-BGV6B8Cf.js` 中 `8787` / `8088` 各 1 处。上轮 v2 前端为 `index-BGV6B8Cf.js`（未注入），本轮 v3 为 `index-9vWnONnC.js`（注入），同源源码、不同注入，指纹真实不同。

---

## 六、判定单一权威与 12/12 回退自证

新增 `deploy/sameorigin-verdict.cjs` 为**唯一权威纯函数**（zero DOM / zero browser，可 node 直调），取证脚本与 selftest 同源 `require`，符合规格治理「判定逻辑 + 控制点评估两处同源」。

| 检查 | 类型 | 判据 |
|---|---|---|
| R1 | 阻断 | 总请求 / API 请求 / **应用自发** API 请求均 > 0（空样本 fail-closed） |
| R2 | 阻断 | 页面真实渲染（DOM 实测，不得硬编码 true） |
| R3 | 阻断 | 零 `127.0.0.1:8787/8788/8088` 绝对直连 |
| R4 | 阻断 | 所有 `/api` 请求与页面同源 |
| R5 | 阻断 | 应用自发核心 API（`/api/health` 或 `/api/state`）真实 2xx |
| 记录型 | 不阻断 | `pageErrors`、网关探针结果如实披露，不得隐藏 |

`deploy/sameorigin-verdict-selftest.cjs` **12/12 PASS**，含：活样本、空样本、仅静态资源、8787 直连、8088 直连、跨源、核心 API 全 404、页面未渲染、**仅探针请求不得伪造应用链路**、记录型 pageErrors 不阻断、pageUrl 非法、**变异活样本（`/api/state` 改指 8787）**。证据：`docs/DEPLOY-SAMEORIGIN-SELFTEST-2026-11-25.json`。

---

## 七、隔离编排与真实浏览器取证

编排保持 `deploy/docker-compose.drill.yml` 的隔离铁律：独立 project `mofeng-drill`、独立容器名、独立命名卷 `mofeng-drill_drill-data`、独立 bridge 网络、宿主机 **8081**（不占用 5178 / 8787 / 8080）。

前置 curl 验证：`GET /api/health → 200`、`GET /api/audit → 200`、`GET /api/state → 404`。后者经只读核查为**设计行为**（`server/index.js:613`：「该租户尚无已保存状态，首次请由前端播种后 PUT」），空卷未播种时返回 `NOT_FOUND`，非链路缺陷。

真实浏览器：`app/scripts/browser-path.cjs` 解析到本机 `chromium-1247`，`playwright-core` 从 `app/node_modules` 加载；headless Chromium 真实加载页面，采集全部网络请求（应用自发 `source=app` 与脚本注入的只读网关探针 `source=probe` 严格分离）。

### 失败留痕（不掩盖）

- **attempt1**：`--routes '/#/basic/naming'` 被 Git Bash(MSYS) 路径转换成 `C:/Program Files/.../PortableGit/#/basic/naming`，`page.goto` 报 `Cannot navigate to invalid URL`，`routeResults.ok=false`。原始 JSON 完整保留为 `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.attempt1.json`。
- **修复**：脚本内部规范化路由（`BASE + '/#/' + clean`，拒绝前导 `/` 外部参数），并修正 collect-only 模式 SUMMARY 不再打印易被误读为「已判定通过」的 `ok/reason`。
- **重跑**：干净卷重建后，`routeResults.ok=true`、最终 URL `#/basic/naming`、页面内容 `bodyTextLen 547→1747` / `rootHtmlLen 87935→125307`，请求数 15→17，判定全绿。

---

## 八、关键结果（正式证据 `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.json`）

| 指标 | 值 |
|---|---|
| `verdict` | ✅ `PASS_LOCAL_DRILL_ONLY` |
| `requestCount` | 17 |
| `apiRequestCount` / `appApiRequestCount` / `probeApiRequestCount` | 5 / 3 / 2 |
| `forbiddenHitCount`（8787/8788/8088 直连） | **0** |
| `crossOriginApiCount` | **0** |
| `core2xxCount` | 2 |
| `renderOk` | true |
| `pageErrorCount` | **0** |
| 页面渲染 | `title=魔程化解`、`bodyTextLen=1747`、`rootHtmlLen=125307`、`url=#/basic/naming` |

**应用自发 `/api` 请求逐条（全部同源 `http://127.0.0.1:8081`）**：

| # | source | 请求 | 状态 | 说明 |
|---|---|---|---|---|
| 1 | app | `GET /api/health` | 200 | 健康检查，反代可达 |
| 2 | app | `GET /api/state` | 404 | 空卷未播种，`server/index.js:613` 设计行为 |
| 3 | app | `PUT /api/state` | 200 | **应用经 nginx 反代自动播种**，写链路亦打通 |
| 4 | probe | `GET /api/health?__sameorigin_probe=1` | 200 | 网关探针，只 GET |
| 5 | probe | `GET /api/state?__sameorigin_probe=1` | 200 | 返回完整 state |

零 `127.0.0.1:8787` / `8088` 直连，零 `/api/v1` 运行时请求，零 pageerror。

---

## 九、如实披露与未覆盖边界（不翻盘）

| # | 边界 | 说明 |
|---|---|---|
| 1 | **Java `/api/v1` 连带影响** | `apiV1.ts` 共用 `VITE_API_BASE`，注入 `''` 后 `m9=""`，静态产物佐证其变相对路径；本编排 nginx 把 `/api/*` 统一反代到 Node 8787，该通道会 404。本次零 `/api/v1` 运行时请求，**未验证、不宣称 Java 通道打通**，登记为设计债；生产对外唯一后端仍按 Node 8787 口径 |
| 2 | **未做未注入版真实浏览器反向对照** | 未注入版 `REST_BASE` 硬编码 `127.0.0.1:8787`，用真实浏览器打开会直连**正式后端**并可能污染演示数据，故主动放弃；改以「静态产物折叠证据 + selftest 死样本（用例 04/05）」替代，不伪造反向对照 |
| 3 | **非纯只读取证** | 应用在**隔离卷**内自动 `PUT /api/state` 播种（200），演练卷与正式 `server/data` 零接触；正式数据 sha256 前后一致，见 §十 |
| 4 | 链路覆盖范围 | 仅验证首页 + 默认工作台 + 命名规则页的 Node `/api` 链路，**未做全业务 DOM 流程 / 真实 UAT** |
| 5 | 生产条件未覆盖 | 真实网关注入 `MOFENG_API_TOKEN`、CORS 白名单、HTTPS/国密 TLS、多节点、k6 压测、灾备 RTO 均属外部依赖 |
| 6 | **验收判定** | `AC-22.1 / AC-40 / AC-45 / AC-03 / AC-38` 在 `docs/ACCEPTANCE-MATRIX.md` 中**维持 ⏸ 一字未改**；5 项外部依赖不变；发布口径继续「内测 / 演示版」 |

---

## 十、门禁复核与零污染核验

| 门禁 | 结果 |
|---|---|
| 1 `npx vue-tsc --noEmit` | ✅ exit 0，0 error |
| 2 `npx vitest run --no-file-parallelism` | ✅ **1862/1862 PASS，117 文件** |
| 3 `npx vite build` | ✅ 成功，产物 `index-BGV6B8Cf.js`（本地 dev 不注入，符合预期） |
| 4 `npm run smoke` / 5 `npm run e2e` | ⏸ **本轮未重跑**：本轮 `app/src` 零改动，且 smoke/e2e 需隔离 preview 与 `MOFENG_DATA_DIR`；上轮 QA #9 已 159 PASS / 0 FAIL，如实披露不冒充本轮实测 |
| 6 `GET /api/audit` | ✅ `ok=true`、`chainOk=true`、`count=18`、`checked=18`、`brokenAt=null`，**非空链** |

**正式演示数据零污染**（sha256 前置/复核逐字一致）：

```
85af15a8c8e8a92fd5985303072116a53cf5f66d99c44d160a689af1759a3b4f  server/data/state-T-1001.json
3727251ba41fa006609f2b9ce6fb3dd5925d84dd0026402dfc39b066b7cb85c5  server/data/audit-T-1001.json
```

---

## 十一、文件清单与复跑方式

**修改**：`deploy/Dockerfile.web`（阶段一 ARG/ENV + 注释）

**新增脚本**：
- `deploy/sameorigin-verdict.cjs`（判定单一权威）
- `deploy/sameorigin-verdict-selftest.cjs`（12 例回退自证）
- `deploy/browser-sameorigin.cjs`（真实浏览器采集，支持 `--collect-only`）

**新增证据/报告**：
- `docs/DEPLOY-SAMEORIGIN-SELFTEST-2026-11-25.json`
- `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.json`（正式，PASS）
- `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.attempt1.json`（失败留痕）
- `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.md`（本报告）

**append 索引、历史零改写**：`docs/DEPLOYMENT.md §8.6`、`docs/DECISION-LIST.md §12.7`、`docs/DEPLOY-ROLLBACK-DRILL-WEB-2026-11-25.md §十一`

```bash
# 1) 判定规则回退自证
node deploy/sameorigin-verdict-selftest.cjs

# 2) 构建注入版前端镜像 + 配套后端
docker build -f deploy/Dockerfile.web -t mofeng-drill-web:v3 .
docker build -f server/Dockerfile -t mofeng-drill-server:v2 ./server
docker tag mofeng-drill-server:v2 mofeng-drill-server:v3

# 3) 隔离编排（独立 project / 8081 / 独立卷）
DRILL_TAG=v3 docker compose -p mofeng-drill -f deploy/docker-compose.drill.yml up -d --force-recreate

# 4) 真实浏览器取证（附加路由传不带前导 '/' 的 hash 片段）
node deploy/browser-sameorigin.cjs --base http://127.0.0.1:8081 \
     --routes basic/naming --wait 3500 \
     --out docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-25.json

# 5) 清理（仅演练 project，不碰正式数据）
DRILL_TAG=v3 docker compose -p mofeng-drill -f deploy/docker-compose.drill.yml down -v
```

---

## 十二、结论

| 项 | 结论 |
|---|---|
| 上轮登记缺口 | ✅ 已补齐：浏览器相对 `/api` 同源链路经真实 Chromium 取证 |
| 上轮建议纠错 | ✅ 主动发现 `/api` 双前缀错误，修正为空字符串注入 |
| 注入可行性 | ✅ 编译期折叠 + 镜像内静态实测 + ARG 覆盖活样本，三层证据 |
| 判定规则 | ✅ 单一权威 + **12/12** 死/活/空/变异回退自证 |
| 真实取证 | ✅ `PASS_LOCAL_DRILL_ONLY`，17 请求 / 0 forbidden / 0 跨源 / 0 pageerror |
| 门禁与零污染 | ✅ 门禁 1/2/3/6 通过；正式 `server/data` sha256 零改动 |
| 失败留痕 | ✅ attempt1 路径转换缺陷原始 JSON 保留，修复后重跑 |
| 历史证据 | ✅ 上轮报告 / §8.4 / §12.5 文字数字一字未改，全部 append 索引 |
| **验收判定** | ⏸ **维持外部依赖，不翻盘** |
| **发布口径** | ⏸ 继续「内测 / 演示版」，5 项外部依赖不变 |

**下一步建议（仍需授权/外部条件，不擅动）**：① Java `/api/v1` 通道设计债的正式处置口径（是否拆分独立变量）；② U5 报告「16 组/107」与源码「18 组/104」口径统一需用户明确授权；③ k6 性能压测、等保密评/国密网关、真实 UAT 签署、生产集群灰度、AI 真实 Key 仍为 5 项外部依赖。

## 十三、后续补验索引（2026-11-26，① 的处置结果）

上文「下一步建议 ①」中「是否拆分独立变量」已按「修复自身引入的回归」落实，本处仅追加索引，既有 §一~§十二 文字、数字与结论零改写。

- `app/src/infra/apiV1.ts` 改读独立 `VITE_API_V1_BASE`（默认 8088）；`repo.ts` / `AiChatPanel.vue` / `Dockerfile.web` 的注入逻辑零改动，因此**本报告的同源 `/api` 链路结论继续成立**。
- v4 官方镜像重建后真实浏览器复演 `PASS_LOCAL_DRILL_ONLY`（17 请求 / 0 forbidden / 0 跨源 / 0 pageerror / 零 `8787·8088·api-v1` 请求），另存 `docs/DEPLOY-SAMEORIGIN-BROWSER-2026-11-26.json`，不覆盖本报告证据。
- 全六门禁复核通过（含隔离门禁 4/5/6 的 attempt1/attempt2 FAIL 留痕）；正式 `server/data` sha256 零污染。
- 详见 `docs/DEPLOY-API-BASE-DECOUPLE-2026-11-26.md`。
- **仍未处置**：Java `/api/v1` 通道是否纳入生产对外链路（涉及网关反代与认证）需拍板，本轮不验证、不宣称打通；②③ 两项不变。验收判定与发布口径仍维持 ⏸，不翻盘。
