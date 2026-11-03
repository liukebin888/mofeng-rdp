# vTESTstudio 测试工程脚手架说明

> 配套 M1 里程碑。测试设计在 vTESTstudio 完成（状态机图/测试表格），编译导出到 CANoe 执行。

## 1. 工程目录结构（建议）

```
toolchain/vteststudio/
├── BusTest.vteststudio          # 测试工程根
├── Library/
│   ├── Functions/               # 参数化测试函数（封装底层总线交互）
│   ├── Parameters/              # 参数集（DUT 型号/波特率/采样点/周期）
│   └── Types/                   # 自定义类型（Test Step 状态等）
├── TestUnits/
│   ├── CAN/                     # CAN 测试单元（按测试规范 ID 组织）
│   ├── CANFD/
│   ├── CANXL/
│   └── LIN/
└── Reports/
    └── templates/               # 自定义 HTML 报告模板
```

## 2. 测试设计模式

| 模式 | 适用场景 | 说明 |
|------|----------|------|
| Test Table | 参数化数据驱动（如多 DLC 档位遍历） | 表格列=参数，行=用例实例 |
| State Machine Diagram | 状态序列（Bus-off 恢复、唤醒/睡眠时序） | 图形化状态迁移 |
| Test Case Diagram | 单条冒烟/场景用例 | 步骤序列 + 断言 |

## 3. 分层组织（按 OSI）

- 物理层 → 数据链路层 → 传输层 → 网络管理 → 诊断 → 应用层，与 `docs/02-Bus-Test-Spec-V1.md` 分层对齐。
- 每条测试单元命名 `TC_<协议>_<ID>`，与测试规范 ID 强一致，保证「规范 ↔ 实现 ↔ 报告」可追溯。

## 4. 关键约定

1. **参数化**：DUT 型号、波特率、采样点、报文周期等全部走 `Parameters` 参数集，不在用例内硬编码。
2. **复用**：底层总线交互封装为 `Library/Functions` 带参函数，用例只描述「期望」，不写通信细节。
3. **报告**：编译导出时绑定 `Reports/templates` 自定义模板，含 Trace 波形、时间戳、DUT 版本。
4. **回退验证**：每条用例先注入已知违规样本断言 FAIL，再放行正确样本断言 PASS。

## 5. M1 落点

M1 只搭脚手架 + 四协议各 1 条冒烟用例（★ 标注项，见 `test-specs/`）。M2 按测试规范 V1 逐层补齐一致性/符合性套件。
