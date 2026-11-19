import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitPullRequest,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import type { AdminOverviewResponse } from '../../../types';

interface GitHubSyncTabProps {
  overview: AdminOverviewResponse;
  onRefresh: () => Promise<void>;
  showToast: (type: 'ok' | 'err', text: string) => void;
}

export default function GitHubSyncTab({ overview, onRefresh, showToast }: GitHubSyncTabProps) {
  const gh = overview.github;

  const [owner, setOwner] = useState(gh.owner || '');
  const [repo, setRepo] = useState(gh.repo || '');
  const [branch, setBranch] = useState(gh.branch || 'main');
  const [dataPath, setDataPath] = useState(gh.dataPath || 'server-data/myokbi-db.json');
  const [token, setToken] = useState('');
  const [autoSync, setAutoSync] = useState(gh.autoSync);
  const [liveWatch, setLiveWatch] = useState(gh.liveWatch);
  const [commitMessage, setCommitMessage] = useState('');

  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = `${window.location.origin}/api/github/webhook`;

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/admin/github/config', {
        method: 'PUT',
        body: JSON.stringify({
          owner: owner.trim(),
          repo: repo.trim(),
          branch: branch.trim(),
          dataPath: dataPath.trim(),
          autoSync,
          liveWatch,
          token: token.trim() || undefined,
        }),
      });
      setToken('');
      showToast('ok', 'GitHub server configuration saved.');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to save GitHub config.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setBusyAction('test');
    try {
      const res = await apiRequest<{ repo: { fullName: string; private: boolean } }>(
        '/api/admin/github/test',
        { method: 'POST' }
      );
      showToast(
        'ok',
        `Successfully verified GitHub repository: ${res.repo.fullName} (${res.repo.private ? 'Private' : 'Public'})`
      );
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'GitHub test failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePushSnapshot() {
    setBusyAction('push');
    try {
      const res = await apiRequest<{ result: { sha: string } }>('/api/admin/github/push', {
        method: 'POST',
        body: JSON.stringify({ message: commitMessage }),
      });
      setCommitMessage('');
      showToast('ok', `Snapshot pushed to GitHub! (Commit ${res.result.sha.slice(0, 7)})`);
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'GitHub push failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePullSnapshot() {
    if (!confirm('This will replace the current memory/disk database state with the snapshot from your GitHub repository. Proceed?')) {
      return;
    }
    setBusyAction('pull');
    try {
      await apiRequest('/api/admin/github/pull', { method: 'POST' });
      showToast('ok', 'Database restored from GitHub repository successfully!');
      await onRefresh();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'GitHub pull failed.');
    } finally {
      setBusyAction(null);
    }
  }

  function handleCopyWebhook() {
    navigator.clipboard?.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface-card p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">GitHub Server Sync & Storage Backend</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Backs up the entire database state as commit snapshots directly to your personal or organization GitHub repository.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={!gh.configured || busyAction !== null}
            className="btn-secondary btn-sm"
          >
            <span>{busyAction === 'test' ? 'Testing...' : 'Test Connection'}</span>
          </button>
          <button
            type="button"
            onClick={handlePushSnapshot}
            disabled={!gh.configured || busyAction !== null}
            className="btn-primary btn-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{busyAction === 'push' ? 'Pushing...' : 'Push Snapshot'}</span>
          </button>
          <button
            type="button"
            onClick={handlePullSnapshot}
            disabled={!gh.configured || busyAction !== null}
            className="btn-secondary btn-sm"
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            <span>{busyAction === 'pull' ? 'Pulling...' : 'Pull / Restore'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="surface-card p-4">
          <span className="text-slate-500">Repository</span>
          <p className="font-bold font-mono-num text-slate-900 mt-1 truncate">
            {gh.owner && gh.repo ? `${gh.owner}/${gh.repo}` : 'Not configured'}
          </p>
        </div>

        <div className="surface-card p-4">
          <span className="text-slate-500">Target Branch & Path</span>
          <p className="font-semibold font-mono-num text-slate-800 mt-1 truncate">
            {gh.branch} · {gh.dataPath}
          </p>
        </div>

        <div className="surface-card p-4">
          <span className="text-slate-500">Last Synced</span>
          <p className="font-semibold font-mono-num text-slate-800 mt-1">
            {gh.lastSyncAt
              ? new Date(gh.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : 'Never'}
          </p>
        </div>

        <div className="surface-card p-4">
          <span className="text-slate-500">Latest Commit SHA</span>
          <p className="font-semibold font-mono-num mt-1">
            {gh.lastCommitSha ? (
              gh.lastCommitUrl ? (
                <a
                  href={gh.lastCommitUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 hover:underline inline-flex items-center gap-1"
                >
                  <span>{gh.lastCommitSha.slice(0, 7)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span>{gh.lastCommitSha.slice(0, 7)}</span>
              )
            ) : (
              <span className="text-slate-400">None</span>
            )}
          </p>
        </div>
      </div>

      {/* Error Notice if any */}
      {gh.lastError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-mono-num">
          <strong>GitHub Error:</strong> {gh.lastError}
        </div>
      )}

      {/* Configuration Form */}
      <div className="surface-card p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">GitHub Repository & Credentials</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Provide a GitHub Personal Access Token with <code className="text-slate-700 font-mono">repo</code> scope.
          </p>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GitHub Owner / User</label>
              <input
                type="text"
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. armanarif9850"
                className="input-atelier font-mono-num text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Repository Name</label>
              <input
                type="text"
                required
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="e.g. myokbi-server-db"
                className="input-atelier font-mono-num text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
              <input
                type="text"
                required
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="input-atelier font-mono-num text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target JSON Path in Repo</label>
              <input
                type="text"
                required
                value={dataPath}
                onChange={(e) => setDataPath(e.target.value)}
                placeholder="server-data/myokbi-db.json"
                className="input-atelier font-mono-num text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Personal Access Token (PAT)
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={gh.tokenPreview ? `Currently set (${gh.tokenPreview}). Leave empty to keep.` : 'ghp_...'}
              className="input-atelier font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">Auto-Sync on Server Save</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Automatically push snapshot commits to GitHub whenever data changes.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">Live Remote Watcher</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Check GitHub for remote commits every 15s using conditional ETag queries.
                </p>
              </div>
              <input
                type="checkbox"
                checked={liveWatch}
                onChange={(e) => setLiveWatch(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
            </div>
          </div>

          <div>
            <button type="submit" disabled={saving} className="btn-primary btn-sm">
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save GitHub Configuration'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Realtime Webhook Guide Card */}
      <div className="surface-card p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Zero-Latency Realtime GitHub Webhook</h3>
        <p className="text-xs text-slate-500">
          Configure a Webhook in your GitHub repository (<span className="font-mono">Settings &gt; Webhooks</span>) to notify this server instantaneously whenever changes are pushed to GitHub.
        </p>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
          <code className="text-xs font-mono text-slate-800 truncate">{webhookUrl}</code>
          <button
            type="button"
            onClick={handleCopyWebhook}
            className="btn-secondary min-h-[30px] px-2.5 py-1 text-xs shrink-0"
          >
            <Copy className="w-3 h-3" />
            <span>{copiedWebhook ? 'Copied' : 'Copy URL'}</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Set Payload URL to the above link, Content type to <code className="font-mono">application/json</code>, and trigger on <code className="font-mono">Just the push event</code>.
        </p>
      </div>

      {/* Commit History List */}
      <div className="surface-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Recent GitHub Commit Snapshots</h3>
          <span className="text-xs font-mono-num text-slate-500">
            {gh.recentCommits?.length || 0} commits recorded
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {(!gh.recentCommits || gh.recentCommits.length === 0) ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              No commit history loaded yet. Click "Test Connection" to fetch history.
            </p>
          ) : (
            gh.recentCommits.map((c) => (
              <div key={c.sha} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{c.message}</p>
                  <p className="text-[11px] text-slate-400 font-mono-num mt-0.5">
                    by {c.author} · {c.date ? new Date(c.date).toLocaleString() : ''}
                  </p>
                </div>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1 shrink-0"
                >
                  <span>{c.sha.slice(0, 7)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
