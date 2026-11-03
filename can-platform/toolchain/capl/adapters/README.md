# 硬件 Adapter 骨架 — Bus API 统一实现

> 配套 HAL 设计（`docs/04-Hardware-Abstraction-Layer.md`）。
> 三个 Adapter 统一实现 Bus API，上层测试用例只依赖 Bus API，不感知具体硬件。
> 说明：以下为 CAPL 骨架模板，落地时替换占位符（通道名 / DLL 名 / 固件能力探测函数）。

## 1. 统一能力位掩码（Capability Bitmask）

```c
/* 协议能力位（可组合） */
#define CAP_CAN    0x01   /* 经典 CAN 2.0 */
#define CAP_CANFD  0x02   /* CAN FD */
#define CAP_CANXL  0x04   /* CAN XL */
#define CAP_LIN    0x08   /* LIN */
```

## 2. Adapter 基类（BusApi.can，定义统一接口签名）

```c
/* —— 所有 Adapter 必须实现的统一接口 —— */
long busCapability();                       /* 返回协议能力位掩码 */
void busSend(message m);                    /* 发送报文 */
long busReceive(message m, long timeoutMs); /* 收帧，超时返回 0 */
void busSetBitTiming(long protocol, long baud, int samplePoint);
long busInjectBitError();                   /* M2 引入，M1 预留返回 0 */
long busInjectCrcError();
long busInjectStuffError();
void busStartTrace(char path[]);
void busStopTrace();
```

## 3. Vn16xxAdapter（VN1600/1611/1630 系列）

```c
/* 能力：CAN + CAN FD + LIN（无 CAN XL） */
long busCapability()
{
  /* 型号差异：VN1610/1611/VN1630A/VN1630log 均无 CAN XL */
  return CAP_CAN | CAP_CANFD | CAP_LIN;
}

void busSend(message m)
{
  m.CycleTime = 0;
  output(m);   /* Vector 驱动直接输出到绑定通道 */
}

long busReceive(message m, long timeoutMs)
{
  long t0 = timeNow();
  while (timeNow() - t0 < timeoutMs)
  {
    if (this.dlc >= 0)   /* 已收到帧 */
    {
      m = this;
      return 1;
    }
    testWaitForTimeout(10);
  }
  return 0;
}
```

## 4. Vn76xxAdapter（VN7640，底盘控制侧重）

```c
/* 能力：CAN + CAN FD + LIN（无 CAN XL，FlexRay 侧重但不在本平台范围） */
long busCapability()
{
  return CAP_CAN | CAP_CANFD | CAP_LIN;
}

void busSend(message m)
{
  output(m);
}
```

## 5. UsbCanAdapter（自研 USB-to-CAN）

```c
/* 能力：取决于固件，须运行期探测。此处调用自研 DLL 的能力查询接口。 */
/* 占位：dllUsbCanCapability() 由自研驱动提供，返回位掩码 */
long busCapability()
{
  /* 自研侧：CAPL 绑定自研 DLL，或由 Python 驱动层回填 */
  return dllUsbCanCapability();   /* 待自研 DLL 到位后实现 */
}

void busSend(message m)
{
  /* 自研侧发送：经自研 DLL 下发原始帧 */
  dllUsbCanSend(m.ID, m.DLC, m.byte(0), /*...*/);
}
```

## 6. 能力矩阵对照（静态参考，运行期以探测为准）

| Adapter | 硬件 | CAP_CAN | CAP_CANFD | CAP_CANXL | CAP_LIN |
|---------|------|:-------:|:---------:|:---------:|:-------:|
| Vn16xxAdapter | VN1610/1611/1630 | ✅ | ✅ | ❌ | ✅ |
| Vn76xxAdapter | VN7640 | ✅ | ✅ | ❌ | ✅ |
| UsbCanAdapter | 自研 USB-to-CAN | ✅ | ⚠️视固件 | ⚠️视固件 | ⚠️视固件 |

> 注：VN1641/VN1670（支持 CAN XL）另归入 Vn16xxAdapter 的高配分支，能力探测返回 `CAP_CAN|CAP_CANFD|CAP_CANXL|CAP_LIN`（VN1641 无 LIN，须按型号细分）。落地时以 `GetHardwareConfig()` 返回的实际型号为准，勿硬编码。

## 7. 落地约定

1. **型号识别**：用 `GetHardwareConfig()` / 驱动枚举返回的型号字符串，映射到能力位掩码，禁止静态假设。
2. **缺能力 SKIP**：上层用例 `busCapability()` 不满足所需协议 → 返回 SKIP（非 PASS 非 FAIL）。
3. **自研侧待定**：UsbCanAdapter 的能力查询依赖自研 DLL，接口签名已预留，DLL 到位后补齐。
