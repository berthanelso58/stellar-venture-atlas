import { useState } from "react";
import { useRoute } from "wouter";
import { 
  useListTasks, 
  useCreateTask, 
  useUpdateTask, 
  useListMilestones,
  useListPlayers,
  useListKpis,
  getListTasksQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { TaskStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GameLayout from "./layout";

export default function Tasks() {
  const [match, params] = useRoute("/game/:gameId/tasks");
  const gameId = Number(params?.gameId);
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useListTasks(gameId, { query: { enabled: !!gameId, queryKey: getListTasksQueryKey(gameId) } });
  const { data: milestones = [] } = useListMilestones(gameId, { query: { enabled: !!gameId } });
  const { data: players = [] } = useListPlayers(gameId, { query: { enabled: !!gameId } });
  const { data: kpis = [] } = useListKpis(gameId, { query: { enabled: !!gameId } });

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const columns: { id: TaskStatus; label: string }[] = [
    { id: "plan", label: "Plan" },
    { id: "doing", label: "Doing" },
    { id: "check", label: "Check" },
    { id: "next_plan", label: "Next Plan" },
  ];

  const getPriorityColor = (priority?: string) => {
    switch(priority) {
      case "low": return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "medium": return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      case "high": return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case "critical": return "text-red-500 bg-red-500/10 border-red-500/20 animate-pulse";
      default: return "text-muted-foreground bg-muted border-border";
    }
  };

  const handleStatusChange = (taskId: number, newStatus: TaskStatus) => {
    updateTask.mutate({ gameId, taskId, data: { status: newStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(gameId) });
      }
    });
  };

  return (
    <GameLayout>
      <div className="p-6 h-[calc(100vh-3.5rem)] flex flex-col">
        <header className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold font-serif text-foreground">Mission Tasks</h1>
        </header>
        <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="bg-card/30 border border-border/50 rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{col.label}</h2>
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{colTasks.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {colTasks.map(task => {
                    const assignee = players.find(p => p.id === task.assignedPlayerId);
                    const kpi = kpis.find(k => k.name === task.kpiImpact);
                    return (
                      <div key={task.id} className="bg-card border border-border rounded-lg p-3 shadow-sm hover:border-primary/50 transition-colors group relative">
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-sm font-medium pr-6">{task.title}</div>
                          {task.priority && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold tracking-wide ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          )}
                        </div>
                        {col.id === "check" && task.kpiImpact && (
                          <div className="mb-2 text-xs flex items-center gap-1.5 text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                            {task.kpiImpact}
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-3">
                          {assignee ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full" style={{ backgroundColor: assignee.avatarColor }} />
                              <span className="text-xs text-muted-foreground">{assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Unassigned</span>
                          )}
                          
                          <select 
                            className="text-xs bg-transparent border-none text-muted-foreground focus:ring-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                          >
                            {columns.map(c => <option key={c.id} value={c.id} className="bg-background text-foreground">{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GameLayout>
  );
}
