# Fiona — 链上 Registry & 数据查询层

## 一、项目概览

AAO Launchpad 是一个让 builder 提交 MCP 工具、由 agent 真实调用并量化评分、最终进入公共 registry 被其他 agent 发现和使用的平台。整个系统分三层：Jerry 的评分引擎产出评分数据 -> **我（Fiona）的链上 Registry 接收评分并存储、对外提供查询和发现接口** -> Zian 的交易结算层基于 Registry 记录发放 token 和金库兑换。

我的模块是数据的"中间层"——上游接收评分结果写入链上，下游为 Zian 的 token 发放提供数据依据，同时对外暴露 API 和前端页面供 agent 和用户查询。

---

## 二、已部署合约信息

- **合约名称：** AAORegistry (UUPS Proxy)
- **链：** BSC Testnet (Chain ID: 97)
- **Proxy 地址（使用这个）：** `0xA4DD665e9F1F57080C01fD83d48d1485Fae09c01`
- **Implementation 地址：** `0x408189DE06f7bdb785eDdD7C536306B82fb808fF` (V3.2)
- **合约版本：** 3.2.0
- **旧合约（已弃用）：** `0xcdd2fc...` (V1), `0x28DA2E...` (V3.0)
- **RPC：** `https://data-seed-prebsc-1-s1.binance.org:8545`
- **Admin：** deployer wallet (private key in contracts/.env)
- **框架：** Foundry (forge test / forge script)
- **编译配置：** via_ir = true, optimizer = true, 200 runs, solc ^0.8.22
- **依赖：** OpenZeppelin Contracts Upgradeable v5

---

## 三、合约架构（V3 — 生产级）

### 设计原则
1. **大字段不上链** — 链上只存 bytes32 ID + 数值 + metadataURI/Hash 指向链下
2. **所有标识符用 bytes32** — 省 gas、可索引、可组合
3. **Benchmark 结果追加不覆盖** — 每次 run 有 runId，历史不可篡改
4. **UUPS 可升级** — 通过 proxy 模式，合约可以升级而不丢失数据
5. **AccessControl 角色管理** — WRITER_ROLE / PAUSER_ROLE / DEFAULT_ADMIN_ROLE
6. **Pausable 紧急暂停** — 出问题时一键停止所有写入
7. **IToolRegistry 标准接口** — ERC-165 可发现，其他合约/agent 可链上验证
8. **NatSpec 文档** — 每个函数有完整注释，Etherscan 自动渲染

### 合约继承关系
```
IToolRegistry (标准接口 + ERC-165)
    ↑
AAORegistry
    ├── AccessControlUpgradeable (角色管理)
    ├── PausableUpgradeable (紧急暂停)
    └── UUPSUpgradeable (可升级代理)
```

### 角色定义
| 角色 | 权限 |
|------|------|
| `DEFAULT_ADMIN_ROLE` | 授权/撤销角色、升级合约 |
| `WRITER_ROLE` | 注册工具、写入评分、更新元数据、停用/激活工具 |
| `PAUSER_ROLE` | 紧急暂停/恢复 |

---

## 四、核心数据结构

### 4.1 链上 ToolRecord

```solidity
struct ToolRecord {
    bytes32 clusterId;            // keccak256("dex_swap")
    uint16 clusterPoolSize;       // cluster 内工具总数
    uint8 failureMode;            // 0=healthy, 1=schema, 2=description, 3=compatibility, 4=mixed
    uint8 requiredFieldCount;     // schema 必填参数数
    uint8 totalFieldCount;        // schema 总参数数
    uint8 nestingDepth;           // schema 嵌套深度
    bool hasDefaults;             // 参数是否有默认值
    string metadataURI;           // 链下元数据地址 (IPFS/HTTP)
    bytes32 metadataHash;         // 元数据内容的 keccak256
    uint64 registeredAt;
    uint64 lastUpdated;
    address submitter;
    bool exists;
    bool active;                  // 可停用不删除
}
```

### 4.2 链上 BenchmarkRun（追加式）

```solidity
struct BenchmarkRun {
    uint64 runId;                 // 全局自增 ID
    bytes32 modelId;              // keccak256("claude-4.6")
    uint8 invokeRate;             // 0-100
    uint8 mentionRate;            // 0-100
    uint8 silentRate;             // 0-100
    uint8 errorRate;              // 0-100
    bool passesStrictValidation;
    bool under128Limit;
    uint64 timestamp;
    string benchmarkVersion;      // "v2", "v3" etc.
}
```

### 4.3 链下元数据（metadataURI 指向的 JSON）

```json
{
    "name": "uniswap_swap",
    "mcpServerUrl": "https://github.com/...",
    "cluster": "dex_swap",
    "description": "Swap tokens on Uniswap using...",
    "inputSchema": {
        "type": "object",
        "required": ["tokenIn", "tokenOut", "amount"],
        "properties": {
            "tokenIn": {"type": "string"},
            "tokenOut": {"type": "string"},
            "amount": {"type": "number"},
            "slippage": {"type": "number", "default": 0.5}
        }
    },
    "fullDiagnosticReport": { ... }
}
```

