// Task-App Improvements: AI Task Breakdown.
//
// Asks OpenAI to split one task into 3-6 concrete steps and saves them in the
// subtasks table. Calling it again for the same task replaces the earlier
// AI-written steps.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai";
import { SUPABASE_PUBLISHABLE_KEY } from "../_shared/supabaseKeys.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = "gpt-4o-mini";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { task_id } = await req.json();
    if (!task_id) throw new Error("task_id is required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    // Acts as the signed-in user, so Row Level Security applies.
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No user found");

    // RLS returns the task only if it belongs to this user.
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("task_id, title, description")
      .eq("task_id", task_id)
      .single();
    if (taskError || !task) throw new Error("Task not found");

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.4,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You help people get tasks done by breaking each task into small, concrete next steps. " +
            'Reply with JSON only, in the form {"steps": ["...", "..."]}.',
        },
        {
          role: "user",
          content: `Break this to-do list task into 3 to 6 short, concrete steps, in the order they should be done.
Each step starts with a verb and is at most 12 words.

Task title: "${task.title}"
Task description: "${task.description ?? ""}"`,
        },
      ],
    });

    const raw = completion.choices[0].message.content ?? "{}";
    console.log("🧩 AI breakdown reply:", raw);

    let steps: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.steps)) {
        steps = parsed.steps
          .filter((s: unknown) => typeof s === "string")
          .map((s: string) => s.trim().slice(0, 200))
          .filter((s: string) => s.length > 0)
          .slice(0, 6);
      }
    } catch {
      // Handled below: no valid steps.
    }
    if (steps.length === 0) throw new Error("The AI did not return any steps");

    // Replace the earlier AI-written steps for this task.
    const { error: deleteError } = await supabase
      .from("subtasks")
      .delete()
      .eq("task_id", task_id)
      .eq("ai_generated", true);
    if (deleteError) throw deleteError;

    const rows = steps.map((title, i) => ({
      task_id,
      user_id: user.id,
      title,
      position: i + 1,
      ai_generated: true,
    }));

    const { data: subtasks, error: insertError } = await supabase
      .from("subtasks")
      .insert(rows)
      .select()
      .order("position");
    if (insertError) throw insertError;

    console.log(`✅ Saved ${subtasks?.length ?? 0} subtasks for task ${task_id}`);
    return jsonResponse({ subtasks });
  } catch (error) {
    const message = (error as { message?: string })?.message ?? String(error);
    console.error("Error in break-down-task:", message);
    return jsonResponse({ error: message }, 400);
  }
});
