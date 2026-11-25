import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

// One step of a task, stored in the subtasks table (migration 9_subtasks.sql).
export type Subtask = {
  subtask_id: string;
  task_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  position: number;
  ai_generated: boolean;
  created_at: string | null;
};

const BREAKDOWN_ENDPOINT = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/break-down-task`;

export function useSubtasks(taskId?: string) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      ),
    []
  );

  const fetchSubtasks = useCallback(async () => {
    if (!taskId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("position");
    if (error) setError(error.message);
    else setSubtasks((data ?? []) as Subtask[]);
    setIsLoading(false);
  }, [supabase, taskId]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  // Ask OpenAI (through the break-down-task Edge Function) for new steps.
  const generateSubtasks = async () => {
    if (!taskId) return;
    setIsGenerating(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(BREAKDOWN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({ task_id: taskId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Failed to break down task");
      setSubtasks(body.subtasks as Subtask[]);
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    const completed = !subtask.completed;
    setSubtasks((list) =>
      list.map((s) => (s.subtask_id === subtask.subtask_id ? { ...s, completed } : s))
    );
    const { error } = await supabase
      .from("subtasks")
      .update({ completed })
      .eq("subtask_id", subtask.subtask_id);
    if (error) {
      setError(error.message);
      fetchSubtasks();
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    setSubtasks((list) => list.filter((s) => s.subtask_id !== subtaskId));
    const { error } = await supabase.from("subtasks").delete().eq("subtask_id", subtaskId);
    if (error) {
      setError(error.message);
      fetchSubtasks();
    }
  };

  return {
    subtasks,
    isLoading,
    isGenerating,
    error,
    generateSubtasks,
    toggleSubtask,
    deleteSubtask,
  };
}
