import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ActionItem } from './data';
import { showToast } from './Toast';
import {
  initialMoveFormValues,
  isMoveFormDirty,
  validateMoveForm,
  classifyCreateError,
  moveFormReducer,
  initialMoveFormState,
  canSubmitMoveForm,
  moveFormCloseIntent,
  type MoveFormValues,
  type MoveFormErrors,
} from '../../lib/moveForm';

interface AddTaskModalProps {
  currentPerson: string | null;
  onAdd: (item: Omit<ActionItem, 'id' | 'created_at'>) => Promise<void>;
  onReconcile?: () => void | Promise<void>;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Move form interaction contract (Move QA acceptance contract, Phase B):
// genuine modal semantics with trapped focus and an inert background,
// in-place validation, a discard confirmation for dirty forms, and an
// async submit lifecycle — the form closes only after the create is
// confirmed; failures keep the form and its values, split into definite
// rejections (safe retry) and unknown outcomes (reconcile before retry).
// All decidable logic lives in src/lib/moveForm.ts.
export function AddTaskModal({ currentPerson, onAdd, onReconcile, onClose }: AddTaskModalProps) {
  const uid = React.useId().replace(/[^A-Za-z0-9_-]/g, '');
  const initial = useMemo(() => initialMoveFormValues(currentPerson || 'monny'), [currentPerson]);
  const [values, setValues] = useState<MoveFormValues>(initial);
  const [errors, setErrors] = useState<MoveFormErrors>({});
  const [formState, dispatch] = useReducer(moveFormReducer, initialMoveFormState);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(false);
  const [hasReconciled, setHasReconciled] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const phase = formState.phase;
  const submitting = phase === 'submitting';
  const dirty = isMoveFormDirty(values, initial);

  const ids = {
    title: `${uid}-dialog-title`,
    fieldTitle: `${uid}-title`,
    titleError: `${uid}-title-error`,
    person: `${uid}-person`,
    priority: `${uid}-priority`,
    dueDate: `${uid}-due-date`,
    source: `${uid}-source`,
    category: `${uid}-category`,
  };

  // Mount: inert the app behind the dialog, focus the first field, and
  // restore focus to the invoking control on unmount.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    titleInputRef.current?.focus();
    return () => {
      root?.removeAttribute('inert');
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (!submitting) setPendingNotice(false);
  }, [submitting]);

  useEffect(() => {
    if (phase === 'failed-definite' || phase === 'failed-unknown') alertRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (confirmDiscard) keepEditingRef.current?.focus();
  }, [confirmDiscard]);

  function updateField<K extends keyof MoveFormValues>(field: K, value: MoveFormValues[K]) {
    setValues(prev => ({ ...prev, [field]: value }));
    if (field === 'title') setErrors(prev => ({ ...prev, title: undefined }));
    dispatch({ type: 'edit' });
  }

  function requestClose() {
    const intent = moveFormCloseIntent(formState, dirty);
    if (intent === 'close') onClose();
    else if (intent === 'confirm-discard') setConfirmDiscard(true);
    else setPendingNotice(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      el => el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitMoveForm(formState)) return;
    const errs = validateMoveForm(values);
    setErrors(errs);
    if (errs.title) {
      titleInputRef.current?.focus();
      return;
    }
    dispatch({ type: 'submit' });
    try {
      await onAdd({
        person: currentPerson || values.person,
        title: values.title.trim(),
        status: 'todo',
        priority: values.priority,
        due_date: values.dueDate,
        source: values.source,
        category: values.category,
      });
      dispatch({ type: 'resolved' });
      showToast('Move added to the board.', 'well');
      onClose();
    } catch (err) {
      dispatch({ type: 'rejected', kind: classifyCreateError(err) });
    }
  }

  async function handleReconcile() {
    try {
      await onReconcile?.();
    } finally {
      dispatch({ type: 'reconciled' });
      setHasReconciled(true);
    }
  }

