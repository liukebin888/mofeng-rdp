# 文件传递协议（研发管理系统 ↔ OTS 归档）

> 文档编号：MOFENG-RDP-FTP-001
> 日期：2026-11-09
> 定位：定义「研发管理系统」与「OTS 认可归档（附件 A/B/C）」之间的文件传递协议，覆盖 SFTP / 文件目录投递约定。
> 关联：`docs/REST-CONTRACT.md`（元数据接口）、《OTS 认可引擎》（`app/src/domain/otsApproval.ts` 附件 A 归档两条路径）。
> 原则：**元数据与文件本体解耦**——元数据走 JSON 清单（含校验和、来源、签名），文件本体按「目录投递 + 信号文件」落地，支持「仅元数据 + 引用」模式（文件本体保留在原系统，通过 URL / 凭证引用）。

---

## 1. 协议总览

```
┌─────────────────────┐         SFTP / 共享目录          ┌─────────────────────┐
│   研发管理系统       │ ──────────────────────────────▶ │   OTS 归档接收端     │
│  (交付物/审批链)     │   目录投递 + checksum + .done   │  (附件 A/B/C 汇总)   │
└─────────────────────┘                                 └─────────────────────┘
```

三要素：

| 要素 | 说明 |
|---|---|
| **投递目录** | 约定根目录 + 项目子目录 + 批次目录，物理落地文件 |
| **清单文件** | `manifest.json`：元数据 + 校验和 + 来源 + 签名（本协议权威结构） |
| **信号文件** | `.done` 落地即触发接收端入账；`.error` 触发回滚与告警 |

### 1.1 三种传递模式

| 模式 | 文件本体 | 元数据 | 适用场景 |
|---|---|---|---|
| **全量投递**（`FULL`） | 随清单物理投递到目录 | JSON 内嵌文件相对路径 | 附件 A 设计文件、DV 试验报告等需本地留存的归档件 |
| **引用投递**（`REF`） | 保留在原系统，不入目录 | JSON 内嵌 `refUrl` + `credentialId` | 「仅元数据 + 引用」，避免大文件重复搬迁 |
| **混合**（`MIXED`） | 部分全量、部分引用 | 逐文件标注 `mode` | 附件 A 三条目可混合（手工 + 自动 + 引用） |

---

## 2. 目录结构约定

```
<ROOT>/                          # 协议根目录（可配置，默认 /data/ftp/mofeng-rdp）
└── <tenantId>/                  # 租户隔离（与 TEN-004 一致）
    └── <projectId>/             # 项目维度
        └── <batchId>/           # 一次传递 = 一个批次（幂等 + 原子）
            ├── manifest.json    # 清单（元数据 + 校验和 + 签名）
            ├── files/           # 文件本体（仅 FULL/MIXED 模式）
            │   ├── <fileKey1>
            │   └── <fileKey2>
            ├── <batchId>.done   # 成功信号（清单校验 + 校验和全对后写入）
            └── <batchId>.error  # 失败信号（校验失败 / 部分缺件）
```

- `batchId`：UUID v4，一次传递唯一，保证**幂等**（重复投递同 `batchId` 不重复入账）。
- `tenantId` / `projectId`：与平台租户、项目标识一致，**接收端校验归属**，防越权投递。

---

## 3. 清单文件 `manifest.json`（权威结构）

