# vTESTstudio 测试单元骨架 — 四协议测试项组织

> 配套 M1 里程碑，M2 一致性/符合性套件的组织基线。
> 把 `docs/02-Bus-Test-Spec-V1.md` 的四协议测试项（CAN 9 / CAN FD 7 / CAN XL 7 / LIN 7）落成可编译的测试单元目录与命名约定。

## 1. 测试单元目录（按协议 + OSI 层）

```
toolchain/vteststudio/
├── BusTest.vteststudio
├── Library/
│   ├── Functions/               # 参数化测试函数（封装 Bus API）
│   ├── Parameters/              # 参数集（波特率/采样点/周期/DUT 型号）
│   └── Types/                   # 自定义类型
├── TestUnits/
│   ├── CAN/
│   │   ├── DLL/                 # 数据链路层：CAN-01~CAN-04、CAN-06
│   │   ├── PHY/                 # 物理层：CAN-05、CAN-07、CAN-09
│   │   └── APP/                 # 应用层：CAN-08
│   ├── CANFD/
│   │   ├── DLL/                 # CFD-01~CFD-04、CFD-06、CFD-07
│   │   └── PHY/                 # CFD-05
│   ├── CANXL/
│   │   ├── DLL/                 # CXL-01~CXL-04、CXL-07
│   │   └── PHY/                 # CXL-05、CXL-06
│   └── LIN/
│       ├── DLL/                 # LIN-01、LIN-05
│       ├── NM/                  # 网络管理：LIN-02、LIN-03、LIN-06
│       ├── DIAG/                # 诊断：LIN-04
│       └── APP/                 # 应用层：LIN-07
└── Reports/templates/
```

## 2. 命名约定（强一致，保证可追溯）

| 对象 | 命名 | 示例 |
|------|------|------|
| 测试单元 | `TC_<协议>_<测试项ID>` | `TC_CAN_CAN-01` |
| 测试函数 | `<动作>_<对象>` | `sendStandardFrame` |
| 参数集 | `PRM_<协议>_<波特率>` | `PRM_CAN_500k` |
| 报告模板 | `RPT_<类型>` | `RPT_Consistency` |

> 铁律：测试单元 ID 必须与 `docs/02-Bus-Test-Spec-V1.md` 测试项 ID **一一对应**，保证「规范 ↔ 实现 ↔ 报告」三处可追溯。

## 3. 测试单元模板（每条测试项的标准骨架）

```
测试单元：TC_CAN_CAN-01（经典 CAN 标准帧收发）
├── 前置（Precondition）
│   ├── 能力探测 probeAndCheck(CAP_CAN)   ← 缺能力 SKIP
│   └── 链路冒烟 linkSmokeCheck()          ← 不通 BLOCK
├── 步骤（Steps）
│   ├── Step 1: 按 DBC 发送周期报文
│   ├── Step 2: 监听并校验 ID/DLC/信号值
│   └── Step 3: 统计丢失率与周期抖动
├── 判据（Verdict）
│   ├── 10 帧全收 + 抖动 ≤ ±10% → PASS
│   └── 注入错误 CRC → 断言 FAIL（回退验证）→ 恢复 → PASS
└── 清理（Cleanup）：busStopTrace + 归档
```

## 4. 能力探测接入范式（每条测试单元头部）

```
// 1. 能力探测
probeAndCheck(所需协议掩码)   → -1 BLOCK / 1 SKIP / 0 继续
// 2. 链路冒烟前置
linkSmokeCheck()              → 不通 BLOCK
// 3. 正式执行（经 Bus API，不感知硬件）
```

## 5. 优先级 → 覆盖策略

| 优先级 | 覆盖目标 | 阶段 |
|--------|----------|------|
| P0 | 100% | M2 |
| P1 | ≥80% | M2 |
| P2 | 边界补充 | M3 |

## 6. M1 落点

M1 只搭此骨架 + 四协议各 1 条冒烟测试单元（★ 标注项）。M2 按测试规范 V1 逐层补齐 P0/P1 测试项。