---

## 五、合约函数一览

### 写入函数（WRITER_ROLE + whenNotPaused）
| 函数 | 用途 |
|------|------|
| `registerTool(...)` | 注册新工具 |
| `recordCall(hash, toolId, agentWallet, success)` | 记录单次调用（供 Zian 验证）|
| `updateToolMetadata(...)` | 更新工具元数据 |
| `deactivateTool(toolId)` | 停用工具 |
| `reactivateTool(toolId)` | 重新激活 |
| `recordBenchmarkRun(...)` | 记录单次 benchmark 结果 |
| `batchRecordBenchmarkRuns(...)` | 批量记录（省 gas）|

### 管理函数
| 函数 | 角色 | 用途 |
|------|------|------|
| `grantRole(role, addr)` | ADMIN | 授权角色 |
| `revokeRole(role, addr)` | ADMIN | 撤销角色 |
| `pause()` | PAUSER | 紧急暂停 |
| `unpause()` | PAUSER | 恢复 |
| `upgradeToAndCall(newImpl, data)` | ADMIN | 升级合约 |

### 读取函数（免费）
| 函数 | 用途 |
|------|------|
| `getTool(toolId)` | 获取工具核心信息 |
| `getBenchmarkRun(toolId, runId)` | 获取某次 benchmark 结果 |
| `getLatestResult(toolId, modelId)` | 获取某模型的最新结果 |
| `getToolRunCount(toolId)` | 工具的 benchmark 总次数 |
| `getClusterTools(clusterId)` | 某 cluster 下所有工具 |
| `getClusterToolsPaginated(clusterId, start, count)` | 分页获取 |
| `getAllClusterIds()` | 所有 cluster ID |
| `totalTools()` | 工具总数 |
| `getToolIds(start, count)` | 分页获取工具 ID |
| `verifyCallRecord(hash)` | 验证调用记录是否存在（Zian 用）|
| `getCallRecord(hash)` | 获取调用记录详情 |
| `getToolCallRecords(toolId)` | 某工具的所有调用记录 hash |
| `getAgentCallRecords(wallet)` | 某 agent 的所有调用记录 hash |
| `supportsInterface(interfaceId)` | ERC-165 接口发现 |

### Helper
| 函数 | 用途 |
|------|------|
| `computeToolId(name, url)` | 计算 toolId |
| `computeModelId(modelName)` | 计算 modelId |
| `computeClusterId(clusterName)` | 计算 clusterId |
| `computeCallRecordHash(callRecordId)` | 计算调用记录 hash（与 Zian 一致）|

---

## 六、与其他模块的接口契约

### 上游：Jerry（评分引擎）-> 我

Jerry 评分完成后，后端调用合约写入：
1. 首次提交工具 -> `registerTool(...)`
2. 每次 benchmark -> `recordBenchmarkRun(...)` 或 `batchRecordBenchmarkRuns(...)`
3. 工具描述/schema 更新 -> `updateToolMetadata(...)`

Jerry 的后端地址需要被授予 WRITER_ROLE：
```solidity
registry.grantRole(WRITER_ROLE, jerryBackendAddress);
```

### 下游：我 -> Zian（交易结算层）

Zian 通过链上读取或监听事件获取数据：
- `getTool(toolId)` — 查询工具是否 active
- `getLatestResult(toolId, modelId)` — 查询最新评分作为 token 发放依据
- 监听 `BenchmarkRecorded` 事件 — 实时获知新评分写入
- `supportsInterface(type(IToolRegistry).interfaceId)` — 链上验证这是一个 registry

---

## 七、已完成任务

- [x] 初始化 Foundry 项目（`contracts/` 目录）— 2026-03-20
- [x] 编写 `AAORegistry.sol` V2 合约 — 2026-03-20
- [x] 实现 deactivateTool/reactivateTool 和分页查询 — 2026-03-20
- [x] 编写合约测试 31 个用例全通过 — 2026-03-20
- [x] 部署到 BSC Testnet V1: `0xcdd2fc6A3aF90e294287d5d4FCB5688Ae5a07E64` — 2026-03-20
- [x] V3 升级：UUPS Proxy + AccessControl + Pausable + NatSpec + IToolRegistry — 2026-03-21
- [x] V3.1 修复：custom errors, abi.encode 防碰撞, VERSION 常量, 清理模板文件 — 2026-03-21
- [x] 编写合约测试 50 个用例全通过 — 2026-03-21
- [x] 部署 V3.1 到 BSC Testnet Proxy: `0xA4DD665e9F1F57080C01fD83d48d1485Fae09c01` — 2026-03-21
- [x] V3.2: 添加 CallRecord 调用记录（recordCall, verifyCallRecord, computeCallRecordHash）— 2026-03-21
- [x] 链上升级 Proxy 到 V3.2，62 个测试全通过 — 2026-03-21
- [x] API 层：Express + TypeScript + SQLite，483 repos / 2114 tools 导入 — 2026-03-21
- [x] 更新 Issue #4 (进度)、#2 (Zian 对接)、#6 (Jerry 对接) — 2026-03-21

