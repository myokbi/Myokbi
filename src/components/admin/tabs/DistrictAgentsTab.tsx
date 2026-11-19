import React, { useMemo, useState } from 'react';
import {
  MapPin,
  Phone,
  Plus,
  Save,
  Search,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { AdminOverviewResponse, DistrictAgentItem } from '../../../types';

interface DistrictAgentsTabProps {
  overview: AdminOverviewResponse;
  onRefresh: () => Promise<void>;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function DistrictAgentsTab({ overview, onRefresh, showToast }: DistrictAgentsTabProps) {
  const [agents, setAgents] = useState<DistrictAgentItem[]>(overview.districtAgents || []);
  const [search, setSearch] = useState('');
  const [newDistrict, setNewDistrict] = useState('');
  const [newAgent, setNewAgent] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(
      (a) =>
        a.district.toLowerCase().includes(q) ||
        a.agent.toLowerCase().includes(q) ||
        (a.phone && a.phone.toLowerCase().includes(q))
    );
  }, [agents, search]);

  async function handleAddAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!newDistrict.trim() || !newAgent.trim()) return;

    const newEntry: DistrictAgentItem = {
      id: `AGT-${Date.now()}`,
      district: newDistrict.trim(),
      agent: newAgent.trim(),
      phone: newPhone.trim() || '+880 1700-000000',
      active: true,
    };

    const updated = [newEntry, ...agents];
    setAgents(updated);
    setBusy(true);

    try {
      await apiRequest('/api/admin/districts', {
        method: 'PUT',
        body: JSON.stringify({ districts: updated }),
      });
      setNewDistrict('');
      setNewAgent('');
      setNewPhone('');
      showToast('ok', `District agent for ${newEntry.district} added.`);
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to add district agent.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAgent(id: string) {
    if (!confirm('Are you sure you want to delete this district agent?')) return;
    const updated = agents.filter((a) => a.id !== id);
    setAgents(updated);
    try {
      await apiRequest('/api/admin/districts', {
        method: 'PUT',
        body: JSON.stringify({ districts: updated }),
      });
      showToast('ok', 'District agent removed.');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to remove agent.');
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    const updated = agents.map((a) => (a.id === id ? { ...a, active: !currentActive } : a));
    setAgents(updated);
    try {
      await apiRequest('/api/admin/districts', {
        method: 'PUT',
        body: JSON.stringify({ districts: updated }),
      });
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to update agent.');
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">64-District Agent Network</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage official district agents for localized member cashout settlements across Bangladesh.
          </p>
        </div>

        <span className="text-xs font-mono-num text-slate-500">
          {agents.length} District Agents Assigned
        </span>
      </div>

      {/* Add New District Agent Form */}
      <div className="surface-card p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">Assign New District Agent</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Add a newly appointed agent with their assigned district name and official WhatsApp/helpline phone number.
          </p>
        </div>

        <form onSubmit={handleAddAgent} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">District Name</label>
              <input
                type="text"
                required
                value={newDistrict}
                onChange={(e) => setNewDistrict(e.target.value)}
                placeholder="e.g. ঢাকা or Chattogram"
                className="input-atelier text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Agent Full Name</label>
              <input
                type="text"
                required
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                placeholder="e.g. Tanvir Ahmed"
                className="input-atelier text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Official Contact Phone</label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+880 1700-000000"
                className="input-atelier text-xs font-mono-num"
              />
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
            <span>{busy ? 'Saving...' : 'Add District Agent'}</span>
          </button>
        </form>
      </div>

      {/* Search Input */}
      <div className="surface-card p-3 flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search district or agent name..."
            className="input-atelier pl-9 text-xs"
          />
        </div>
      </div>

      {/* Agents Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="px-3.5 py-2.5">District</th>
                <th className="px-3.5 py-2.5">Agent Name</th>
                <th className="px-3.5 py-2.5">Contact Number</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id || item.district} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3.5 py-2.5 font-bold text-slate-900">
                    {item.district}
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-800">
                    {item.agent}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono-num text-slate-600">
                    {item.phone || 'Available in chat'}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span
                      className={`font-semibold text-[11px] ${
                        item.active !== false ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {item.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item.id, item.active !== false)}
                        className="px-2 py-0.5 text-xs font-semibold rounded border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {item.active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAgent(item.id)}
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
