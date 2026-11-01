/**
 * The Editor's undo history: snapshots of an immutable value, one per undo step.
 * A change can be previewed (shown, but not yet a step) before it's committed,
 * so a picker drag or a gesture becomes one step however many frames it has.
 */
export interface History<T> {
  /** The current value, including any preview. */
  readonly present: T;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Shows `next` without recording a step yet. */
  preview(next: T): void;
  /**
   * Makes `next` current and records everything since the last step as one
   * step, unless `next` equals the value as of the last step.
   */
  commit(next: T): void;
  undo(): void;
  redo(): void;
}

export function createHistory<T>(initial: T, equals: (a: T, b: T) => boolean): History<T> {
  /** The value as of the latest step; differs from `present` while previewing. */
  let committed = initial;
  let present = initial;
  const past: T[] = [];
  const future: T[] = [];

  /** A preview that's still showing becomes its own step before undo or redo. */
  function settle() {
    history.commit(present);
  }

  const history: History<T> = {
    get present() {
      return present;
    },
    get canUndo() {
      return past.length > 0 || !equals(present, committed);
    },
    get canRedo() {
      return future.length > 0 && equals(present, committed);
    },
    preview(next) {
      present = next;
    },
    commit(next) {
      if (equals(next, committed)) {
        present = committed;
        return;
      }
      past.push(committed);
      committed = present = next;
      future.length = 0;
    },
    undo() {
      settle();
      const previous = past.pop();
      if (previous === undefined) return;
      future.push(committed);
      committed = present = previous;
    },
    redo() {
      settle();
      const next = future.pop();
      if (next === undefined) return;
      past.push(committed);
      committed = present = next;
    },
  };
  return history;
}
