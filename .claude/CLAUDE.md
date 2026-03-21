# Zian — 链上交易 & 奖励结算层 + 前端

## 一、项目概览

AAO Launchpad 是一个 MCP 工具诊断 + 发布 + 测试闭环平台：builder 提交工具，平台 agent 真实调用并评分，工具进入公共 registry 被其他 agent 发现使用。我（Zian）负责**链上交易与奖励结算层**以及**全平台前端**。

**上下游关系：** Jerry（评分引擎）→ Fiona（Registry 写入）→ **Zian（token 发放 + 金库结算 + 前端）**

---

## 二、模块职责边界

### A. 链上交易 & 奖励结算（已完成）
- 测试网 Token 合约（BSC Testnet，ERC-20）：发放、记录、查询
- 金库合约（Vault）：USDC 存入、余额管理、兑换验证逻辑（开关默认关闭）
- 链上交互记录与 testnet token 的双重匹配验证机制
- Agent 钱包接入标准：注册、接收 token、发起兑换请求的接口规范
- Agentic security：agent 身份验证、防女巫攻击设计

### B. 前端（待开发）
- Builder Dashboard：提交 MCP tool、查看诊断报告、一键应用改写建议、管理 budget
- Registry 公开页面：工具排名列表、详情页、历史诊断记录、按 category/分数/时间筛选
- 用户意图入口：输入任务意图 → 匹配工具推荐 → 查看执行结果
- 钱包集成：Builder 充值、Agent 奖励查看、兑换操作

### 不做什么
- 不做评分计算（Jerry 的事）
- 不做 Registry 数据结构和查询 API（Fiona 的事）
- 不做 MCP tool 的诊断调用

---

## 三、核心数据结构与接口定义

### 3.1 TestToken 合约（ERC-20，testnet）

```solidity
// 合约名: AAOTestToken
// 网络: BSC Testnet / Base Sepolia
// 标准: ERC-20 + 自定义 mint 权限

// 额外状态变量
mapping(address => bool) public authorizedMinters;  // 被授权的 minter 地址（平台后端）
mapping(uint256 => TokenMintRecord) public mintRecords; // mintId => 记录

struct TokenMintRecord {
    uint256 mintId;          // 唯一 mint ID
    address agent;           // 接收 token 的 agent 钱包地址
    uint256 amount;          // 发放数量（单位: wei，18 decimals）
    bytes32 taskHash;        // 关联的测试任务哈希（来自评分引擎的 task_id 的 keccak256）
    bytes32 callRecordHash;  // 关联的调用记录哈希（来自 Registry 的调用记录）
    uint256 timestamp;       // 发放时间戳
    RewardTier tier;         // 奖励等级
}

enum RewardTier {
    FULL,    // 成功调用 + 结构化报告 → 100% token
    PARTIAL, // 调用失败但有效错误诊断 → 50% token
    NONE     // 模拟调用 / 未真实连接 → 0
}

// 关键函数
function mint(address agent, uint256 amount, bytes32 taskHash, bytes32 callRecordHash, RewardTier tier) external onlyAuthorizedMinter;
function getMintRecord(uint256 mintId) external view returns (TokenMintRecord memory);
function getMintsByAgent(address agent) external view returns (uint256[] memory mintIds);
function addMinter(address minter) external onlyOwner;
function removeMinter(address minter) external onlyOwner;
```

### 3.2 Vault 金库合约

```solidity
// 合约名: AAOVault
// 网络: BSC Testnet / Base Sepolia（与 TestToken 同网络）
// 依赖: USDC testnet 地址（或 mock ERC-20）

// 状态变量
IERC20 public usdc;
IERC20 public testToken;
bool public redemptionEnabled;  // 兑换开关，默认 false
mapping(address => uint256) public builderDeposits;  // builder 地址 => 充值余额
mapping(bytes32 => bool) public processedRedemptions; // 防重放

struct RedemptionRequest {
    address agent;            // 发起兑换的 agent 钱包
    uint256 tokenAmount;      // 要兑换的 testnet token 数量
    uint256[] mintIds;        // 关联的 mint 记录 ID 列表
    uint256 usdcAmount;       // 期望获得的 USDC 数量
}

// 关键函数
function deposit(uint256 usdcAmount) external;  // Builder 充值
function getBuilderBalance(address builder) external view returns (uint256);
function requestRedemption(RedemptionRequest calldata req) external; // Agent 兑换
function toggleRedemption(bool enabled) external onlyOwner; // 开关控制
function withdraw(uint256 amount) external onlyOwner; // 紧急提款

// 兑换验证逻辑（内部）
function _validateRedemption(RedemptionRequest calldata req) internal view returns (bool);
// 验证: 1) agent 确实持有这些 token  2) mintIds 都存在且属于该 agent
//        3) callRecordHash 与链上记录匹配  4) 未被重复兑换
```

