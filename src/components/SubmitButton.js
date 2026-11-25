'use client';

import { useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { ConfirmDialog } from './ConfirmDialog';

// Submit button for the small server-rendered forms (Sign out, Stop, Record as taken…).
// It disables itself and changes its label while the server action runs. With `confirm`,
// it first opens a confirmation pop-up, and the pop-up's button submits the form.
export function SubmitButton({ children, pendingLabel = 'Saving…', confirm, className = 'button small' }) {
  const { pending } = useFormStatus();
  const dialog = useRef(null);
  const label = pending ? pendingLabel : children;

  if (!confirm) {
    return (
      <button type="submit" className={className} disabled={pending} aria-busy={pending || undefined}>
        {label}
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending}
        aria-busy={pending || undefined}
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>
      <ConfirmDialog ref={dialog} confirm={confirm} />
    </>
  );
}
