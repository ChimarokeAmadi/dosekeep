// SMS reaches patients on any phone, including feature phones without data.
// "log" sends nothing (messages only appear on the Reminders page): good for testing.
// "africastalking" sends real SMS through Africa's Talking, which covers Nigerian networks.

export function createSmsSender(config, fetchImpl = globalThis.fetch) {
  if (config.provider === 'log') {
    return { provider: 'log', send: async () => ({ id: null }) };
  }

  if (config.provider === 'africastalking') {
    if (!config.username || !config.apiKey) throw new Error('AT_USERNAME and AT_API_KEY are required for Africa\'s Talking');
    const host = config.username === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
    return {
      provider: 'africastalking',
      async send({ to, body }) {
        const form = new URLSearchParams({ username: config.username, to, message: body });
        if (config.senderId) form.set('from', config.senderId);
        const response = await fetchImpl(`https://${host}/version1/messaging`, {
          method: 'POST',
          headers: { apiKey: config.apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form,
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`SMS provider answered ${response.status}`);
        const data = await response.json();
        const recipient = data?.SMSMessageData?.Recipients?.[0];
        if (!recipient || recipient.statusCode >= 200) {
          throw new Error(`SMS not accepted: ${recipient?.status ?? data?.SMSMessageData?.Message ?? 'unknown error'}`);
        }
        return { id: recipient.messageId };
      },
    };
  }

  throw new Error(`Unknown SMS_PROVIDER "${config.provider}"`);
}
