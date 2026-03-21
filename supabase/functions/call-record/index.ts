import { ethers } from "npm:ethers@6";
import { corsHeaders } from "../_shared/cors.ts";

const REGISTRY_PROXY = "0xA4DD665e9F1F57080C01fD83d48d1485Fae09c01";
const BSC_TESTNET_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545";
const REGISTRY_ABI = [
  "function getCallRecord(bytes32) external view returns (tuple(bytes32 toolId, address agentWallet, bool success, uint64 timestamp, bool exists))",
  "function verifyCallRecord(bytes32) external view returns (bool)",
  "function computeCallRecordHash(string) external pure returns (bytes32)",
];

const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
const registry = new ethers.Contract(REGISTRY_PROXY, REGISTRY_ABI, provider);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Extract id from URL path or request body
    let id: string;
    if (req.method === "GET") {
      const url = new URL(req.url);
      // Edge Function URL: /call-record?id=xxx
      id = url.searchParams.get("id") || "";
    } else {
      const body = await req.json();
      id = body.id || "";
    }

    if (!id) {
      return new Response(
        JSON.stringify({ error: "Missing id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Determine if id is already a bytes32 hash or a string call_record_id
    let callRecordHash: string;
    if (id.startsWith("0x") && id.length === 66) {
      callRecordHash = id;
    } else {
      callRecordHash = await registry.computeCallRecordHash(id);
    }

    const exists = await registry.verifyCallRecord(callRecordHash);
    if (!exists) {
      return new Response(
        JSON.stringify({ error: "Call record not found", call_record_hash: callRecordHash }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const record = await registry.getCallRecord(callRecordHash);

    return new Response(
      JSON.stringify({
        call_record_id: id,
        call_record_hash: callRecordHash,
        tool_id: record.toolId,
        agent_wallet: record.agentWallet,
        call_success: record.success,
        call_timestamp: new Date(Number(record.timestamp) * 1000).toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to query call record", detail: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