### 3.3 Agent 钱包注册表

```solidity
// 合约名: AgentRegistry（轻量级，可合并到 Vault 中）

struct AgentProfile {
    address wallet;           // agent 钱包地址
    address operator;         // 运行 agent 的人（EOA）
    bytes32 agentIdHash;      // agent 唯一标识的哈希（平台分配的 agent_id）
    uint256 registeredAt;     // 注册时间
    bool isActive;            // 是否活跃
    uint256 totalEarned;      // 累计获得的 token 数量
    uint256 taskCount;        // 完成的任务数
}

mapping(address => AgentProfile) public agents;
mapping(bytes32 => address) public agentIdToWallet; // agentId 反查

function registerAgent(bytes32 agentIdHash) external;
function deactivateAgent(address wallet) external onlyOwner;
function getAgentProfile(address wallet) external view returns (AgentProfile memory);
function isRegisteredAgent(address wallet) external view returns (bool);
```

### 3.4 后端 API 层（调用合约的中间层）

```
POST /api/rewards/mint
  Body: { agent_wallet, task_id, call_record_id, tier: "FULL"|"PARTIAL"|"NONE" }
  Response: { tx_hash, mint_id, amount }

POST /api/vault/deposit
  Body: { builder_wallet, usdc_amount }
  Response: { tx_hash, new_balance }

GET /api/vault/balance/:builder_wallet
  Response: { balance }

POST /api/vault/redeem
  Body: { agent_wallet, token_amount, mint_ids }
  Response: { tx_hash, usdc_received } | { error: "redemption_disabled" }

POST /api/agents/register
  Body: { wallet_address, agent_id }
  Response: { tx_hash, agent_profile }

GET /api/agents/:wallet/profile
  Response: { AgentProfile }

GET /api/agents/:wallet/rewards
  Response: { mint_records: [...], total_earned }
```

---

## 四、与其他模块的接口契约

### 4.1 从 Jerry（评分引擎）接收

Jerry 完成一次测试任务后，通过内部事件/API 通知我的模块发放 token。

```json
// Jerry → Zian: 测试任务完成事件
{
  "event": "test_task_completed",
  "data": {
    "task_id": "task_20260320_abc123",       // 唯一任务 ID
    "agent_wallet": "0x1234...abcd",         // 执行测试的 agent 钱包地址
    "tool_id": "tool_swap_tokens_001",       // 被测试的工具 ID
    "result": "success" | "failed_with_diagnosis" | "invalid",
    "scores": {                               // 本次测试产生的评分
      "call_success": true,
      "structured_report": true
    },
    "timestamp": "2026-03-20T10:30:00Z"
  }
}
```

**我的处理逻辑：**
- `result === "success"` 且 `scores.call_success && scores.structured_report` → `RewardTier.FULL`
- `result === "failed_with_diagnosis"` → `RewardTier.PARTIAL`
- `result === "invalid"` → `RewardTier.NONE`（不 mint）

### 4.2 从 Fiona（Registry）接收

Fiona 的 Registry 提供调用记录的链上证明，我的合约验证时需要查询。

```json
// Fiona → Zian: 调用记录查询接口
// GET /api/registry/call-record/:call_record_id
{
  "call_record_id": "cr_20260320_xyz789",
  "tool_id": "tool_swap_tokens_001",
  "agent_wallet": "0x1234...abcd",
  "call_timestamp": "2026-03-20T10:30:00Z",
  "call_success": true,
  "on_chain_tx": "0xabc...def",             // Registry 写入的链上交易哈希
  "call_record_hash": "0x9876...5432"        // 调用记录的 keccak256 哈希
}
```

