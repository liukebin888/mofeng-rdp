# 文件传递协议（规格精简版）

> 规格编号：FTP-001（精简）
> 完整协议见 `docs/FILE-TRANSFER-PROTOCOL.md`。
> 本文件仅收录规格化要点，供 SRS / 技术方案引用。

## 1. 目的

定义研发管理系统与 OTS 认可归档（附件 A/B/C）之间的文件传递约定，支持三条路径：
**全量投递（FULL）/ 引用投递（REF）/ 混合（MIXED）**，元数据与文件本体解耦。

## 2. 核心契约

| 项 | 约定 |
|---|---|
| 协议标识 | `MOFENG-RDP-FTP`，版本 `1.0` |
| 投递载体 | SFTP / 共享目录 |
| 目录结构 | `<ROOT>/<tenantId>/<projectId>/<batchId>/{manifest.json, files/, <batchId>.done/.error}` |
| 幂等键 | `batchId`（UUID v4） |
| 清单文件 | `manifest.json`（元数据 + SHA-256 + 来源 + SM2 签名） |
| 信号文件 | `.done` 成功 / `.error` 失败回滚 |
| 原子性 | 批次级，任一文件校验失败整批回滚 |

## 3. 清单条目字段（权威）

`fileKey` / `archiveCode` / `name` / `center` / `deliverableId` / `deliverableName` /
`approval{approved, instanceId, approvedAt}` / `mode(FULL|REF)` / `relativePath` /
`sha256` / `size` / `mimeType` / `refUrl` / `credentialId`。

## 4. 与 OTS 归档路径映射

| OTS 路径 | 协议判定 |
|---|---|
| 手工填写（manual） | `mode=REF` 或未绑定审批链，仅元数据供核对 |
| 系统自动传递（auto） | `approval.approved=true` 且 `deliverableName` 命中 → 自动「已归档」 |

接收端必须复用 `resolveItemArchived`，禁止自造判定。

## 5. 安全

SHA-256 完整性；SM2 签名（等保）；`tenantId`/`projectId` 越权校验；`batchId` 幂等；全流程审计留痕。

## 6. 验收要点

1. 接收端对 `*.done` 清单逐条校验 SHA-256 与 size，不符即 `.error` 回滚。
2. 同 `batchId` 重复投递幂等跳过。
3. 越权（tenant/project 不匹配）拒绝并告警。
4. 自动传递条目按 `approval.approved` + `deliverableName` 命中实时解算，与 `resolveArchiveTable` 输出一致。
