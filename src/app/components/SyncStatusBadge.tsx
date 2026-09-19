import React from 'react';

interface Props {
  notionPageId?: string;
  className?: string;
}

export function SyncStatusBadge({ notionPageId, className = '' }: Props) {
  if (notionPageId) {
    return (
      <span
        title={`Synced to Notion page ${notionPageId}`}
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 ${className}`}
      >
        Notion Synced
      </span>
    );
  }

  return (
    <span
      title="Saved locally in Supabase KV store"
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400 ${className}`}
    >
      Local KV
    </span>
  );
}
