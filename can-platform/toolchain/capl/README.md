# CAPL 公共库模板 — 激励 / 断言 / 结果上报 / 错误注入钩子

> 用于 CANoe 12 测试模块，供四协议冒烟用例与 M2 一致性套件复用。
> 说明：以下为脚手架模板（`.can` / CAPL 片段），落地时按实际数据库（DBC/ARXML/LDF）与通道名替换占位符。

## 1. 库结构约定

```
toolchain/capl/
├── lib/
│   ├── Stimulus.can        # 激励发送（周期/单次/事件）
│   ├── Assert.can          # 收发断言（超时/值/周期抖动）
│   ├── Result.can          # 结果上报（PASS/FAIL/日志/Trace 打点）
│   └── FaultInject.can     # 错误注入钩子（预留 VN6501/VH6501）
├── smoke/
│   ├── Smoke_CAN.can
│   ├── Smoke_CANFD.can
│   ├── Smoke_CANXL.can
│   └── Smoke_LIN.can
└── README.md
```

## 2. 激励库（Stimulus.can）

```c
/* 发送周期报文（按数据库 message 定义） */
void sendCyclic(message m, long periodMs)
{
  m.CycleTime = periodMs;
  output(m);
}

/* 发送单次报文并打 Trace 标记 */
void sendOnce(message m)
{
  write("TX: %s id=0x%X dlc=%d", m.name, m.ID, m.DLC);
  output(m);
}
```

## 3. 断言库（Assert.can）

```c
/* 等待信号满足条件（超时 FAIL） */
int waitSignal(signal s, float expected, long timeoutMs)
{
  long t0 = timeNow();
  while (timeNow() - t0 < timeoutMs)
  {
    if (@s == expected) return 1;   /* PASS */
    testWaitForTimeout(10);
  }
  testStepFail("Timeout waiting signal", s.name);
  return 0;                         /* FAIL */
}

/* 报文周期抖动断言（±10%） */
void assertCycleJitter(message m, long nominalMs)
{
  /* 记录相邻两帧间隔，判定 |Δt - nominal| ≤ 0.1 * nominal */
}
```

## 4. 结果上报库（Result.can）

```c
void reportBegin(char title[])
{
  testCaseTitle("TC", title);
}

void reportPass(char note[]) { testStepPass("PASS", note); }
void reportFail(char note[]) { testStepFail("FAIL", note); }
void reportWarn(char note[]) { testStep("WARN", note); }

/* 统一打点：写入 Trace 便于报告回溯 */
void traceMark(char tag[], char detail[])
{
  write("MARK[%s] %s", tag, detail);
}
```

## 5. 错误注入钩子（FaultInject.can，M2 引入）

```c
/* 预留：CANoe 干扰盒 VN6501/VH6501 位级/报文级错误注入
 * M1 不实现，仅保留接口，M2 接入：
 *   injectBitError()    — 位级错误
 *   injectCrcError()    — CRC 错误
 *   injectStuffError()  — 填充错误
 */
```

## 6. 使用约定

1. **命名规范**：测试模块文件 `TC_<协议>_<测试项ID>.can`，与测试规范 ID 一一对应（如 `TC_CAN_CAN-01.can`）。
2. **回退验证**：每条用例须能注入已知违规样本断言 FAIL，再放行正确样本断言 PASS。
3. **结果归档**：执行后保留 Trace 文件，命名 `日期_固件版本_测试类型`（见报告模板 SOP）。
