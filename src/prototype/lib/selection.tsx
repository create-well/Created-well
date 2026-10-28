import React, { createContext, useContext } from 'react';

export interface Selection {
  source: string;
  id: string;
}

export interface SelectionApi {
  selected: Selection | null;
  /** Jump to a row: switches to the owning source's home view and selects the row. */
  jumpTo: (source: string, id: string) => void;
  clear: () => void;
}

export const SelectionContext = createContext<SelectionApi>({
  selected: null,
  jumpTo: () => {},
  clear: () => {},
});

export function useSelection(): SelectionApi {
  return useContext(SelectionContext);
}

/** Where a source's rows "live" for jump purposes. Flows and events surface
    on Home (the rim) now; moves live in Tasks under their presentation
    label, with MOVES still the source name underneath. */
export const SOURCE_HOME: Record<string, string> = {
  PEOPLE: 'people',
  FLOWS: 'home',
  MOVES: 'tasks',
  CONTENT: 'content',
  MONEY: 'money',
  EVENTS: 'home',
  FEEDBACK: 'intake',
  'SYNC LEDGER': 'sync',
  'OPEN ASKS': 'home',
};

export type JumpFn = (source: string, id: string) => void;
