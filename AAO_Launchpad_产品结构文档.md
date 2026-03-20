# AAO Launchpad — 产品结构文档

## 一、产品定位

**一句话：** 让 agent 帮你的 MCP 工具被发现、被选中、被成功调用。

**核心叙事：让 agent 帮你赚钱。**

现在 vibecoding 产出的工具没人发现——不是因为工具不好，而是因为 agent 读不懂它。AAO Launchpad 是一个诊断 + 发布 + 测试闭环平台：builder 提交工具，平台 agent 真实调用它，给出量化评分和改写建议，工具进入公共 registry，被其他 agent 发现并使用。

---

## 二、用户角色

| 角色 | 描述 |
|------|------|
| **Builder** | 做了 MCP 工具的开发者（可以是人，也可以是 agent 自己生成的产品）。核心诉求：让工具被 agent 发现和调用。 |
| **用户 / Agent 使用者** | 输入任务意图，平台从 registry 找到合适工具，agent 代为调用完成任务。 |
| **测试 Agent** | 平台自有 agent + 开放 API 供外部 agent 接入。执行真实调用，产生量化数据，获得 budget 奖励。 |

---

## 三、产品形态

### 3.1 Builder 侧：发布流程

```
提交 MCP tool JSON
        ↓
预发布诊断（平台 agent 跑分，免费）
        ↓
Builder 查看报告，手动修改 或 一键应用建议
        ↓
再次诊断，满意后 Launch
        ↓
工具进入 Registry + Benchmark 数据库
        ↓
持续收到真实调用测试报告，排名动态更新
```

**Builder 提交内容：**
- MCP tool 定义 JSON（含 `name`、`description`、`inputSchema`）
- MCP server URL（供 agent 真实接入调用）
- 测试 budget 上限（自定义，按任务计费消耗）

### 3.2 诊断报告内容（全量化，无主观评分）

每次诊断 = 一次完整的真实调用任务，输出：

| 维度 | 具体指标 |
|------|---------|
| **Schema 健康度** | 必填参数数量、有无默认值、命名歧义、嵌套深度 |
| **可发现性评分** | Description 清晰度、语义密度、场景覆盖数、与高频 query 的 embedding 距离 |
| **可调用性评分** | agent 能否在不补充额外信息的情况下完成调用（参数填充成功率）|
| **调用成功率** | 实际返回结果正确 / 失败 / 报错比例 |
| **竞品对比位置** | 同 category 百分位排名（registry 数据实时计算）|
| **改写建议** | 针对 description 和 schema 的可直接复用改写版本 |

**反作弊原则：**
- 全量化指标，无主观打分
- 仅实际调用成功才计入奖励，模拟调用不算
- 测试场景随机化，builder 不知道具体考题
- 平台 agent + 外部 agent 双重测试，结果交叉验证

### 3.3 用户侧：意图 → 工具 → 执行

```
用户输入任务意图（自然语言）
        ↓
平台意图识别，从 Registry 匹配最合适的工具
        ↓
  A. 用户自己用 → 推荐工具列表 + 接入指引
  B. 平台 agent 代为执行 → 完成任务，返回结果
```

---

## 四、Registry 设计

**性质：** 后端数据库 + 实时评分系统，不是静态列表。

**数据结构（每条记录包含）：**

```json
{
  "tool_id": "...",
  "name": "swap_tokens",
  "category": "DeFi / Swap",
  "mcp_url": "...",
  "scores": {
    "discoverability": 87,
    "callability": 62,
    "schema_health": 91,
    "call_success_rate": 0.73
  },
  "category_percentile": 84,
  "last_tested": "2026-03-20T10:00:00Z",
  "test_count": 142
}
```

**排名更新机制：** 每次真实调用结果写入即触发重新计算。数据来自 builder launch 时的初始诊断 + 后续所有测试 agent 的调用结果累积。

**去中心化路径：**
- 当前：平台维护中心化数据库 + 公开 API + 公开 Registry 页面
- Roadmap：写入 ERC-8004 on-chain registry，分数上链，agent 自主查询，不可篡改

---

## 五、经济设计

### 5.1 Budget 流转

```
Builder 充值 USDC 存入平台金库
        ↓
测试 agent 完成真实调用任务
        ↓
agent 获得测试网 Token（BSC/Base testnet）作为贡献凭证
        ↓
agent 携带 testnet token + 链上交互记录，向金库申请兑换 USDC
        ↓
金库验证 token 与交互记录一致 → 释放 USDC 至 agent 钱包
                    ↑
           🔒 此开关默认关闭，时机成熟后开启
```

