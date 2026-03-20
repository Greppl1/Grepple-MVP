# Zian — 链上交易 & 奖励结算层

## 一、项目概览

AAO Launchpad 是一个 MCP 工具诊断 + 发布 + 测试闭环平台：builder 提交工具，平台 agent 真实调用并评分，工具进入公共 registry 被其他 agent 发现使用。我（Zian）负责最下游的**链上交易与奖励结算层**——当 Jerry 的评分引擎完成测试、Fiona 的 Registry 记录了结果后，我的模块负责：给测试 agent 发放 testnet token 作为贡献凭证，管理 builder 充值的 USDC 金库，以及未来开启兑换时的验证逻辑。

**上下游关系：** Jerry（评分引擎）→ Fiona（Registry 写入）→ **Zian（token 发放 + 金库结算）**

---

## 二、模块职责边界

### 做什么
- 测试网 Token 合约（BSC/Base testnet，ERC-20）：发放、记录、查询
- 金库合约（Vault）：USDC 存入、余额管理、兑换验证逻辑（开关默认关闭）
- 链上交互记录与 testnet token 的双重匹配验证机制
- Agent 钱包接入标准：注册、接收 token、发起兑换请求的接口规范
- Agentic security：agent 身份验证、防女巫攻击设计

### 不做什么
- 不做评分计算（Jerry 的事）
- 不做 Registry 数据结构和查询（Fiona 的事）
- 不做前端展示
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
（初始为空，完成后在此记录）

### 待办任务

**Step 1: 项目脚手架 + TestToken**
- [ ] 初始化 Hardhat 项目（`contracts/`目录，安装 OpenZeppelin）
- [ ] 编写 `AAOTestToken.sol`：继承 ERC-20，添加 authorizedMinter 机制
- [ ] 编写 `TokenMintRecord` struct 和 `mint()` 函数
- [ ] 编写 `getMintRecord()` 和 `getMintsByAgent()` 查询函数
- [ ] 编写 TestToken 单元测试（mint 权限、余额变化、记录查询）
- [ ] 编写 BSC Testnet 部署脚本
- [ ] 部署到 BSC Testnet，记录合约地址

**Step 2: Agent 注册表**
- [ ] 编写 `AgentRegistry.sol`：注册、查询、停用
- [ ] 实现 `agentIdHash` 反查机制
- [ ] 编写 AgentRegistry 单元测试
- [ ] 编写后端 API：`POST /api/agents/register`、`GET /api/agents/:wallet/profile`
- [ ] 部署到 BSC Testnet

**Step 3: Vault 金库合约**
- [ ] 编写 `AAOVault.sol`：deposit、getBuilderBalance、toggleRedemption
- [ ] 集成 mock USDC（testnet ERC-20）
- [ ] 编写 Vault 存入相关单元测试
- [ ] 编写后端 API：`POST /api/vault/deposit`、`GET /api/vault/balance/:wallet`
- [ ] 部署到 BSC Testnet

**Step 4: Mint 奖励逻辑**
- [ ] 编写后端 mint 服务：接收 Jerry 的 `test_task_completed` 事件
- [ ] 实现 RewardTier 判定逻辑（FULL / PARTIAL / NONE）
- [ ] 编写 `POST /api/rewards/mint` endpoint
- [ ] 编写 `GET /api/rewards/status/:task_id` endpoint
- [ ] 编写 `GET /api/agents/:wallet/rewards` endpoint
- [ ] 集成测试：mock Jerry 事件 → mint → 查询验证

**Step 5: 兑换验证机制**
- [ ] 实现 `_validateRedemption`：token 持有验证 + mintId 归属验证
- [ ] 实现与 Fiona Registry 的 `callRecordHash` 交叉验证
- [ ] 实现防重放（`processedRedemptions` mapping）
- [ ] 编写 `POST /api/vault/redeem` endpoint（开关检查 + 验证 + 转账）
- [ ] 编写兑换流程端到端测试
- [ ] 部署更新后的 Vault 合约

**Step 6: Agentic Security**
- [ ] 设计防女巫方案：单 agent 频率限制 + 注册门槛
- [ ] 实现 agent 身份验证中间件（API 层签名验证）
- [ ] 编写安全相关测试（重放攻击、伪造 mint、女巫注册）
- [ ] 完成安全审计 checklist

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
- [ ] 只有 authorizedMinter 能调用 mint
- [ ] mint 后 agent 余额正确增加
- [ ] mintRecord 写入且可查询
- [ ] getMintsByAgent 返回正确的 mintId 列表
- [ ] 未授权地址 mint 会 revert

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
- [ ] 注册后 isRegisteredAgent 返回 true
- [ ] agentIdToWallet 反查正确
- [ ] 重复注册会 revert
- [ ] deactivateAgent 后 isActive 变 false
- [ ] 未注册地址查询返回空/默认值

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
- [ ] deposit 后 builderBalance 正确增加
- [ ] deposit 后 Vault 合约 USDC 余额正确
- [ ] redemptionEnabled 默认 false
- [ ] toggleRedemption 只有 owner 能调用
- [ ] redemptionEnabled=false 时 requestRedemption revert

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
- [ ] `result=success` → mint FULL amount，tier=FULL
- [ ] `result=failed_with_diagnosis` → mint 50% amount，tier=PARTIAL
- [ ] `result=invalid` → 不 mint，返回 rejected
- [ ] 同一 task_id 不能重复 mint（幂等性）
- [ ] agent 未注册时 mint 失败

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
- [ ] callRecordHash 匹配 → 验证通过
- [ ] callRecordHash 不匹配 → 验证失败
- [ ] mintId 不属于请求的 agent → 验证失败
- [ ] 已兑换的 mintId 再次兑换 → 验证失败（防重放）
- [ ] redemptionEnabled=false → 直接拒绝，不走验证逻辑

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
contracts/           # Solidity 合约 + Hardhat 项目
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
    mocks/
      jerry_events.json
      fiona_registry_mock.js
  scripts/
    deploy.js
  hardhat.config.js

backend/             # Node.js API 服务
  src/
    routes/
      rewards.js
      vault.js
      agents.js
    services/
      mintService.js
      vaultService.js
      agentService.js
    middleware/
      agentAuth.js
  test/
    rewards.test.js
    vault.test.js
    agents.test.js
```

### 命名规范
- 合约：PascalCase（`AAOTestToken`、`AAOVault`）
- 合约函数：camelCase（`getMintRecord`、`requestRedemption`）
- API 路由：kebab-case（`/api/rewards/mint`、`/api/vault/balance`）
- JS/TS 文件：camelCase（`mintService.js`、`vaultService.js`）
- 测试文件：与源文件同名 + `.test.js`

### 提交信息格式
```
[Settlement] feat: 描述     # 新功能
[Settlement] fix: 描述      # 修复
[Settlement] test: 描述     # 测试
[Settlement] refactor: 描述 # 重构
[Settlement] docs: 描述     # 文档
```

### 技术栈
- 合约：Solidity ^0.8.20 + OpenZeppelin 5.x
- 框架：Hardhat
- 测试网：BSC Testnet（chainId: 97）
- 后端：Node.js + Express
- 测试：Mocha/Chai（合约）、Jest（后端 API）
