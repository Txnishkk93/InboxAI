export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const ENV = {
  clerkPublishableKey: getRequiredEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
  clerkSecretKey: getRequiredEnv('CLERK_SECRET_KEY'),
  databaseUrl: getRequiredEnv('DATABASE_URL'),
  openAiApiKey: process.env.OPENAI_API_KEY ?? '',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  resendApiKey: getRequiredEnv('RESEND_API_KEY'),
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
};

export function resolveSeedCredentialsRef(credentialsRef: string) {
  return {
    clientId: process.env[`${credentialsRef}_CLIENT_ID`] ?? null,
    clientSecret: process.env[`${credentialsRef}_CLIENT_SECRET`] ?? null,
    refreshToken: process.env[`${credentialsRef}_REFRESH_TOKEN`] ?? null,
  };
}

export function warnIfSeedCredentialsMissing(credentialsRef: string) {
  const credentials = resolveSeedCredentialsRef(credentialsRef);
  if (!credentials.clientId || !credentials.clientSecret) {
    console.warn(`Seed credentials for ${credentialsRef} are not fully configured in environment variables.`);
    return false;
  }
  return true;
}