```json
{
  "protocol": "MOFENG-RDP-FTP",
  "version": "1.0",
  "batchId": "9f8c3d2a-...",
  "tenantId": "tenant-001",
  "projectId": "PRJ-2026-001",
  "source": {
    "system": "研发管理系统",
    "systemVersion": "4.0",
    "operator": "liu.zong",
    "operatorName": "留总",
    "transferredAt": "2026-11-09T22:14:19+08:00"
  },
  "target": {
    "attachment": "A",
    "attachmentLabel": "附件 A《设计文件归档汇总表》"
  },
  "mode": "MIXED",
  "items": [
    {
      "fileKey": "A-1/ELEC-01",
      "archiveCode": "ELEC-01",
      "name": "原理图",
      "center": "电子研发中心",
      "deliverableId": "DEL-ELEC-01",
      "deliverableName": "原理图",
      "approval": {
        "approved": true,
        "instanceId": "FLOW-8821",
        "approvedAt": "2026-11-08T10:00:00+08:00"
      },
      "mode": "FULL",
      "relativePath": "files/A-1/ELEC-01/sch.pdf",
      "sha256": "e3b0c442...",
      "size": 2048000,
      "mimeType": "application/pdf"
    },
    {
      "fileKey": "A-1/ELEC-03",
      "archiveCode": "ELEC-03",
      "name": "电子 E-BOM 表",
      "center": "电子研发中心",
      "deliverableId": "DEL-ELEC-03",
      "deliverableName": "电子 E-BOM 表",
      "approval": { "approved": false, "note": "审批链进行中" },
      "mode": "REF",
      "refUrl": "https://rdm.example.com/files/DEL-ELEC-03",
      "credentialId": "cred-bom-001",
      "sha256": null,
      "size": 0
    }
  ],
  "signature": {
    "algorithm": "SM2",
    "value": "MEUCIQD...",
    "certId": "ca-gm-001"
  }
}
```

### 3.1 字段字典

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `protocol` | string | 是 | 固定 `MOFENG-RDP-FTP` |
| `version` | string | 是 | 协议版本，当前 `1.0` |
| `batchId` | string | 是 | 批次 UUID v4（幂等键） |
| `tenantId` | string | 是 | 租户标识（接收端校验归属） |
| `projectId` | string | 是 | 项目标识 |
| `source.system` | string | 是 | 来源系统名 |
| `source.operator` | string | 是 | 操作人账号 |
| `source.transferredAt` | string | 是 | 传递时间 ISO 8601 |
| `target.attachment` | enum | 是 | `A` / `B` / `C` |
| `mode` | enum | 是 | `FULL` / `REF` / `MIXED` |
| `items[]` | array | 是 | 逐文件条目（见 3.2） |
| `signature` | object | 否 | 国密 SM2 签名（等保/完整性） |

### 3.2 文件条目 `items[]` 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `fileKey` | string | 是 | 接收端唯一键（`<中心>/<归档编码>`） |
| `archiveCode` | string | 是 | 归档条目编码（如 `ELEC-01`，对齐 `otsApproval.ts`） |
| `name` | string | 是 | 文件/交付物名称 |
| `center` | enum | 是 | 附件 A 中心：`电子研发中心` / `结构研发中心` / `工艺技术中心` |
| `deliverableId` | string | 否 | 研发管理系统交付物 id（对齐 `Deliverable.id`） |
| `deliverableName` | string | 否 | 交付物名称（自动传递绑定的 `deliverableName`） |
| `approval.approved` | bool | 是 | 交付物审批链是否已完成（自动归档依据） |
| `approval.instanceId` | string | 否 | 完成审批的流程实例 id |
| `approval.approvedAt` | string | 否 | 审批完成时间 |
| `mode` | enum | 是 | 本条 `FULL` / `REF` |
| `relativePath` | string | FULL 必填 | 相对 `files/` 的物理路径 |
| `sha256` | string | FULL 必填 | 文件 SHA-256 校验和 |
| `size` | number | 是 | 文件字节数（REF 为 0） |
| `mimeType` | string | 否 | MIME 类型 |
| `refUrl` | string | REF 必填 | 引用投递的文件访问 URL |
| `credentialId` | string | REF 必填 | 访问凭证 id（接收端凭此取用） |

---

## 4. 传递流程（发送端 → 接收端）

### 4.1 发送端（研发管理系统）

1. 生成 `batchId`，创建 `<ROOT>/<tenantId>/<projectId>/<batchId>/` 目录。
2. 写入 `files/` 下所有 FULL 模式文件，计算 SHA-256。
3. 生成 `manifest.json`（含校验和 + 来源 + 可选 SM2 签名）。
4. 原子写入 `manifest.json`，再写 `<batchId>.done`（**清单 + 全部文件校验和通过后方可写**）。

### 4.2 接收端（OTS 归档）

