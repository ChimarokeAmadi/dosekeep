import { z } from 'zod';
import { AppError } from './errors.js';
import { isValidTimeZone } from './time.js';

const text = (label, max = 120) =>
  z.string(`${label} is required`).trim().min(1, `${label} is required`).max(max, `${label} is too long`);

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), 'Not a real date');

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour times like 08:00');

// Nigerian numbers are normalised to +234…; other numbers must already be international.
export function normalisePhone(raw) {
  const digits = String(raw ?? '').replace(/[\s()-]/g, '');
  if (/^0[789][01]\d{8}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  return null;
}

const phone = z
  .string('Phone number is required')
  .transform((v, ctx) => {
    const normalised = normalisePhone(v);
    if (!normalised) {
      ctx.addIssue({ code: 'custom', message: 'Use a Nigerian number (0803…) or an international one (+44…)' });
      return z.NEVER;
    }
    return normalised;
  });

const email = z.string('Email is required').trim().toLowerCase().pipe(z.email('Enter a valid email'));
const password = z.string('Password is required').min(10, 'Use at least 10 characters').max(200);

export const registerSchema = z.object({
  clinicName: text('Clinic name'),
  timezone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
  name: text('Your name'),
  email,
  password,
});

// The registration form also asks for the password twice. The check lives here, not in
// registerClinic, because it is about the form: the seed script and tests call the service directly.
export const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string('Please type the password again') })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: "Passwords don't match" });

export const loginSchema = z.object({
  email,
  password: z.string('Password is required').min(1, 'Password is required'),
});

export const staffSchema = z.object({
  name: text('Name'),
  email,
  password,
  role: z.enum(['admin', 'staff']).default('staff'),
});

export const patientSchema = z.object({
  name: text('Name'),
  phone,
  condition: optionalText(120),
  notes: optionalText(),
});

export const medicationSchema = z
  .object({
    name: text('Medicine'),
    dosage: text('Dosage', 60),
    times: z
      .union([z.string(), z.array(z.string())])
      .transform((v) => (Array.isArray(v) ? v : v.split(/[,\s]+/)).map((t) => t.trim()).filter(Boolean))
      .pipe(z.array(clockTime).min(1, 'Add at least one time').max(6, 'At most 6 times a day'))
      .transform((times) => [...new Set(times)].sort()),
    startDate: isoDate,
    endDate: isoDate.optional().or(z.literal('').transform(() => undefined)),
    instructions: optionalText(200),
  })
  .refine((m) => !m.endDate || m.endDate >= m.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

export const appointmentSchema = z.object({
  date: isoDate,
  time: clockTime,
  reason: text('Reason', 200),
});

// Throws an AppError with one message per field, ready to show next to the inputs.
export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] ?? 'form';
      fields[field] ??= issue.message;
    }
    throw new AppError('INVALID', 'Please check the highlighted fields', { fields });
  }
  return result.data;
}