**我的使用方式：**
- mint token 时，将 `call_record_hash` 写入 `TokenMintRecord`
- 兑换验证时，比对 agent 提交的 `mintIds` 对应的 `callRecordHash` 是否与 Registry 链上记录一致

### 4.3 我提供给其他模块的接口

```json
// Zian → Jerry/Fiona: Token 发放状态查询
// GET /api/rewards/status/:task_id
{
  "task_id": "task_20260320_abc123",
  "mint_status": "minted" | "pending" | "rejected",
  "mint_id": 42,
  "tx_hash": "0xdef...123",
  "amount": "1000000000000000000",
  "tier": "FULL"
}

// Zian → Fiona: Builder 余额查询（Registry 前端展示用）
// GET /api/vault/balance/:builder_wallet
{
  "builder_wallet": "0x5678...efgh",
  "usdc_balance": "50000000",
  "total_deposited": "100000000",
  "total_consumed": "50000000"
}
```

---

## 五、实现路径

### Step 1: 项目脚手架 + TestToken 合约
**为什么先做这个：** Token 是整个奖励系统的基础，其他一切依赖 token 存在。
**产出物：**
- Hardhat/Foundry 项目初始化
- `AAOTestToken.sol` 合约代码 + 单元测试
- 部署脚本（BSC Testnet）
- 部署后的合约地址记录

### Step 2: Agent 注册表
**为什么第二：** 在发 token 之前需要知道 agent 是谁，注册表是 mint 的前置依赖。
**产出物：**
- `AgentRegistry.sol` 合约代码 + 单元测试
- 注册/查询 API

### Step 3: Vault 金库合约（存入 + 开关）
**为什么第三：** Builder 充值是经济循环的入口，且不依赖兑换逻辑。
**产出物：**
- `AAOVault.sol` 合约代码（deposit + toggleRedemption）
- 单元测试
- 部署脚本

### Step 4: Mint 奖励逻辑 + 后端 API
**为什么第四：** 有了 Token + AgentRegistry + Vault，现在可以实现完整的 mint 流程。
**产出物：**
- mint API endpoint
- 与 Jerry 事件格式的对接逻辑
- Tier 判定逻辑
- 集成测试

### Step 5: 兑换验证机制
**为什么第五：** 兑换是最复杂的部分，需要前面所有合约就绪。开关默认关闭，但逻辑预部署。
**产出物：**
- `_validateRedemption` 实现
- 防重放机制
- 与 Fiona Registry 的 callRecordHash 交叉验证
- 兑换 API endpoint

### Step 6: Agentic Security
**为什么最后：** 安全层是加固，核心功能先跑通。
**产出物：**
- 防女巫方案（rate limiting + 链上行为分析）
- Agent 身份验证中间件
- 安全审计 checklist

---

## 六、任务清单

### 已完成任务

**Step 1: 项目脚手架 + TestToken** ✅
- [x] 初始化 Hardhat 项目（`contracts/`目录，安装 OpenZeppelin 5.x）
- [x] 编写 `AAOTestToken.sol`：继承 ERC-20，添加 authorizedMinter 机制 + 可配置 rewardAmount
- [x] 编写 `TokenMintRecord` struct 和 `mint()` 函数
- [x] 编写 `getMintRecord()` 和 `getMintsByAgent()` 查询函数
- [x] 编写 TestToken 单元测试（17 tests passing）
- [x] 编写 BSC Testnet 部署脚本（支持 BSC Testnet + Base Sepolia）
- [x] 部署到 BSC Testnet

**Step 2: Agent 注册表** ✅
- [x] 编写 `AgentRegistry.sol`：注册、查询、停用、stats 更新
- [x] 实现 `agentIdHash` 反查机制
- [x] 编写 AgentRegistry 单元测试（12 tests passing）
- [x] 编写后端 API：`POST /api/agents/register`、`GET /api/agents/:wallet/profile`
- [x] 部署到 BSC Testnet

