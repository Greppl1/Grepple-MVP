import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const report = await req.json();

    if (!report.report_id || !report.tool_name || !report.metrics) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: report_id, tool_name, metrics" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const callability = report.metrics.callability || {};
    const schema = report.metrics.schema || {};
    const diagnosis = report.diagnosis || {};

    const testsRun = callability.tests_run || 1;
    const invokeRate = Math.round(((callability.invoke_count || 0) / testsRun) * 100);
    const mentionRate = Math.round(((callability.mention_count || 0) / testsRun) * 100);
    const silentRate = Math.round(((callability.silent_count || 0) / testsRun) * 100);
    const errorRate = Math.round(((callability.error_count || 0) / testsRun) * 100);

    // Find tool_id by name (nullable)
    const { data: toolData } = await supabase
      .from("tools")
      .select("id")
      .eq("tool_name", report.tool_name)
      .limit(1)
      .single();

    // Check duplicate
    const { data: existing } = await supabase
      .from("diagnostic_reports")
      .select("id")
      .eq("report_id", report.report_id)
      .limit(1)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Report already exists", report_id: report.report_id }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insertError } = await supabase.from("diagnostic_reports").insert({
      tool_id: toolData?.id || null,
      report_id: report.report_id,
      model_id: report.model_id || null,
      failure_mode: diagnosis.failure_mode || null,
      invoke_rate: invokeRate,
      mention_rate: mentionRate,
      silent_rate: silentRate,
      error_rate: errorRate,
      required_field_count: schema.required_fields ?? null,
      total_field_count: schema.total_fields ?? null,
      nesting_depth: schema.nesting_depth ?? null,
      has_defaults: schema.has_defaults ? 1 : 0,
      full_report: JSON.stringify(report),
    });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Insert failed", detail: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        status: "stored",
        report_id: report.report_id,
        tool_name: report.tool_name,
        tool_id: toolData?.id || null,
        failure_mode: diagnosis.failure_mode || null,
        rates: { invokeRate, mentionRate, silentRate, errorRate },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
