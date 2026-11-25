'use client';

import { useActionState } from 'react';
import { CopyLink } from './CopyLink';
import { SubmitButton } from './SubmitButton';

// A single button that runs a server action and shows its result (reset link, run reminders).
// `confirm` (optional) opens a confirmation pop-up first; see ConfirmDialog.
export function ActionButton({ action, label, pendingLabel = 'Working…', confirm }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="action-button">
      <SubmitButton className="button" pendingLabel={pendingLabel} confirm={confirm}>
        {label}
      </SubmitButton>
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
