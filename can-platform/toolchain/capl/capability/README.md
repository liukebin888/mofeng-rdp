# 能力探测 CAPL 实现 — 运行期协议能力探测与优雅降级

> 配套 HAL 设计。运行期探测当前硬件协议能力，与测试项所需协议比对，缺能力 SKIP、驱动未加载 BLOCK。

## 1. 能力位掩码（与 adapters 同源）

```c
#define CAP_CAN    0x01
#define CAP_CANFD  0x02
#define CAP_CANXL  0x04
#define CAP_LIN    0x08
```

## 2. 型号 → 能力映射（唯一权威表，勿散落各处硬编码）

```c
/* 返回某型号的协议能力位掩码；未知型号返回 0（触发 BLOCK） */
long capabilityOfModel(char model[])
{
  if (strstr(model, "VN1641") == model)  return CAP_CAN | CAP_CANFD | CAP_CANXL;            /* 无 LIN */
  if (strstr(model, "VN1670") == model)  return CAP_CAN | CAP_CANFD | CAP_CANXL | CAP_LIN;  /* 全协议 */
  if (strstr(model, "VN161")  == model)  return CAP_CAN | CAP_CANFD | CAP_LIN;              /* 无 CAN XL */
  if (strstr(model, "VN1630") == model)  return CAP_CAN | CAP_CANFD | CAP_LIN;              /* 无 CAN XL */
  if (strstr(model, "VN7640") == model)  return CAP_CAN | CAP_CANFD | CAP_LIN;              /* 无 CAN XL */
  if (strstr(model, "USB")    == model)  return usbCanCapability();                          /* 自研：视固件 */
  return 0;                                 /* 未知型号 → BLOCK */
}
```

## 3. 能力探测主流程

```c
/* 探测结果：-1=BLOCK（驱动未加载/未知型号） 0=能力满足 1=SKIP（能力不足） */
int probeAndCheck(long requiredMask)
{
  char model[64];
  long cap = 0;

  /* 1. 枚举设备型号 */
  if (!GetHardwareConfig(model, 64))   /* 占位：Vector 驱动枚举 / 自研 DLL 查询 */
  {
    testStepFail("BLOCK", "未检测到硬件或驱动未加载，请检查接口卡驱动");
    return -1;                          /* BLOCK：防全量 FAIL */
  }

  /* 2. 型号 → 能力 */
  cap = capabilityOfModel(model);
  if (cap == 0)
  {
    testStepFail("BLOCK", "未知硬件型号，无法判定协议能力");
    return -1;
  }

  /* 3. 能力满足性比对 */
  if ((cap & requiredMask) == requiredMask)
  {
    testStepPass("CAP", "硬件支持所需协议，能力满足");
    return 0;
  }

  /* 4. 缺能力 → SKIP（非 PASS 非 FAIL） */
  testStep("SKIP", "硬件不支持所需协议（能力掩码 0x%X，需要 0x%X）", cap, requiredMask);
  return 1;
}
```

## 4. 链路单帧冒烟前置检查（铁律）

```c
/* 套件运行前必跑：发一帧标准报文确认链路通，不通直接 BLOCK，防接口卡驱动未加载全 FAIL */
int linkSmokeCheck()
{
  message m;   /* 占位：一帧最小标准报文 */
  long t0 = timeNow();
  output(m);
  /* 简单判定：有无总线活动 / 回环收到（占位，具体按通道回环或 DUT 响应实现） */
  testStep("LINK", "链路单帧冒烟完成");
  return 1;
}
```

## 5. 用例接入范式（上层测试单元调用）

```c
testcase TC_CAN_CAN01()
{
  /* 1. 能力探测 */
  int r = probeAndCheck(CAP_CAN);
  if (r == -1) { testStepFail("BLOCK", "..."); testCaseFail(); return; }
  if (r == 1)  { testStep("SKIP", "..."); testCaseSkipped(); return; }   /* 缺能力 SKIP，非 PASS 非 FAIL */

  /* 2. 链路冒烟前置 */
  if (!linkSmokeCheck()) { testStepFail("BLOCK", "..."); testCaseFail(); return; }

  /* 3. 正常执行（经 Bus API，不感知硬件） */
  busSend(/*...*/);
  if (busReceive(/*...*/, 1000)) testStepPass("PASS", "...");
  else testStepFail("FAIL", "...");
}
```

## 6. 降级策略对照（与 HAL 设计一致）

| 场景 | probeAndCheck 返回 | 结果 |
|------|-------------------|------|
| 驱动未加载 / 未检测到硬件 | -1 | BLOCK |
| 未知型号 | -1 | BLOCK |
| 能力满足 | 0 | 执行 |
| 能力不足 | 1 | SKIP |

## 7. 关键纪律

1. **SKIP ≠ PASS ≠ FAIL**：能力不足必须标记 SKIP，严禁假 PASS（与 mofeng-rdp 杜绝零缺陷假阳性同源）。
2. **能力表唯一权威**：`capabilityOfModel` 是型号→能力唯一映射点，禁止在用例内散落判断。
3. **链路冒烟前置**：每套件必跑 `linkSmokeCheck`，链路不通 BLOCK 阻断，避免接口卡驱动未加载导致全 FAIL。
4. **探测结果回填台账**：每次执行把探测到的型号 + 能力回填 `results/hardware-ledger.md`。