**Step 3: Vault 金库合约** ✅
- [x] 编写 `AAOVault.sol`：deposit、getBuilderBalance、toggleRedemption、requestRedemption
- [x] 集成 MockUSDC（18 decimals）
- [x] 编写 Vault 单元测试（18 tests passing）
- [x] 编写后端 API：`POST /api/vault/deposit`、`GET /api/vault/balance/:wallet`
- [x] 部署到 BSC Testnet

**Step 4: Mint 奖励逻辑** ✅
- [x] 编写后端 mint 服务：接收 Jerry 的 `test_task_completed` 事件
- [x] 实现 RewardTier 判定逻辑（FULL / PARTIAL / NONE）
- [x] 编写 `POST /api/rewards/mint` endpoint（带签名验证 + 限流）
- [x] 编写 `GET /api/rewards/status/:task_id` endpoint
- [x] 编写 `GET /api/agents/:wallet/rewards` endpoint
- [x] 集成测试（24 backend tests passing）

**Step 5: 兑换验证机制** ✅
- [x] 实现 `_validateRedemption`：token 持有验证 + mintId 归属验证
- [x] 实现与 Fiona Registry 的 `callRecordHash` 交叉验证
- [x] 实现防重放（`processedRedemptions` mapping）
- [x] 编写 `POST /api/vault/redeem` endpoint（开关检查 + 验证 + 转账）
- [x] 编写兑换流程端到端测试（5 redemption tests passing）

**Step 6: Agentic Security** ✅
- [x] 设计防女巫方案：per-wallet 频率限制（10 req/min 默认）
- [x] 实现 agent 身份验证中间件（ethers.verifyMessage 签名验证，5min 时间窗口）
- [x] 编写安全相关测试（10 security tests passing）
- [x] 完成安全审计 checklist（`contracts/SECURITY_CHECKLIST.md`）

### BSC Testnet 部署地址（2026-03-20）

| 合约 | 地址 |
|------|------|
| MockUSDC | `0xC4A60C64E24d3D7331Da6B48624333E9196C9188` |
| AAOTestToken | `0xc2a5E61225b7623090DfB7067D76CfA987C3AbF3` |
| AgentRegistry | `0xB31733fE1676539fD0b478aF3C366FBC9711927e` |
| AAOVault | `0x01230E4030981864B8d93ea9a15E7AAC207A6952` |

### 测试统计

| 层 | 测试数 | 状态 |
|----|--------|------|
| 合约（Mocha/Chai） | 53 | ✅ all passing（含 Pausable + taskHash 唯一性 + ReentrancyGuard） |
| 后端 API（Jest） | 40 | ✅ all passing（含 txQueue + webhookAuth + 地址校验） |
| 前端（Next.js build） | 12 pages | ✅ compiles, 0 errors |
| **总计** | **93+** | **✅** |

### 队友对接 Issues

- GitHub Issue #1：Jerry（评分引擎）— 事件格式 + 奖励规则 ✅ 已回复确认，camelCase 兼容已实现
- GitHub Issue #2：Fiona（Registry）— callRecordHash 验证 + 接口格式 ⏳ 等 Fiona 部署
- GitHub Issue #5：Zian 任务 ✅ 已回复进度更新
- GitHub Issue #6：对接文档 ✅ 已回复对接完成

### Jerry 对接详情

- 后端新增 `POST /api/rewards/webhook`：接收 Jerry 的 `test_task_completed` 事件或 `RewardResult`
- camelCase / snake_case 双格式兼容（`taskId`/`task_id` 等）
- 前端 Builder 提交页直连 Jerry 的 `POST /api/v1/diagnose`
- 环境变量：`SCORING_ENGINE_URL`（默认 localhost:8001）、`REWARD_SYSTEM_URL`（默认 localhost:8002）

### 待办任务

**Step 7: 前端脚手架 + 项目结构** ✅
- [x] 初始化前端项目（Next.js 16 + TailwindCSS v4 + TypeScript）
- [x] 配置路由结构（Builder Dashboard、Registry、Agent）
- [x] 集成钱包连接（wagmi + RainbowKit，支持 BSC Testnet）
- [x] 配置合约地址常量（src/lib/contracts.ts）
- [x] 搭建通用 Layout（可折叠侧边栏 + 钱包连接）

