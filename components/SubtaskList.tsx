"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, X } from "lucide-react";
import { useSubtasks } from "@/hooks/useSubtasks";
import { useToast } from "@/components/hooks/use-toast";

// AI Task Breakdown: OpenAI splits the task into steps, saved in the
// subtasks table, which the user can tick off one by one.
export default function SubtaskList({ taskId }: { taskId: string }) {
  const {
    subtasks,
    isLoading,
    isGenerating,
    error,
    generateSubtasks,
    toggleSubtask,
    deleteSubtask,
  } = useSubtasks(taskId);
  const { toast } = useToast();

  const doneCount = subtasks.filter((s) => s.completed).length;

  const handleGenerate = async () => {
    try {
      await generateSubtasks();
      toast({
        title: "✨ Task broken down",
        description: "AI created steps for this task",
      });
    } catch (e: any) {
      toast({
        title: "❌ Breakdown failed",
        description: e.message || "Could not break down the task",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid w-full items-center gap-2 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">AI Task Breakdown</Label>
        {subtasks.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {doneCount} / {subtasks.length} steps done
          </span>
        )}
      </div>

      {subtasks.length > 0 && (
        <div className="h-2 w-full rounded bg-gray-200">
          <div
            className="h-2 rounded bg-green-500 transition-all"
            style={{ width: `${(doneCount / subtasks.length) * 100}%` }}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading steps...</p>
      ) : subtasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No steps yet. Let AI split this task into small, concrete steps.
        </p>
      ) : (
        <ul className="space-y-2">
          {subtasks.map((s) => (
            <li key={s.subtask_id} className="flex items-center gap-2">
              <Checkbox
                checked={s.completed}
                onCheckedChange={() => toggleSubtask(s)}
              />
              <span
                className={
                  s.completed ? "flex-1 line-through text-muted-foreground" : "flex-1"
                }
              >
                {s.title}
              </span>
              <button
                type="button"
                aria-label="Delete step"
                className="text-gray-400 hover:text-red-500"
                onClick={() => deleteSubtask(s.subtask_id)}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button
        type="button"
        variant="outline"
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {isGenerating
          ? "Breaking down..."
          : subtasks.length > 0
          ? "Regenerate steps with AI"
          : "Break down with AI"}
      </Button>
    </div>
  );
}
