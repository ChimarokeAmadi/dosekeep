'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { CopyLink } from './CopyLink';
import { PasswordInput } from './PasswordInput';

// One form component for every form in the app. The server action returns
// { ok, message, error, fields, values, link }, and this shows it next to the inputs.
// Fields are re-keyed after each attempt so typed values come back after an error.
export function FormShell({ action, fields, submitLabel, pendingLabel = 'Saving…', columns = 1 }) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.ok ? {} : (state.values ?? {});

  return (
    <form action={formAction} className="form" noValidate>
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
      {state.ok && state.next && (
        <Link href={state.next.href} className="button">
          {state.next.label}
        </Link>
      )}
      <div className={`fields cols-${columns}`}>
        {fields.map((field) => (
          <Field key={`${field.name}-${state.attempt ?? 0}`} field={field} error={state.fields?.[field.name]} value={values[field.name]} />
        ))}
      </div>
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}

function Field({ field, error, value }) {
  const id = `f-${field.name}`;
  const common = {
    id,
    name: field.name,
    defaultValue: value ?? field.defaultValue,
    required: field.required,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error || field.hint ? `${id}-note` : undefined,
  };
  let input;
  if (field.type === 'select') {
    input = (
      <select {...common}>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else if (field.type === 'password') {
    input = <PasswordInput {...common} autoComplete={field.autoComplete} />;
  } else if (field.type === 'textarea') {
    input = <textarea {...common} rows={3} />;
  } else {
    input = <input {...common} type={field.type ?? 'text'} autoComplete={field.autoComplete} placeholder={field.placeholder} />;
  }

  return (
    <div className={`field ${field.wide ? 'wide' : ''}`}>
      <label htmlFor={id}>
        {field.label}
        {!field.required && <span className="optional"> (optional)</span>}
      </label>
      {input}
      {(error || field.hint) && (
        <small id={`${id}-note`} className={error ? 'field-error' : 'hint'}>
          {error ?? field.hint}
        </small>
      )}
    </div>
  );
}
