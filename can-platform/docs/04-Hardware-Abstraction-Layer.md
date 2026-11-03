# 硬件抽象层（HAL）设计 — 多硬件兼容

> 版本 HAL-0.1 · 2026-11-03 ｜ 配套 M1 里程碑
> 目标：让上层测试用例只面向**统一总线操作接口**，屏蔽 Vector VN1600/VN1630/VN7640 与自研 USB-to-CAN 的硬件差异。

## 1. 设计动机（为什么需要 HAL）

实测硬件清单（需求方拍板）包含四类异构设备，**协议能力边界不一致**：

| 硬件 | CAN 2.0 | CAN FD | CAN XL | LIN | 通道数 | 主机接口 |
|------|:-------:|:------:|:------:|:---:|:------:|----------|
| VN1610/1611 | ✅ | ✅ | ❌ | ✅ | 2 | USB 2.0 |
| VN1630A / VN1630 log | ✅ | ✅ | ❌ | ✅ | 4 | USB 2.0（log 版带 SD 记录） |
| VN1641 | ✅ | ✅ | ✅ | ❌ | 4 | USB3 / 以太网 |
| VN1670 | ✅ | ✅ | ✅ | ✅ | 15 | USB3 / 以太网 |
| VN7640 | ✅ | ✅ | ❌ | ✅ | 多 | USB（FlexRay 侧重） |
| 自研 USB-to-CAN | ✅ | ⚠️ 视固件 | ⚠️ 视固件 | ⚠️ 视固件 | 视型号 | USB |

> ⚠️ 关键结论：**CAN XL 仅 VN1641/VN1670 支持**（且需「错误信号使能/禁用」两种模式）；VN1610/VN1630/VN7640 不支持 CAN XL；VN1641 不支持 LIN。自研 USB-to-CAN 能力取决于固件，须逐台探测。

若测试用例直接绑定具体硬件，会出现「换一块卡就全 FAIL」的假阳性。HAL 的职责是把这种差异收敛到**一处能力矩阵 + 统一接口**。

## 2. 分层架构

```
┌─────────────────────────────────────────────────┐
│  测试用例层（vTESTstudio Test Unit / CAPL TC）      │  只面向协议语义，不感知硬件
├─────────────────────────────────────────────────┤
│  总线操作接口（Bus API）：send / receive / inject  │  统一抽象
│  error / getTrace / setBitTiming / capability()   │
├─────────────────────────────────────────────────┤
│  硬件抽象层 HAL（Hardware Abstraction Layer）       │
│  ├─ 能力探测 CapabilityDetector                    │
│  ├─ 协议能力矩阵 CapabilityMatrix                   │
│  ├─ 设备驱动适配器（每类硬件一个 Adapter）           │
│  │   ├─ Vn16xxAdapter   （Vector 驱动 / CANoe）    │
│  │   ├─ Vn76xxAdapter   （Vector 驱动 / CANoe）    │
│  │   └─ UsbCanAdapter   （自研 DLL/驱动）          │
│  └─ 优雅降级策略 FallbackPolicy                    │
├─────────────────────────────────────────────────┤
│  物理设备：VN1600 / VN1630 / VN7640 / 自研 USB-to-CAN │
└─────────────────────────────────────────────────┘
```

## 3. 统一总线操作接口（Bus API）

上层只依赖以下接口，不感知具体硬件：

```c
/* —— 能力 —— */
long busCapability(int protocol);        // 返回 CAP_CAN / CAP_CANFD / CAP_CANXL / CAP_LIN 位掩码

/* —— 收发 —— */
void busSend(message m);                 // 发送报文（按数据库/原始帧）
long busReceive(message m, long timeoutMs);  // 收帧，超时返回 0

/* —— 位定时 / 采样点 —— */
void busSetBitTiming(int protocol, long baud, int samplePoint);

/* —— 错误注入（M2 引入，Vector 干扰盒 / 自研注入）—— */
long busInjectBitError();                // 位级错误
long busInjectCrcError();                // CRC 错误
long busInjectStuffError();              // 填充错误

/* —— 观测 —— */
void busStartTrace(char path[]);         // 开始记录 Trace
void busStopTrace();                     // 停止并归档
```

> 落地形态：Vector 侧由 CANoe + CAPL 实现；自研 USB-to-CAN 侧由自研 DLL + CAPL 绑定（或 Python 驱动）实现同一套语义。**上层测试用例零改动**。

## 4. 能力探测（CapabilityDetector）

运行期探测当前硬件能力，而非静态假设：

1. 枚举设备 → 识别型号（Vector 驱动返回型号；自研返回固件版本）。
2. 读取协议能力位掩码（上表能力矩阵）。
3. 将「实际能力」与「测试项所需协议」比对：
   - 满足 → 执行；
   - 不满足 → **优雅降级 SKIP**（明确标注「硬件不支持」，非 PASS 非 FAIL）。

**关键纪律**：缺能力必须 SKIP，**严禁假 PASS**（与 mofeng-rdp「杜绝零缺陷假阳性」同源）。

## 5. 优雅降级策略（FallbackPolicy）

| 场景 | 动作 | 结果标记 |
|------|------|----------|
| 硬件不支持某协议（如 VN1630 跑 CAN XL 用例） | 跳过，标注能力缺失 | SKIP |
| 自研 USB-to-CAN 固件不支持 CAN XL FAST | 跳过 FAST，保留 SIC | SKIP（部分） |
| 硬件支持但驱动未加载 | 提示装驱动，阻断套件 | BLOCK（防全 FAIL） |
| 通道占用 / 终端电阻异常 | 阻断 + 台账回填 | BLOCK |

> **冒烟前置铁律**：套件运行前先跑「链路单帧冒烟」，链路不通直接 BLOCK，避免接口卡驱动未加载导致的全量 FAIL。

## 6. 能力矩阵落点

- 静态能力矩阵（上表）→ `results/hardware-ledger.md`（台账）。
- 运行期能力探测结果 → 每次套件执行回填台账 + 报告头。

## 7. M1 落地范围

- [x] HAL 分层架构 + Bus API 定义（本文档）；
- [x] 协议能力矩阵 + 优雅降级策略（本文档）；
- [ ] 各 Adapter 骨架（M1-2 随 CANoe 工程落地 Vector 侧；自研侧随自研 DLL 到位落地）；
- [ ] 能力探测 CAPL/驱动实现（M1-2/M1-3）。

## 8. 依赖与风险

| 项 | 等级 | 说明 |
|----|------|------|
| 自研 USB-to-CAN DLL 接口未定 | 🟡 | Adapter 骨架先留接口，待自研驱动到位补齐 |
| Vector 驱动版本 | 🟡 | CAN XL 需 CANoe 19+；VNpiggy30 IO 需驱动 24.40+ |
| CAN XL 双模式（错误信号使能/禁用） | 🟡 | 仅 VN1641/VN1670，测试配置须区分 |
