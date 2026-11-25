'use client';

import { useFormStatus } from 'react-dom';

// Submit button for the small server-rendered forms (Sign out, Stop, Record as taken…).
// It disables itself and changes its label while the server action runs, and can ask
// for confirmation first.
export function SubmitButton({ children, pendingLabel = 'Saving…', confirmText, className = 'button small' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
