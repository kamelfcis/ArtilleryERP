import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export const config = {
  port: parseInt(process.env.PORT ?? '4001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  cookieName: process.env.COOKIE_NAME ?? 'artillery_token',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,https://artilleryerp.vercel.app')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
} as const
