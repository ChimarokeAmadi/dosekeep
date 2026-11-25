// All settings come from environment variables (see .env.example).
export function getConfig(env = process.env) {
  return {
    mongodbUri: env.MONGODB_URI,
    dbName: env.MONGODB_DB || 'dosekeep',
    sessionSecret: env.SESSION_SECRET,
    cronSecret: env.CRON_SECRET,
    appUrl: (env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
    bcryptRounds: Number(env.BCRYPT_ROUNDS) || 12,
    sms: {
      provider: env.SMS_PROVIDER || 'log',
      username: env.AT_USERNAME,
      apiKey: env.AT_API_KEY,
      senderId: env.AT_SENDER_ID,
    },
  };
}
