/**
 * Import benchmark JSON → SQLite + on-chain contract
 *
 * Usage:
 *   npx tsx src/import-benchmark.ts                           # DB only
 *   npx tsx src/import-benchmark.ts --on-chain                # DB + on-chain
 *   npx tsx src/import-benchmark.ts --file my_benchmark.json  # custom file
 */

import { initDb, importToolsJson, importBenchmarkJson, getDb } from "./db";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", "..", "contracts", ".env") });

const args = process.argv.slice(2);
const onChain = args.includes("--on-chain");
const fileIdx = args.indexOf("--file");
const filename = fileIdx !== -1 ? args[fileIdx + 1] : "cross_model_benchmark_trial.json";

async function main() {
  // 1. Init DB + import tools if needed
  initDb();
  importToolsJson();

  // 2. Import benchmark into SQLite
  importBenchmarkJson(filename);

  if (!onChain) {
    console.log("\nDone (DB only). Use --on-chain to also write to contract.");
    return;
  }

  // 3. Write to on-chain contract
  console.log("\n--- Writing to on-chain contract ---");

  const rpc = process.env.BSC_TESTNET_RPC;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const proxyAddress = "0xA4DD665e9F1F57080C01fD83d48d1485Fae09c01";

  if (!rpc || !privateKey) {
    console.error("Missing BSC_TESTNET_RPC or DEPLOYER_PRIVATE_KEY in contracts/.env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(privateKey, provider);

  const abi = [
    "function registerTool(bytes32,bytes32,uint16,uint8,uint8,uint8,uint8,bool,string,bytes32) external",
    "function batchRecordBenchmarkRuns(bytes32,bytes32[],uint8[],uint8[],uint8[],uint8[],bool[],bool[],string) external",
    "function getTool(bytes32) view returns (tuple(bytes32,uint16,uint8,uint8,uint8,uint8,bool,string,bytes32,uint64,uint64,address,bool,bool))",
    "function computeToolId(string,string) pure returns (bytes32)",
    "function computeModelId(string) pure returns (bytes32)",
    "function computeClusterId(string) pure returns (bytes32)",
  ];

  const contract = new ethers.Contract(proxyAddress, abi, wallet);

  // Load benchmark JSON
  const jsonPath = path.join(__dirname, "..", "data", filename);
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const failureModeMap: Record<string, number> = {
    healthy: 0, schema_failure: 1, description_failure: 2,
    compatibility_failure: 3, mixed: 4,
  };

  let registered = 0;
  let benchmarked = 0;
  let skipped = 0;

  for (const tool of data.tools) {
    const toolId = tool.toolId as string;
    const clusterId = ethers.keccak256(ethers.toUtf8Bytes(tool.cluster));

    // Check if tool already registered
    try {
      const existing = await contract.getTool(toolId);
      if (existing[12]) { // exists field
        console.log(`  [skip] ${tool.name} — already registered`);
        skipped++;
      } else {
        throw new Error("not registered");
      }
    } catch {
      // Register tool
      const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({
        name: tool.name,
        mcpServerUrl: tool.mcpServerUrl,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })));

      const fm = failureModeMap[tool.diagnosis?.failureMode] ?? 0;
      const sm = tool.schemaMetrics;

      try {
        const tx = await contract.registerTool(
          toolId,
          clusterId,
          tool.clusterPoolSize || 0,
          fm,
          sm?.requiredFields ?? 0,
          sm?.totalFields ?? 0,
          sm?.nestingDepth ?? 0,
          sm?.hasDefaults ?? false,
          tool.mcpServerUrl || "",
          metadataHash
        );
        await tx.wait();
        registered++;
        console.log(`  [registered] ${tool.name}`);
      } catch (err: any) {
        console.error(`  [error] registerTool ${tool.name}: ${err.message?.slice(0, 80)}`);
      }
    }

    // Record benchmark runs for each model
    const models = Object.keys(tool.modelResults || {});
    if (models.length === 0) continue;

    const modelIds = models.map(m => ethers.keccak256(ethers.toUtf8Bytes(m)));
    const invokeRates = models.map(m => tool.modelResults[m].invokeRate);
    const mentionRates = models.map(m => tool.modelResults[m].mentionRate);
    const silentRates = models.map(m => tool.modelResults[m].silentRate);
    const errorRates = models.map(m => tool.modelResults[m].errorRate);
    const strictVals = models.map(m => tool.modelResults[m].errorRate === 0);
    const under128s = models.map(() => (tool.clusterPoolSize || 0) <= 128);

    try {
      const tx = await contract.batchRecordBenchmarkRuns(
        toolId, modelIds, invokeRates, mentionRates, silentRates,
        errorRates, strictVals, under128s,
        tool.benchmarkMeta?.benchmarkVersion || "v3-trial"
      );
      await tx.wait();
      benchmarked++;
      console.log(`  [benchmark] ${tool.name} — ${models.length} models`);
    } catch (err: any) {
      console.error(`  [error] benchmark ${tool.name}: ${err.message?.slice(0, 80)}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone: ${registered} registered, ${benchmarked} benchmarked, ${skipped} skipped`);
}

main().catch(console.error);
