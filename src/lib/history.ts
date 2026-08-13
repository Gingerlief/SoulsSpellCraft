
export type History<T> = {
  past: readonly T[];
  future: readonly T[];
};

export const NO_HISTORY: History<never> = { past: [], future: [] };

export const HISTORY_LIMIT = 100;

export function record<T>(history: History<T>, current: T): History<T> {
  if (history.past.length >= HISTORY_LIMIT) {
    history = { ...history, past: [...history.past.slice(1), current], future: [] };
  }else if (history.past.length >0){
    history = { ...history, past: [...history.past, current], future: [] };
  } else{
    history = { ...history, past: [current], future: [] };
  }
  return history;
}

export function undo<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  if (history.past.length === 0) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, current],
    },
    value: history.past[history.past.length - 1],
  };
}

export function redo<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  if (history.future.length === 0) return null;
  return {
    history: {
      past: [...history.past, current],
      future: history.future.slice(0, -1),
    },
    value: history.future[history.future.length - 1],
  };
}