**Step 8: Builder Dashboard** ✅
- [x] 提交 MCP Tool 表单页（验证侧栏 + 参数解析）
- [x] 诊断报告展示页（Terminal 动画可跳过 → Dashboard 数据视图）
- [x] 改写建议展示 + Apply 按钮（带 Toast 反馈）
- [x] Builder Budget 管理页（USDC 充值确认弹窗、余额/消耗卡片、交易历史表格）
- [x] 已发布工具管理列表（ScoreRing、状态 badge、趋势 Sparkline）
- [x] Builder 子导航（My Tools / Submit / Budget tab 切换）

**Step 9: Registry 公开页面** ✅
- [x] 工具排名列表页（表格 + 卡片双视图，表格行可点击跳转详情）
- [x] 工具详情页 `/registry/[id]`（完整分数、趋势图、质量分解）
- [x] 筛选 & 排序（category pills、搜索含 description、列头排序）
- [x] 搜索功能（支持从首页意图入口传入 query）
- [x] 响应式适配（移动端隐藏次要列、grid-cols 自适应）

**Step 10: 用户意图入口** ✅
- [x] 首页 Hero + 自然语言输入框（提交后跳转 Registry 搜索）
- [x] 角色选择卡片（Builder / Agent 两入口）
- [x] How it Works 三步介绍 + CTA
- [ ] 工具推荐结果页（AI 匹配）— 待 Fiona Registry API 就绪后对接
- [ ] 执行结果展示

**Step 11: Agent & 钱包页面** ✅
- [x] Agent 注册页（3 步引导 + Toast + SVG icon）
- [x] Agent Profile 页（钱包地址、stats 卡片、奖励历史 + 空状态）
- [x] 兑换页面（余额展示、Lock/Unlock icon、Coming Soon 提示）
- [x] Agent 子导航（Profile / Register / Redeem tab 切换）

**Step 13: UI/UX 全面重构** ✅
- [x] Landing Page：Hero + 意图输入 + 角色选择 + How it Works + CTA
- [x] SVG Icon 系统替换 Unicode 字符（`components/Icons.tsx`，25+ 图标）
- [x] Toast 通知系统（`components/Toast.tsx` + context provider）
- [x] 确认弹窗组件（`components/ConfirmDialog.tsx`）
- [x] Skeleton 加载占位组件（`components/Skeleton.tsx`）
- [x] SubNav 子导航组件（Builder / Agent 页面内 tab 切换）
- [x] LayoutShell 响应式外壳（Landing 无侧边栏、内页有侧边栏 + 移动端适配）
- [x] 响应式设计（移动端 hamburger 菜单、表格列自适应隐藏、grid 自适应）
- [x] CSS 动画系统（slide-in/slide-up/scale-in/fade-in/stagger-children）
- [x] 视觉层级优化（stat-highlight、card-glow、hero-gradient、btn-secondary）
- [x] Registry 行可点击 + 详情页 `/registry/[id]`
- [x] Report 页面 Skip 按钮 + toolName 联动
- [x] Budget Deposit 确认弹窗
- [x] 移除假代码编辑器模式
- [x] 修复 ScoreRing 在 Balance 中的滥用（改为数字展示）
- [x] 空状态处理（Registry 无结果 + Clear filters、Rewards 空列表、Transactions 空列表）

**Step 14: 后端 + 合约安全加固** ✅
- [x] AAOTestToken：添加 `mintedTaskHashes` 映射防重复 mint + `Pausable` 紧急暂停
- [x] AgentRegistry：添加 `registerAgentFor(address, bytes32)` operator 模式 + `Pausable`
- [x] AAOVault：添加 `depositFor(address, uint256)` operator 模式 + `ReentrancyGuard`
- [x] 后端 `txQueue.js`：事务队列防 nonce 冲突 + `tx.wait()` 60 秒超时
- [x] 后端 `webhookAuth.js`：Webhook API key 认证（`WEBHOOK_API_KEY` 环境变量）
- [x] 后端 `logger.js`：结构化 JSON 日志（请求日志 + 交易日志 + 错误日志）
- [x] `mintService.js`：链上 `isTaskMinted()` 检查防重启后重复 mint + `validateAddress` + 自动 `updateAgentStats`
- [x] `agentService.js`：使用 `registerAgentFor` + `Promise.all` 并行查询 rewards（O(n) → O(1) RPC 时间）
- [x] `vaultService.js`：使用 `depositFor` + hash 比较 `.toLowerCase()` + fetch 10 秒超时
- [x] `vault.js` 路由：redeem 加 `agentAuth` + `redeemRateLimiter` + `mint_ids` 数组校验
- [x] `rewards.js` 路由：webhook 加 `webhookAuth` 中间件
- [x] `app.js`：CORS 限制配置域名（`CORS_ORIGINS` 环境变量）+ 错误信息脱敏
- [x] `config.js`：启动时警告未设置 `PRIVATE_KEY`
- [x] 合约编译通过，53 tests passing；后端 40 tests passing

