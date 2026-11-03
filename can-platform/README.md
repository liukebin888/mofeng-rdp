# CAN/CAN FD/CAN XL/LIN 总线测试平台

汽车电子零部件总线自动化测试平台，覆盖 CAN 2.0 / CAN FD / CAN XL / LIN 四种车载总线。

**技术栈**：CANoe 12（执行）+ vTESTstudio（设计）+ CAPL（脚本）+ USB v1（接口）+ VN6501/VH6501（故障注入，M2 引入）。

## 目录结构

```
can-platform/
├── docs/                        # 立项计划 / 测试规范 / 报告模板
│   ├── 01-CAN-Platform-M1-Plan.md    # M1 里程碑计划
│   ├── 02-Bus-Test-Spec-V1.md        # 四协议测试规范 V1
│   └── 03-Report-Template.md         # 报告模板与归档 SOP
├── test-specs/
│   └── smoke-cases.md           # 四协议冒烟用例（M1 交付）
├── toolchain/
│   ├── canoe/README.md          # CANoe 12 工程配置
│   ├── vteststudio/README.md    # vTESTstudio 工程脚手架
│   └── capl/README.md           # CAPL 公共库模板
└── results/
    └── hardware-ledger.md       # 硬件与通道台账
```

## 里程碑（40 周）

- **M1（第 1–8 周）**：环境与工具链打通 + 测试框架基线 —— 四协议冒烟用例 + 测试规范 V1 + 工程脚手架。
- **M2（第 9–24 周）**：一致性/协议符合性/故障注入。
- **M3（第 25–40 周）**：整网集成/自动化/量产回归。

## 当前状态

M1 已立项，文档与脚手架骨架已产出。**首个硬依赖**：USB v1 硬件型号确认（M1 第 1 周闭环）。