1. 轮询 / inotify 监听 `*.done` 信号。
2. 读 `manifest.json`，校验：`protocol`/`version` 匹配、`tenantId`/`projectId` 归属合法。
3. 逐条校验 FULL 文件的 SHA-256 与 `size`，任一不符 → 写 `<batchId>.error`，**整批回滚**。
4. 校验通过 → 入账：
   - 附件 A 自动归档条目（`source='auto'` 且 `approval.approved=true`）→ 触发 `resolveItemArchived` 自动判定已归档（归档人「系统」）；
   - 手工条目 / 引用条目 → 落清单，供标准化管理员核对。
5. 幂等：同 `batchId` 重复入账直接跳过。

### 4.3 失败与回滚

| 场景 | 动作 |
|---|---|
| 清单字段缺/非法 | 写 `.error`，不入账，告警 |
| 校验和不符 / 缺件 | 写 `.error`，整批回滚（原子） |
| `batchId` 重复 | 幂等跳过，不重复入账 |
| 越权投递（tenant/project 不匹配） | 拒绝 + 告警（安全） |

---

## 5. 与 OTS 归档两条路径的映射

> 对应 `app/src/domain/otsApproval.ts` 的 `resolveItemArchived` / `resolveArchiveTable`。

| OTS 归档路径 | 协议映射 |
|---|---|
| **手工填写**（`source='manual'`） | 清单条目 `mode='REF'` 或未绑定审批链，仅提供元数据供标准化管理员核对勾选 |
| **系统自动传递**（`source='auto'`） | 清单条目 `approval.approved=true` 且 `deliverableName` 命中 → 自动判定「已归档」，归档人「系统」 |

判定一致性（单一权威）：

```
resolveItemArchived(item, providedNames)
  = item.source === 'auto'
      && item.deliverableName 非空
      && providedNames.has(item.deliverableName)
  其中 providedNames = { 交付物 required=true 且审批链 approved 的 name }
```

协议清单的 `approval.approved` 即对应审批链 `deliverableProvidedEvidence` 的 `APPROVED` 态；
`deliverableName` 即 `Deliverable.name`。**接收端必须复用 `resolveItemArchived`，禁止自造判定**。

---

## 6. 安全与完整性

| 项 | 约定 |
|---|---|
| 完整性 | FULL 文件 SHA-256；清单可选 SM2 签名（等保要求） |
| 幂等 | `batchId` 唯一键，重复投递不重复入账 |
| 越权 | `tenantId` / `projectId` 接收端强制校验归属 |
| 原子性 | 批次级：任一文件校验失败整批回滚 |
| 审计 | 每次入账记录 `transferredAt` / `operator` / `batchId`，可追溯 |

---

## 7. 附录：附件 A 归档条目 ↔ 交付物绑定（默认清单）

> 对应 `DEFAULT_DESIGN_ARCHIVE`（15 项），`archiveCode` 即 `otsApproval.ts` 的 `code`。

| 中心 | archiveCode | 名称 | 默认 source |
|---|---|---|---|
| 电子研发中心 | ELEC-01 | 原理图 | manual |
| 电子研发中心 | ELEC-02 | PCB 图 | manual |
| 电子研发中心 | ELEC-03 | 电子 E-BOM 表 | manual |
| 电子研发中心 | ELEC-04 | 硬件设计概要 | manual |
| 电子研发中心 | ELEC-05 | 硬件设计说明 | manual |
| 电子研发中心 | ELEC-06 | 软件设计概要（含软件架构图） | manual |
| 电子研发中心 | ELEC-07 | 软件详细设计概要 | manual |
| 电子研发中心 | ELEC-08 | 产品出厂检验规范 | manual |
| 电子研发中心 | ELEC-09 | 电子 D-FMEA | manual |
| 电子研发中心 | ELEC-10 | 外购外协件认可报告汇总表 | manual |
| 结构研发中心 | STRU-01 | 2D 图存档 | manual |
| 结构研发中心 | STRU-02 | 结构 E-BOM | manual |
| 工艺技术中心 | PROC-01 | 过程计划 | manual |
| 工艺技术中心 | PROC-02 | P-FMEA | manual |
| 工艺技术中心 | PROC-03 | 作业指导书 | manual |

> 条目可由标准化管理员切换为 `auto` 并绑定交付物 `deliverableName`，此后按协议自动传递归档。