**已知限制（非当前优先级）：**
- Redeem 功能仅为占位接口，默认关闭，用户不涉及真实兑换。真钱是未来的事情
- MockUSDC 使用 18 decimals（真实 USDC 为 6），迁移 mainnet 时需适配
- `builderDeposits` 只记录累计充值，不反映消耗后余额
- `processedRedemptions` hash 包含 `block.timestamp`，未来需改为基于 mintId 的防重放
- 缺少 off-chain indexer（The Graph / Ponder），统计数据暂为 mock
- 幂等性 Map 仍为内存级，生产环境需 Redis/DB 持久化

**Step 12: 对接联调**
- [ ] 前端 ↔ Zian 后端 API 联调（rewards、vault、agents 全部 endpoint）
- [ ] 前端 ↔ Jerry 评分 API 联调（诊断报告数据）
- [ ] 前端 ↔ Fiona Registry API 联调（工具列表、详情、搜索）
- [ ] 端到端流程测试：Builder 提交 → 诊断 → Launch → Registry 展示 → Agent 测试 → Token 发放

---

## 七、独立验证方案

### 7.1 TestToken 合约验证

**Mock 方案：** 不依赖任何外部模块，纯合约层测试。

```javascript
// test/AAOTestToken.test.js - mock 数据
const mockMintParams = {
  agent: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // hardhat 默认账户 #1
  amount: ethers.parseEther("1.0"),
  taskHash: ethers.keccak256(ethers.toUtf8Bytes("task_20260320_abc123")),
  callRecordHash: ethers.keccak256(ethers.toUtf8Bytes("cr_20260320_xyz789")),
  tier: 0 // FULL
};
```

**单元验证命令：**
```bash
cd contracts && npx hardhat test test/AAOTestToken.test.js
```

**验证检查点：**
- [x] 只有 authorizedMinter 能调用 mint
- [x] mint 后 agent 余额正确增加
- [x] mintRecord 写入且可查询
- [x] getMintsByAgent 返回正确的 mintId 列表
- [x] 未授权地址 mint 会 revert

### 7.2 Agent 注册表验证

**Mock 方案：**
```javascript
const mockAgent = {
  wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  agentIdHash: ethers.keccak256(ethers.toUtf8Bytes("agent_001")),
};
```

**单元验证命令：**
```bash
cd contracts && npx hardhat test test/AgentRegistry.test.js
```

**验证检查点：**
- [x] 注册后 isRegisteredAgent 返回 true
- [x] agentIdToWallet 反查正确
- [x] 重复注册会 revert
- [x] deactivateAgent 后 isActive 变 false
- [x] 未注册地址查询返回空/默认值

### 7.3 Vault 金库验证

**Mock 方案：** 部署一个 MockUSDC（简单的 ERC-20 mint 无限量）来模拟 USDC。

