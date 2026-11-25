'use client';

import { useId } from 'react';

// A confirmation pop-up in the app's own style, built on the native <dialog> element,
// which gives the dimmed backdrop, Escape to close and keeps keyboard focus inside.
// It sits inside the form it confirms: "confirm" is that form's real submit button,
// so the server action and the pending state work exactly as without a dialog.
//
// confirm = { title, message, confirmLabel, tone: 'danger' | undefined }
export function ConfirmDialog({ ref, confirm }) {
  const titleId = useId();
  const close = () => ref.current?.close();
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) close(); // a click on the backdrop
      }}
    >
      <div className="dialog-body">
        <h2 id={titleId}>{confirm.title}</h2>
        {confirm.message && <p>{confirm.message}</p>}
        <div className="dialog-actions">
          {/* Focus starts on Cancel, so pressing Enter by accident does nothing harmful */}
          <button type="button" className="button" onClick={close} autoFocus>
            Cancel
          </button>
          <button type="submit" className={`button ${confirm.tone === 'danger' ? 'danger' : 'primary'}`} onClick={close}>
            {confirm.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
