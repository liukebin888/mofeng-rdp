# 四协议冒烟用例 — CAPL 可执行化

> 配套 M1。把 `test-specs/smoke-cases.md` 的四协议冒烟用例转成 CANoe 可加载的 CAPL 测试模块（Test Module）。
> 每条用例接入能力探测 `probeAndCheck` + 链路冒烟 `linkSmokeCheck`，经统一 Bus API，不感知具体硬件。

## 1. 冒烟模块清单

| 测试模块 | 协议 | 对应规范项 | 能力掩码 |
|----------|------|-----------|----------|
| `TC_SMOKE_CAN.can` | CAN 2.0 | CAN-01 标准帧收发 | CAP_CAN |
| `TC_SMOKE_CANFD.can` | CAN FD | CFD-01 FD 帧收发 | CAP_CANFD |
| `TC_SMOKE_CANXL.can` | CAN XL | CXL-01 XL 帧收发 | CAP_CANXL |
| `TC_SMOKE_LIN.can` | LIN | LIN-01 帧头/响应收发 | CAP_LIN |

## 2. 统一冒烟骨架（四模块共用的主流程）

```c
/* includes 公共库 */
#include "lib/Result.can"
#include "capability/probe.can"      /* probeAndCheck + linkSmokeCheck */
#include "adapters/BusApi.can"       /* busCapability / busSend / busReceive */

testcase SmokeTemplate(long requiredMask, char title[])
{
  reportBegin(title);

  /* 1. 能力探测：缺能力 SKIP，驱动未加载 BLOCK */
  int r = probeAndCheck(requiredMask);
  if (r == -1) { reportFail("硬件驱动未加载或未知型号"); testCaseFail(); return; }
  if (r == 1)  { reportWarn("硬件不支持所需协议，SKIP"); testCaseSkipped(); return; }

  /* 2. 链路单帧冒烟前置 */
  if (!linkSmokeCheck()) { reportFail("链路不通，BLOCK"); testCaseFail(); return; }

  /* 3. 正式收发（协议特定，见下） */
}
```

## 3. TC_SMOKE_CAN — 经典 CAN 标准帧收发

```c
testcase TC_SMOKE_CAN()
{
  SmokeTemplate(CAP_CAN, "经典 CAN 标准帧收发");
  /* 发送周期报文（占位：按 DBC 定义 EngineData，周期 10ms） */
  /* 监听 10 帧，校验 ID/DLC/信号值 + 周期抖动 ≤ ±10% */
  /* 回退验证：注入错误 CRC → 断言 FAIL → 恢复 → PASS */
}
```

## 4. TC_SMOKE_CANFD — CAN FD 帧收发

```c
testcase TC_SMOKE_CANFD()
{
  SmokeTemplate(CAP_CANFD, "CAN FD 帧收发（BRS 使能）");
  /* 发送 FD 帧（DLC=64，BRS=1），校验数据域 64 字节 + 切换位 */
  /* 回退验证：BRS 位错 → 断言 FAIL → 恢复 → PASS */
}
```

## 5. TC_SMOKE_CANXL — CAN XL 帧收发（SIC 模式）

```c
testcase TC_SMOKE_CANXL()
{
  SmokeTemplate(CAP_CANXL, "CAN XL 帧收发（SIC 模式）");
  /* 发送 XL 帧（大 DLC，如 2048 字节），校验数据域 + 错误信号禁用 */
  /* ⚠ 若硬件不支持 CAN XL → probeAndCheck 已 SKIP，不会执行到此 */
  /* 回退验证：DLC 编码错 → 断言 FAIL → 恢复 → PASS */
}
```

## 6. TC_SMOKE_LIN — LIN 帧头/响应收发

```c
testcase TC_SMOKE_LIN()
{
  SmokeTemplate(CAP_LIN, "LIN 帧头/响应收发");
  /* 主节点按调度表发帧头，从节点响应，校验校验和 */
  /* ⚠ 冒烟前先用 LIN Diagnostic 面板手动验证 NAD 与链路 */
  /* 回退验证：NAD 不匹配 → 断言无响应 FAIL → 恢复 → PASS */
}
```

## 7. 执行与归档

1. 套件级执行顺序：先 `linkSmokeCheck` 再跑各协议冒烟（链路冒烟结果回填台账）。
2. 保留原始 Trace，命名 `日期_固件版本_测试类型`。
3. 探测到的型号 + 能力回填 `results/hardware-ledger.md`。

## 8. 回退验证纪律（四模块统一）

每条冒烟用例必须能：
- **注入已知违规样本 → 断言 FAIL**（坐实判定有效，非零缺陷假阳性）；
- **放行正确样本 → 断言 PASS**（坐实正常路径）。
