import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

export function SyncRefreshButton() {
  const { data, actions } = useDashboard();
  const { syncStatus, lastSynced } = data;
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    if (syncing) return;
    setSyncing(true);
    try {
      if ('refreshSync' in actions && typeof (actions as any).refreshSync === 'function') {
        await (actions as any).refreshSync(true);
      } else {
        actions.retrySync();
      }
    } catch (err) {
      console.error('[Sync] Refresh error:', err);
    } finally {
      setSyncing(false);
    }
  }

  const isSpinning = syncing || syncStatus === 'loading';

  return (
    <div className="flex items-center gap-2 text-xs text-stone-500">
      <button
        onClick={handleRefresh}
        disabled={isSpinning}
        title="Sync Notion & Supabase data"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 transition cursor-pointer"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin text-[#C25B38]' : ''}`} />
        <span>{isSpinning ? 'Syncing…' : 'Sync Notion'}</span>
      </button>
      {lastSynced && (
        <span className="hidden sm:inline text-[10px] opacity-75">
          {new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}