---

## 八、待办任务

### 紧急（Hackathon Demo 必须）
- [ ] 跑 cross-model benchmark（2114 工具 x 3 模型），产出评分数据
- [ ] benchmark 数据灌入链下 DB（diagnostic_reports 表需加 model_id 字段）
- [ ] benchmark 数据写入链上合约（batchRecordBenchmarkRuns）
- [ ] 实现 `POST /api/registry/score`（接收 DiagnosticReport → 写 DB + 链上）
- [ ] 部署 API 到 Railway/Render（SQLite 需持久文件系统，不适合 Vercel serverless）
- [ ] 前端对接：grepple.vercel.app/registry 替换 mock 数据为真实 API

### Phase 1: 智能合约（补充）
- [ ] 在 BSCScan 上验证合约源码
- [x] 通知 Zian 新合约地址 + ABI + 角色授权方式（Issue #2 已回复）
- [x] 通知 Jerry WRITER_ROLE 授权流程（Issue #6 已回复）

### Phase 2: 后端 API
- [x] 初始化后端项目（`api/` 目录，Node.js + TypeScript）
- [x] 实现 Registry 查询 API（工具搜索、cluster/section 筛选、fuzzy 查询）
- [ ] 实现数据写入脚本（benchmark 数据 → DB + 链上）
- [ ] 编写 API 测试

### Phase 3: 链下数据层
- [x] SQLite 数据库设计（repos, tools, diagnostic_reports 三表）
- [x] 导入 tools_with_schema_v3.json（483 repos, 2114 tools）
- [ ] Jerry 的 static analysis 数据导入（schema health + discoverability）

### Phase 4: 前端
- [ ] 前端目前由其他人维护（grepple.vercel.app），需对接我的 API
- [ ] 排名列表页（按 cluster 筛选、排序）
- [ ] 工具详情页（benchmark 历史、多模型对比）

---

## 九、独立验证方案

### 合约验证
```bash
cd contracts && forge test -vv
# 62 tests passed, 0 failed (V3.2 with call records)
```

### 数据写入验证
```bash
source contracts/.env
PROXY=0xA4DD665e9F1F57080C01fD83d48d1485Fae09c01

# 查询总工具数
cast call $PROXY "totalTools()(uint256)" --rpc-url $BSC_TESTNET_RPC

# 检查 ERC-165 支持
cast call $PROXY "supportsInterface(bytes4)(bool)" 0x01ffc9a7 --rpc-url $BSC_TESTNET_RPC
```

### 集成验证检查点
- [ ] Jerry 后端成功调用 registerTool + recordBenchmarkRun
- [ ] Zian 成功读取 getTool + getLatestResult
- [ ] Events 能被 Zian 的监听服务捕获
- [ ] supportsInterface 返回 true（IToolRegistry + ERC-165）

---

## 十、开发规范

### 目录结构
```
Grepple-MVP/
├── contracts/                  # Foundry 智能合约项目
│   ├── src/
│   │   ├── IToolRegistry.sol   # 标准接口定义
│   │   └── AAORegistry.sol     # 主合约 V3.2（UUPS + AccessControl + Pausable）
│   ├── test/AAORegistry.t.sol  # 62 个测试用例
│   ├── script/
│   │   ├── Deploy.s.sol        # UUPS proxy 部署脚本
│   │   └── Upgrade.s.sol       # 升级脚本
│   ├── lib/                    # forge-std + openzeppelin
│   ├── .env                    # 私钥和 RPC（已 gitignore）
│   └── foundry.toml            # Foundry 配置
├── api/                        # 后端 API（Express + TypeScript + SQLite）
│   ├── src/
│   │   ├── server.ts           # Express 路由
│   │   └── db.ts               # SQLite 初始化 + JSON 导入
│   ├── data/
│   │   └── tools_with_schema_v3.json  # 2114 工具数据
│   ├── package.json
│   └── tsconfig.json
├── .claude/CLAUDE.md           # 本文件
└── .gitignore
```

### 命名规范
- 合约: PascalCase (`AAORegistry.sol`)
- 接口: I + PascalCase (`IToolRegistry.sol`)
- TypeScript: camelCase (`registryService.ts`)
- API 路由: kebab-case (`/api/registry/tool/:toolId`)
- 环境变量: UPPER_SNAKE_CASE (`REGISTRY_CONTRACT_ADDRESS`)

### 提交信息格式
```
[Registry] feat: add UUPS proxy upgradeability
[Registry] feat: add IToolRegistry standard interface
[Registry] test: add proxy upgrade and pause tests
[Registry] refactor: migrate to AccessControl roles
```
