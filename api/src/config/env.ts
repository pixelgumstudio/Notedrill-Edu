/**
 * Validate required environment variables at startup
 */
export const validateEnv = () => {
  const required = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const optional = [
    'REDIS_URL',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'SUPABASE_JWT_SECRET',
    'ADMIN_API_KEY',
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  for (const key of optional) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`
      ❌ Missing required environment variables:
      ${missing.map(k => `  - ${k}`).join('\n')}

      Please add them to your .env file and restart the server.
    `);
  }

  if (warnings.length > 0) {
    console.warn(`
      ⚠️  Missing optional environment variables:
      ${warnings.map(k => `  - ${k}`).join('\n')}

      Some features may not work without these.
    `);
  }

  console.log('✅ Environment validation passed');
};
