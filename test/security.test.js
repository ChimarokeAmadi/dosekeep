import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, readSessionToken } from '../src/lib/session.js';
import { hashToken, newPortalToken, safeEqual } from '../src/lib/tokens.js';
import { createSmsSender } from '../src/lib/sms.js';
import { medicationSchema, normalisePhone, parse, registerFormSchema, registerSchema } from '../src/lib/validation.js';

const SECRET = 'a-test-secret-that-is-long-enough-123';
const user = { id: 'u1', clinicId: 'c1', role: 'admin', name: 'Ada' };

test('a session token round-trips and rejects tampering, other secrets and expiry', async () => {
  const token = await createSessionToken(user, SECRET);
  assert.deepEqual(await readSessionToken(token, SECRET), user);
  assert.equal(await readSessionToken(`${token.slice(0, -2)}xx`, SECRET), null);
  assert.equal(await readSessionToken(token, `${SECRET}-other`), null);
  const old = await createSessionToken(user, SECRET, new Date(Date.now() - 9 * 60 * 60 * 1000));
  assert.equal(await readSessionToken(old, SECRET), null);
  assert.equal(await readSessionToken(undefined, SECRET), null);
  await assert.rejects(createSessionToken(user, 'short'), /at least 32/);
});

test('portal tokens are long, random and stored only as a hash', () => {
  const a = newPortalToken();
  assert.equal(a.length, 32);
  assert.notEqual(a, newPortalToken());
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
});

test('phone numbers are normalised to international format', () => {
  assert.equal(normalisePhone('0803 123 4567'), '+2348031234567');
  assert.equal(normalisePhone('+44 7700 900123'), '+447700900123');
  assert.equal(normalisePhone('12345'), null);
  assert.equal(normalisePhone(undefined), null);
});

test('validation returns one readable message per field', () => {
  assert.throws(
    () => parse(registerSchema, { clinicName: ' ', timezone: 'Mars/Base', name: 'A', email: 'nope', password: 'short' }),
    (error) => {
      assert.equal(error.code, 'INVALID');
      assert.deepEqual(Object.keys(error.fields).sort(), ['clinicName', 'email', 'password', 'timezone']);
      return true;
    },
  );
  const form = { clinicName: 'Hope', timezone: 'Africa/Lagos', name: 'N', email: 'n@hope.test', password: 'long enough pass' };
  assert.equal(parse(registerFormSchema, { ...form, confirmPassword: 'long enough pass' }).email, 'n@hope.test');
  assert.throws(() => parse(registerFormSchema, { ...form, confirmPassword: 'long enough pas' }), (e) => e.fields.confirmPassword === "Passwords don't match");
  const medication = parse(medicationSchema, { name: 'Metformin', dosage: '500 mg', times: '20:00, 08:00 08:00', startDate: '2026-11-01', endDate: '' });
  assert.deepEqual(medication.times, ['08:00', '20:00']);
  assert.equal(medication.endDate, undefined);
  assert.throws(() => parse(medicationSchema, { ...medication, times: '8am' }), (e) => Boolean(e.fields.times));
  assert.throws(() => parse(medicationSchema, { ...medication, endDate: '2026-10-01' }), (e) => Boolean(e.fields.endDate));
  assert.throws(() => parse(medicationSchema, { ...medication, startDate: '2026-02-30' }), (e) => Boolean(e.fields.startDate));
});

test("the Africa's Talking sender posts the SMS and reports rejected numbers", async () => {
  const calls = [];
  const reply = (body) => async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => body };
  };
  const ok = createSmsSender({ provider: 'africastalking', username: 'sandbox', apiKey: 'k' }, reply({ SMSMessageData: { Recipients: [{ statusCode: 101, messageId: 'ATX1' }] } }));
  assert.deepEqual(await ok.send({ to: '+2348031234567', body: 'hi' }), { id: 'ATX1' });
  assert.equal(calls[0].url, 'https://api.sandbox.africastalking.com/version1/messaging');
  assert.equal(calls[0].init.body.get('to'), '+2348031234567');

  const rejected = createSmsSender({ provider: 'africastalking', username: 'clinic', apiKey: 'k' }, reply({ SMSMessageData: { Recipients: [{ statusCode: 403, status: 'InvalidPhoneNumber' }] } }));
  await assert.rejects(rejected.send({ to: '+1', body: 'hi' }), /InvalidPhoneNumber/);
  assert.equal(calls[1].url, 'https://api.africastalking.com/version1/messaging');

  assert.deepEqual(await createSmsSender({ provider: 'log' }).send({}), { id: null });
  assert.throws(() => createSmsSender({ provider: 'pigeon' }), /Unknown SMS_PROVIDER/);
  assert.throws(() => createSmsSender({ provider: 'africastalking' }), /AT_USERNAME/);
});