```solidity
// contracts/mocks/MockUSDC.sol
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

```javascript
// test/AAOVault.test.js - mock 数据
const mockDeposit = {
  builder: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // hardhat 默认账户 #0
  usdcAmount: ethers.parseUnits("100", 6) // 100 USDC (6 decimals)
};
```

**单元验证命令：**
```bash
cd contracts && npx hardhat test test/AAOVault.test.js
```

**验证检查点：**
- [x] deposit 后 builderBalance 正确增加
- [x] deposit 后 Vault 合约 USDC 余额正确
- [x] redemptionEnabled 默认 false
- [x] toggleRedemption 只有 owner 能调用
- [x] redemptionEnabled=false 时 requestRedemption revert

### 7.4 Mint 奖励逻辑验证（模拟 Jerry 事件）

**Mock 方案：** 构造 Jerry 的 `test_task_completed` 事件的 mock 数据。

```json
// test/mocks/jerry_events.json
[
  {
    "event": "test_task_completed",
    "data": {
      "task_id": "task_20260320_abc123",
      "agent_wallet": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "tool_id": "tool_swap_tokens_001",
      "result": "success",
      "scores": { "call_success": true, "structured_report": true },
      "timestamp": "2026-03-20T10:30:00Z"
    }
  },
  {
    "event": "test_task_completed",
    "data": {
      "task_id": "task_20260320_def456",
      "agent_wallet": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "tool_id": "tool_swap_tokens_001",
      "result": "failed_with_diagnosis",
      "scores": { "call_success": false, "structured_report": true },
      "timestamp": "2026-03-20T10:35:00Z"
    }
  },
  {
    "event": "test_task_completed",
    "data": {
      "task_id": "task_20260320_ghi789",
      "agent_wallet": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "tool_id": "tool_swap_tokens_001",
      "result": "invalid",
      "scores": { "call_success": false, "structured_report": false },
      "timestamp": "2026-03-20T10:40:00Z"
    }
  }
]
```

**单元验证：**
```bash
# API 集成测试，用 mock 事件数据
cd backend && npm test -- --grep "mint rewards"
```

**验证检查点：**
- [x] `result=success` → mint FULL amount，tier=FULL
- [x] `result=failed_with_diagnosis` → mint 50% amount，tier=PARTIAL
- [x] `result=invalid` → 不 mint，返回 rejected
- [x] 同一 task_id 不能重复 mint（幂等性）
- [x] agent 未注册时 mint 失败

### 7.5 兑换验证机制验证（模拟 Fiona Registry 数据）

**Mock 方案：** 模拟 Fiona 的 Registry 调用记录查询接口。

```javascript
// test/mocks/fiona_registry_mock.js
// 在测试中 mock Fiona 的 API 响应
const mockCallRecords = {
  "cr_20260320_xyz789": {
    call_record_id: "cr_20260320_xyz789",
    tool_id: "tool_swap_tokens_001",
    agent_wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    call_timestamp: "2026-03-20T10:30:00Z",
    call_success: true,
    on_chain_tx: "0xabc123def456",
    call_record_hash: ethers.keccak256(ethers.toUtf8Bytes("cr_20260320_xyz789"))
  }
};

// Mock HTTP server (用 nock 或 msw)
nock("http://localhost:3001")
  .get("/api/registry/call-record/cr_20260320_xyz789")
  .reply(200, mockCallRecords["cr_20260320_xyz789"]);
```

**单元验证：**
```bash
cd backend && npm test -- --grep "redemption validation"
```

**验证检查点：**
- [x] callRecordHash 匹配 → 验证通过
- [x] callRecordHash 不匹配 → 验证失败
- [x] mintId 不属于请求的 agent → 验证失败
- [x] 已兑换的 mintId 再次兑换 → 验证失败（防重放）
- [x] redemptionEnabled=false → 直接拒绝，不走验证逻辑

### 7.6 集成对接验证 Checklist（其他模块就绪后）

**与 Jerry 对接：**
- [ ] Jerry 的 `test_task_completed` 事件格式与我的接收逻辑匹配
- [ ] task_id 格式一致（字符串，唯一）
- [ ] agent_wallet 格式一致（checksummed 以太坊地址）
- [ ] result 枚举值一致（"success" / "failed_with_diagnosis" / "invalid"）
- [ ] 端到端：Jerry 跑一次真实测试 → 我的系统自动 mint token → agent 余额增加

**与 Fiona 对接：**
- [ ] Fiona 的 `/api/registry/call-record/:id` 返回格式与我的期望一致
- [ ] call_record_hash 计算方式一致（同样的输入 → 同样的 keccak256）
- [ ] 端到端：Fiona 写入调用记录 → 我查询验证 → hash 匹配
- [ ] Builder 在 Fiona 前端看到的余额与我的 Vault 余额一致

---

## 八、开发规范

### 目录结构
```
contracts/                # Solidity 合约 + Hardhat 项目
  contracts/
    AAOTestToken.sol
    AAOVault.sol
    AgentRegistry.sol
    mocks/
      MockUSDC.sol
  test/
    AAOTestToken.test.js
    AAOVault.test.js
    AgentRegistry.test.js
  scripts/
    deploy.js
  hardhat.config.js
  SECURITY_CHECKLIST.md

