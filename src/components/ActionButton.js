'use client';

import { useActionState } from 'react';
import { CopyLink } from './CopyLink';

// A single button that runs a server action and shows its result (reset link, run reminders).
export function ActionButton({ action, label, pendingLabel = 'Working…', confirmText }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className="action-button"
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <button type="submit" className="button" disabled={pending}>
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <p role="alert" className="alert alert-error">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="alert alert-ok">
          {state.message}
        </p>
      )}
      {state.ok && state.link && <CopyLink link={state.link} />}
    </form>
  );
}