  return createPortal(
    <div
      className="modal-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) requestClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={ids.title} ref={dialogRef}>
        <div className="modal-header">
          <h3 id={ids.title}>Drop a Move</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={requestClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor={ids.fieldTitle}>Title</label>
            <input
              id={ids.fieldTitle}
              ref={titleInputRef}
              type="text"
              value={values.title}
              onChange={e => updateField('title', e.target.value)}
              placeholder="What needs to happen?"
              disabled={submitting}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? ids.titleError : undefined}
            />
            {errors.title && (
              <p className="form-error-text" id={ids.titleError}>
                {errors.title}
              </p>
            )}
          </div>
          {!currentPerson && (
            <div className="form-group">
              <label htmlFor={ids.person}>Assigned To</label>
              <select
                id={ids.person}
                value={values.person}
                onChange={e => updateField('person', e.target.value)}
                disabled={submitting}
              >
                <option value="sunshine">☀️ Sunshine</option>
                <option value="monny">🌊 Monny</option>
                <option value="bingle">✨ Bingle</option>
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor={ids.priority}>Priority</label>
              <select
                id={ids.priority}
                value={values.priority}
                onChange={e => updateField('priority', e.target.value as MoveFormValues['priority'])}
                disabled={submitting}
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor={ids.dueDate}>Due Date</label>
              <input
                id={ids.dueDate}
                type="date"
                value={values.dueDate}
                onChange={e => updateField('dueDate', e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor={ids.source}>Source</label>
              <input
                id={ids.source}
                type="text"
                value={values.source}
                onChange={e => updateField('source', e.target.value)}
                placeholder="e.g., behind h0es doors"
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor={ids.category}>Category</label>
              <input
                id={ids.category}
                type="text"
                value={values.category}
                onChange={e => updateField('category', e.target.value)}
                placeholder="e.g., launch, content"
                disabled={submitting}
              />
            </div>
          </div>

          {confirmDiscard ? (
            <div className="move-form-confirm" role="group" aria-label="Discard confirmation">
              <p>Discard this Move? The details you entered will be lost.</p>
              <div className="move-form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  ref={keepEditingRef}
                  onClick={() => {
                    setConfirmDiscard(false);
                    titleInputRef.current?.focus();
                  }}
                >
                  Keep editing
                </button>
                <button type="button" className="btn-danger" onClick={onClose}>
                  Discard
                </button>
              </div>
            </div>
          ) : phase === 'failed-definite' ? (
            <div className="move-form-alert" role="alert" tabIndex={-1} ref={alertRef}>
              <p>
                <strong>That didn’t save.</strong> The board rejected it, so nothing was added. Your
                details are still here.
              </p>
              <div className="move-form-actions">
                <button type="button" className="btn-secondary" onClick={requestClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit btn-inline">
                  Try again
                </button>
              </div>
            </div>
          ) : phase === 'failed-unknown' ? (
            <div className="move-form-alert" role="alert" tabIndex={-1} ref={alertRef}>
              <p>
                <strong>The save didn’t confirm.</strong> It may or may not be on the board. Check
                the board before saving again, so it isn’t added twice.
              </p>
              <div className="move-form-actions">
                <button type="button" className="btn-secondary" onClick={requestClose}>
                  Cancel
                </button>
                <button type="button" className="btn-submit btn-inline" onClick={handleReconcile}>
                  Check the board
                </button>
              </div>
            </div>
          ) : (
            <>
              {hasReconciled && (
                <p className="move-form-notice" role="status">
                  Checked. If the Move isn’t on the board, you can save it now.
                </p>
              )}
              {pendingNotice && submitting && (
                <p className="move-form-notice" role="status">
                  Saving — one moment.
                </p>
              )}
              <span className="visually-hidden" role="status">
                {submitting ? 'Saving your Move' : ''}
              </span>
              <div className="move-form-actions">
                <button type="button" className="btn-secondary" onClick={requestClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit btn-inline" disabled={!canSubmitMoveForm(formState)}>
                  {submitting ? 'Saving…' : 'Add to List ✨'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>,
    document.body,
  );
}