**安全设计要点：**
- Testnet token 本身无价值，即便被盗也无法直接套现
- 兑换需要 token 与链上交互记录双重匹配，伪造成本极高
- 金库合约只响应满足条件的兑换请求

### 5.2 计费单位

- 单次任务 = 测试 agent 完成一个端到端调用场景 + 返回量化报告
- Builder 自设单次任务价格（建议区间 $0.1 ~ $1）
- 预发布诊断：**免费**
- Launch 后持续测试：消耗 builder budget

### 5.3 测试 Agent 奖励规则

| 条件 | 结算 |
|------|------|
| 成功调用 + 返回结构化量化报告 | 全额 testnet token |
| 调用失败但返回有效错误诊断 | 50% token |
| 模拟调用 / 未真实连接 | 不结算 |

**钱包归属：** 归运行 agent 的人（开发者 / 用户）。Non-custodial agent 钱包为 roadmap。

---

## 六、防作弊机制

1. **场景随机化** — 任务描述从题库随机抽取，builder 无法提前针对性优化
2. **真实调用才上链** — agent 必须连接 MCP server URL 返回真实响应，testnet token 才写入
3. **双重验证** — 平台 agent 与外部 agent 结果交叉比对，单一来源异常不计入
4. **全量化指标** — 无主观打分，所有分数可由调用日志还原验证

---

## 七、团队分工（MECE）

每人负责一个完整垂直切片，边界不重叠，合起来覆盖全部系统。

### Jerry — 评分引擎 & Benchmark 数据层

**负责：**
- 平台自有评分 agent 的设计与运行（schema 诊断、description 评分、调用成功率测量）
- 测试场景题库构建与随机化机制
- Benchmark 数据库设计（本地存储、写入规则、历史版本管理）
- 同 category 百分位排名算法
- 改写建议生成逻辑（针对 description 和 schema 的优化输出）
- 开放给外部 agent 的评分任务 API（接单接口）

**不负责：** 链上写入、token 发放、金库逻辑。

---

### Fiona — 链上 Registry & 数据查询层

**负责：**
- 链上 Registry 合约设计（ERC-8004 或轻量替代方案）
- Registry 数据结构定义（tool 元数据、评分字段、时间戳上链格式）
- 链上数据写入触发机制（评分更新后何时写链、gas 优化策略）
- 公开 Registry 查询 API（支持按 category、分数、时间筛选）
- 面向外部 agent 的 tool 发现接口（意图匹配 → registry 检索）
- 公开 Registry 前端页面（排名展示、工具详情、历史诊断记录）

**不负责：** 评分计算本身、token 发放、金库资金管理。

---

### Zian — 链上交易 & 奖励结算层

**负责：**
- 测试网 Token 合约（BSC/Base testnet，发放与链上记录）
- 金库合约（USDC 存入结构 + 兑换验证逻辑预部署，兑换开关默认关闭）
- 链上交互记录与 testnet token 的双重匹配验证机制
- Agent 钱包接入标准（外部 agent 如何注册、接收 token、发起兑换请求）
- Agentic security 映射（agent 身份验证、防女巫攻击设计）

**不负责：** 评分逻辑、registry 数据结构、前端展示。

---

## 八、上线策略

**一次性全量上线，金库兑换作为唯一开关。**

| 功能模块 | 状态 |
|----------|------|
| Builder 提交 + 预发布诊断 | ✅ 上线 |
| 评分 agent 真实调用 + 量化报告 | ✅ 上线 |
| 改写建议 + 一键应用 | ✅ 上线 |
| 公开 Registry + 实时排名 | ✅ 上线 |
| 外部 agent 接单 API | ✅ 上线 |
| Testnet token 发放（贡献凭证）| ✅ 上线 |
| Builder budget 充值 | ✅ 上线 |
| 金库 USDC 兑换 | 🔒 关闭，条件成熟后开启 |

金库未开放时系统内无真钱流动，testnet token 是纯粹的链上贡献记录。所有数据、排名、奖励机制从第一天起真实运行。打开兑换开关的瞬间，积累的 token 立刻具备价值——对早期 agent 贡献者形成天然的追溯激励。
