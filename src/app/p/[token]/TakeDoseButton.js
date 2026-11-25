'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function TakeDoseButton({ token, medicationId, at }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function take() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/portal/${token}/doses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationId, at }),
      });
      if (!response.ok) {
        setError((await response.json().catch(() => ({}))).error ?? 'Could not save. Try again.');
        setSaving(false);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError('No connection. Try again.');
      setSaving(false);
    }
  }

  return (
    <div style={{ textAlign: 'right' }}>
      <button type="button" className="button primary take" onClick={take} disabled={saving}>
        {saving ? 'Saving…' : 'I took it'}
      </button>
      {error && (
        <p role="alert" className="field-error" style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}