backend/                  # Node.js API 服务
  src/
    app.js                # Express app setup (CORS 限制 + 错误脱敏 + 请求日志)
    server.js             # Entry point
    config.js             # Contract addresses, RPC config, CORS origins
    routes/
      rewards.js          # mint + webhook (API key 认证) + status
      vault.js            # deposit + balance + redeem (agentAuth + rate limit)
      agents.js           # register + profile + rewards
    services/
      mintService.js      # Mint 逻辑 + 链上幂等检查 + updateAgentStats
      vaultService.js     # Deposit (depositFor) + redeem + hash 比较修复
      agentService.js     # Register (registerAgentFor) + Promise.all 并行查询
      contractService.js  # Shared ethers.js contract interaction layer
      txQueue.js          # 事务队列 (nonce 管理 + tx.wait 超时)
      logger.js           # 结构化 JSON 日志
    middleware/
      agentAuth.js        # Signature verification (ethers.verifyMessage)
      rateLimiter.js      # Per-wallet rate limiting
      webhookAuth.js      # API key 认证 (WEBHOOK_API_KEY)
  test/
    rewards.test.js
    vault.test.js
    agents.test.js
    redemption.test.js
    security.test.js

frontend/                   # React/Next.js 前端
  src/
    app/                    # Next.js App Router 页面
      layout.tsx            # 全局 Layout（导航、钱包连接）
      page.tsx              # 首页 / 用户意图入口
      builder/
        submit/page.tsx     # 提交 MCP Tool
        report/[id]/page.tsx # 诊断报告详情
        budget/page.tsx     # Budget 管理（充值、余额）
        tools/page.tsx      # 已发布工具列表
      registry/
        page.tsx            # Registry 排名列表
        [id]/page.tsx       # 工具详情页
      agent/
        register/page.tsx   # Agent 注册
        profile/page.tsx    # Agent Profile + 奖励历史
        redeem/page.tsx     # 兑换页面
    components/             # 可复用组件
      Icons.tsx             # SVG icon 组件库（25+ icons）
      Toast.tsx             # Toast 通知系统 + provider
      ConfirmDialog.tsx     # 确认弹窗
      Skeleton.tsx          # 加载占位组件
      SubNav.tsx            # 子导航（Builder/Agent 页面内 tab）
      LayoutShell.tsx       # 响应式布局外壳
      Sidebar.tsx           # 侧边栏（移动端 hamburger）
      ScoreRing.tsx         # 环形评分组件
      Sparkline.tsx         # 趋势折线图
    hooks/                  # 自定义 hooks（合约交互、API 调用）
    lib/                    # 工具函数、合约 ABI、常量
    providers/              # Web3 Provider、主题等
```

### 命名规范
- 合约：PascalCase（`AAOTestToken`、`AAOVault`）
- 合约函数：camelCase（`getMintRecord`、`requestRedemption`）
- API 路由：kebab-case（`/api/rewards/mint`、`/api/vault/balance`）
- JS/TS 文件：camelCase（`mintService.js`、`vaultService.js`）
- 测试文件：与源文件同名 + `.test.js`

### 提交信息格式
```
[Settlement] feat: 描述     # 链上/后端新功能
[Settlement] fix: 描述      # 链上/后端修复
[Frontend] feat: 描述       # 前端新功能
[Frontend] fix: 描述        # 前端修复
[*] test: 描述              # 测试
[*] refactor: 描述          # 重构
[*] docs: 描述              # 文档
```

### 技术栈
- 合约：Solidity ^0.8.20 + OpenZeppelin 5.x
- 合约框架：Hardhat 2.x
- 测试网：BSC Testnet（chainId: 97）
- 后端：Node.js + Express
- 前端：Next.js + React + TypeScript + TailwindCSS
- 钱包集成：wagmi + viem + RainbowKit（BSC Testnet）
- 合约测试：Mocha/Chai
- 后端测试：Jest
