import React, { useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  ExternalLink,
  ListTodo,
  Plus,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { AdminOverviewResponse, CustomTaskItem } from '../../../types';

interface TasksManagerTabProps {
  overview: AdminOverviewResponse;
  onRefresh: () => Promise<void>;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function TasksManagerTab({ overview, onRefresh, showToast }: TasksManagerTabProps) {
  const customTasks = overview.customTasks || [];
  const [tasksList, setTasksList] = useState<CustomTaskItem[]>(customTasks);
  const [category, setCategory] = useState('Data Entry');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [rewardBdt, setRewardBdt] = useState('120');
  const [sheetUrl, setSheetUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const CATEGORIES = [
    'Data Entry',
    'SEO',
    'Social Marketing',
    'Captcha Join',
    'Traffic Analyze',
    'Email Marketing',
    'Social Ad Manager',
    'Git Create',
  ];

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: CustomTaskItem = {
      id: `TSK-${Date.now()}`,
      category,
      title: title.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      rewardBdt: Number(rewardBdt || 120),
      sheetUrl: sheetUrl.trim() || undefined,
      active: true,
      createdAt: Date.now(),
    };

    const updated = [newTask, ...tasksList];
    setTasksList(updated);
    setBusy(true);

    try {
      await apiRequest('/api/admin/tasks', {
        method: 'PUT',
        body: JSON.stringify({ tasks: updated }),
      });
      setTitle('');
      setDescription('');
      setInstructions('');
      setSheetUrl('');
      showToast('ok', 'Task job created and published live to members!');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to publish task.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleTask(id: string, currentActive: boolean) {
    const updated = tasksList.map((t) => (t.id === id ? { ...t, active: !currentActive } : t));
    setTasksList(updated);
    try {
      await apiRequest('/api/admin/tasks', {
        method: 'PUT',
        body: JSON.stringify({ tasks: updated }),
      });
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to update task.');
    }
  }

  async function handleDeleteTask(id: string) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    const updated = tasksList.filter((t) => t.id !== id);
    setTasksList(updated);
    try {
      await apiRequest('/api/admin/tasks', {
        method: 'PUT',
        body: JSON.stringify({ tasks: updated }),
      });
      showToast('ok', 'Task deleted.');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to delete task.');
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Tasks & Jobs Management Workspace</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Publish daily Google Sheet assignments, SEO jobs, social promotion, and data verification tasks with custom BDT rewards.
          </p>
        </div>

        <span className="text-xs font-mono-num text-slate-500">
          {tasksList.length} total tasks published
        </span>
      </div>

      {/* Create New Task Form */}
      <div className="surface-card p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Publish New Member Task / Job Offer</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Members will see this job inside My.Jobs and All Tasks, and will be able to submit their work URL for your review.
          </p>
        </div>

        <form onSubmit={handleCreateTask} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Task Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-atelier text-xs"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Task Title / Headline</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. গুগল শিট ডাটা এন্ট্রি ব্যাচ #২৪"
                className="input-atelier text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Template / Google Sheet URL (Optional)
              </label>
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="input-atelier text-xs font-mono-num"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Reward per Submission (BDT)</label>
              <input
                type="number"
                required
                value={rewardBdt}
                onChange={(e) => setRewardBdt(e.target.value)}
                className="input-atelier text-xs font-mono-num"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Brief Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. ৫০টি এন্ট্রি সম্পূর্ণ করে ভেরিফাইড শিট লিংক সাবমিট করুন।"
              className="input-atelier text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Submission Instructions</label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. টেমপ্লেট কপি করে ডাটা পূরণ করুন। ফাইল 'Anyone with the link can view' দিয়ে শেয়ার লিংক দিন।"
              className="input-atelier text-xs"
            />
          </div>

          <button type="submit" disabled={busy} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
            <span>{busy ? 'Publishing...' : 'Publish Task Live'}</span>
          </button>
        </form>
      </div>

      {/* Task List */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-3.5 py-2.5">Category & Title</th>
                <th className="px-3.5 py-2.5">Instructions</th>
                <th className="px-3.5 py-2.5 text-right">Reward</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasksList.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3.5 py-2.5">
                    <div className="font-semibold text-slate-900">{t.title}</div>
                    <div className="text-[11px] text-slate-500 font-mono-num flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-emerald-800">{t.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.id}</span>
                    </div>
                  </td>

                  <td className="px-3.5 py-2.5 max-w-[320px]">
                    <p className="text-slate-700 truncate" title={t.description || t.instructions}>
                      {t.description || t.instructions || 'Standard assignment'}
                    </p>
                    {t.sheetUrl && (
                      <a
                        href={t.sheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline mt-0.5"
                      >
                        <span>Template Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>

                  <td className="px-3.5 py-2.5 text-right font-mono-num font-bold text-emerald-700">
                    {t.rewardBdt} ৳
                  </td>

                  <td className="px-3.5 py-2.5">
                    <span
                      className={`font-semibold text-[11px] ${
                        t.active ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {t.active ? 'Active' : 'Paused'}
                    </span>
                  </td>

                  <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(t.id, t.active)}
                        className="px-2 py-0.5 text-xs font-semibold rounded border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {t.active ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(t.id)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
