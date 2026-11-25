'use client';

import { useState } from 'react';

export function CopyLink({ link }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-link">
      <p>
        <strong>Patient&apos;s private link</strong> (shown only now, we keep no copy of it):
      </p>
      <div className="copy-row">
        <input readOnly value={link} aria-label="Portal link" onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="button"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
