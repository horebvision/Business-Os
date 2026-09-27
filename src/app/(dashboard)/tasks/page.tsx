'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Task, TaskPriority, TaskStatus } from '@/lib/types';
import { CheckSquare, Plus, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import QuickActionModal from '@/components/layout/QuickActionModal';

export default function TasksPage() {
  const { currentCompany } = useAuth();
  const supabase = createClient();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchTasks = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('*, customer:customers(name)')
      .eq('company_id', currentCompany.id)
      .order('due_date', { ascending: true });

    if (data) setTasks(data as Task[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, [currentCompany?.id]);

  const toggleTaskStatus = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'Terminée' ? 'À faire' : 'Terminée';
    await supabase
      .from('tasks')
      .update({
        status: newStatus,
        completed_at: newStatus === 'Terminée' ? new Date().toISOString() : null,
      })
      .eq('id', task.id);

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'Urgente':
        return 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-500/20';
      case 'Haute':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-500/20';
      case 'Normale':
        return 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500/20';
      default:
        return 'text-slate-600 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tâches
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérez vos priorités du jour et attribuez les tâches à vos collaborateurs.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle tâche</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-indigo-500 mb-2" />
          <span className="text-xs">Chargement des tâches...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <CheckSquare className="w-10 h-10 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aucune tâche enregistrée</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Planifiez vos actions ou laissez l&apos;assistant IA créer vos tâches automatiquement.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-indigo-500"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter une tâche</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isCompleted = task.status === 'Terminée';
            return (
              <div
                key={task.id}
                className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all flex items-center justify-between gap-4 shadow-sm ${
                  isCompleted
                    ? 'border-slate-200 dark:border-slate-800 opacity-60'
                    : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/40'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <button
                    onClick={() => toggleTaskStatus(task)}
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors flex-shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500'
                    }`}
                  >
                    {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>

                  <div className="min-w-0">
                    <h4
                      className={`text-xs font-bold truncate ${
                        isCompleted
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {task.customer && (
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Client : {task.customer.name}
                    </span>
                  )}
                  {task.due_date && (
                    <span className="text-[11px] text-slate-500 font-medium">
                      📅 {task.due_date}
                    </span>
                  )}
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityBadge(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <QuickActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchTasks}
      />
    </div>
  );
}
