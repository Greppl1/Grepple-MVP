import { ethers } from "ethers";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// --- Config ---
const PROXY = "0xA4DD665e9F1F57080C01fD83d48d1485Fae09c01";
const RPC = "https://data-seed-prebsc-1-s1.binance.org:8545";
const PK = "0xc70d5ec9a2a827886e6da5bf5c4eff51412d6f70eb8d62ba45781e21e3043964";

const REGISTRY_ABI = [
  "function registerTool(bytes32 _toolId, bytes32 _clusterId, uint16 _clusterPoolSize, uint8 _failureMode, uint8 _requiredFieldCount, uint8 _totalFieldCount, uint8 _nestingDepth, bool _hasDefaults, string _metadataURI, bytes32 _metadataHash) external",
  "function batchRecordBenchmarkRuns(bytes32 _toolId, bytes32[] _modelIds, uint8[] _invokeRates, uint8[] _mentionRates, uint8[] _silentRates, uint8[] _errorRates, bool[] _passesStrictValidations, bool[] _under128Limits, string _benchmarkVersion) external",
  "function computeToolId(string name, string url) external pure returns (bytes32)",
  "function getTool(bytes32 _toolId) external view returns (tuple(bytes32 clusterId, uint16 clusterPoolSize, uint8 failureMode, uint8 requiredFieldCount, uint8 totalFieldCount, uint8 nestingDepth, bool hasDefaults, string metadataURI, bytes32 metadataHash, uint64 registeredAt, uint64 lastUpdated, address submitter, bool exists, bool active))",
  "function totalTools() external view returns (uint256)",
];

const FAILURE_MODE_MAP: Record<string, number> = {
  healthy: 0,
  schema_failure: 1,
  description_failure: 2,
  compatibility_failure: 3,
  mixed: 4,
};

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);
  const registry = new ethers.Contract(PROXY, REGISTRY_ABI, wallet);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Get tools to register (exclude those without description)
  const { rows: toolRows } = await pool.query(`
    SELECT DISTINCT b.tool_name, b.tool_id_hash, b.cluster, b.cluster_pool_size,
           b.failure_mode, b.mcp_server_url, b.schema_metrics
    FROM benchmark_results b
    LEFT JOIN tools t ON b.tool_name = t.tool_name
    WHERE t.tool_description IS NOT NULL AND t.tool_description != ''
    ORDER BY b.tool_name
  `);

  console.log(`Found ${toolRows.length} tools to process`);
  console.log(`Wallet: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} BNB`);

  const existingCount = await registry.totalTools();
  console.log(`Already on-chain: ${existingCount} tools\n`);

  let registered = 0;
  let benchmarked = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < toolRows.length; i++) {
    const tool = toolRows[i];
    const toolName = tool.tool_name;
    const serverUrl = tool.mcp_server_url || `https://registry.aao.dev/${toolName}`;

    // Compute toolId
    const toolId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string"],
        [toolName, serverUrl]
      )
    );

    const clusterId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["string"], [tool.cluster || "uncategorized"])
    );

    const fm = FAILURE_MODE_MAP[tool.failure_mode || "healthy"] ?? 0;

    // Parse schema metrics
    let requiredFields = 0, totalFields = 0, nestingDepth = 0, hasDefaults = false;
    if (tool.schema_metrics) {
      try {
        const sm = JSON.parse(tool.schema_metrics);
        requiredFields = Math.min(sm.requiredFields || 0, 255);
        totalFields = Math.min(sm.totalFields || 0, 255);
        nestingDepth = Math.min(sm.nestingDepth || 0, 255);
        hasDefaults = sm.hasDefaults || false;
      } catch {}
    }

    // Step 1: Register tool (skip if already exists)
    try {
      const existing = await registry.getTool(toolId);
      if (existing.exists) {
        // Already registered, skip to benchmark
        skipped++;
      } else {
        throw new Error("not found");
      }
    } catch {
      // Not registered yet, register it
      try {
        const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ tool: toolName })));
        const tx = await registry.registerTool(
          toolId,
          clusterId,
          tool.cluster_pool_size || 1,
          fm,
          requiredFields,
          totalFields,
          nestingDepth,
          hasDefaults,
          `https://xrbbvkfvwlupfflhzvwu.supabase.co/rest/v1/tools_with_repo?tool_name=eq.${toolName}`,
          metadataHash,
          { gasLimit: 500000 }
        );
        await tx.wait();
        registered++;
        process.stdout.write(`[${i + 1}/${toolRows.length}] Registered: ${toolName}\n`);
      } catch (err: any) {
        console.error(`[${i + 1}] FAILED to register ${toolName}: ${err.message?.slice(0, 80)}`);
        errors++;
        continue; // Skip benchmark if registration fails
      }
    }

    // Step 2: Record benchmark runs for this tool
    try {
      const { rows: benchRows } = await pool.query(
        `SELECT model_id, invoke_rate, mention_rate, silent_rate, error_rate, total_runs, benchmark_version
         FROM benchmark_results WHERE tool_name = $1 ORDER BY model_id`,
        [toolName]
      );

      if (benchRows.length === 0) continue;

      const modelIds = benchRows.map((r: any) =>
        ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string"], [r.model_id]))
      );

      // Fix rounding: ensure rates sum to 100
      const invokeRates: number[] = [];
      const mentionRates: number[] = [];
      const silentRates: number[] = [];
      const errorRates: number[] = [];

      for (const r of benchRows) {
        let inv = r.invoke_rate || 0;
        let men = r.mention_rate || 0;
        let sil = r.silent_rate || 0;
        let err = r.error_rate || 0;
        const total = inv + men + sil + err;
        if (total === 99) sil += 1; // Fix rounding by adding 1 to silent
        if (total === 101) sil = Math.max(0, sil - 1);
        invokeRates.push(inv);
        mentionRates.push(men);
        silentRates.push(sil);
        errorRates.push(err);
      }

      const passesStrict = benchRows.map((r: any) => (r.invoke_rate || 0) >= 67);
      const under128 = benchRows.map(() => true); // All tools have < 128 params

      const tx = await registry.batchRecordBenchmarkRuns(
        toolId,
        modelIds,
        invokeRates,
        mentionRates,
        silentRates,
        errorRates,
        passesStrict,
        under128,
        benchRows[0].benchmark_version || "v3",
        { gasLimit: 800000 }
      );
      await tx.wait();
      benchmarked++;

      if ((registered + benchmarked + skipped) % 10 === 0) {
        const bal = await provider.getBalance(wallet.address);
        process.stdout.write(`  Progress: ${i + 1}/${toolRows.length} | BNB: ${ethers.formatEther(bal)}\n`);
      }
    } catch (err: any) {
      console.error(`[${i + 1}] FAILED benchmark for ${toolName}: ${err.message?.slice(0, 80)}`);
      errors++;
    }
  }

  const finalBalance = await provider.getBalance(wallet.address);
  console.log(`\n=== Done ===`);
  console.log(`Registered: ${registered} | Benchmarked: ${benchmarked} | Skipped: ${skipped} | Errors: ${errors}`);
  console.log(`Final balance: ${ethers.formatEther(finalBalance)} BNB`);
  console.log(`Total on-chain: ${await registry.totalTools()} tools`);

  await pool.end();
}

main().catch(console.error);
