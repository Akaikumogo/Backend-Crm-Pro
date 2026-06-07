import { z } from 'zod';

const booleanString = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => (typeof v === 'boolean' ? v : v === 'true' || v === '1'));

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USERNAME: z.string().min(1).default('postgres'),
  DB_PASSWORD: z.string().min(1).default('postgres'),
  DB_NAME: z.string().min(1).default('shoxsaroy'),
  DB_SYNC: booleanString.default(false),
  DB_SSL: booleanString.default(false),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),
  DB_CONN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_SEC: z.coerce.number().int().positive().default(604800),

  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
    .optional()
    .or(z.literal('')),

  SUPERADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  SUPERADMIN_PASSWORD: z.string().min(8).optional().or(z.literal('')),

  SUPPORT_PHONE: z.string().optional().or(z.literal('')),

  CORS_ORIGIN: z.string().default(''),

  MQTT_URL: z.string().optional().or(z.literal('')),
  MQTT_USERNAME: z.string().optional().or(z.literal('')),
  MQTT_PASSWORD: z.string().optional().or(z.literal('')),

  SHOWROOM_BLOCK_ID: z.string().optional().or(z.literal('')),
  SHOWROOM_SOURCE_FLOOR_ID: z.string().optional().or(z.literal('')),
  SHOWROOM_TARGET_FLOOR_LEVELS: z.string().optional().or(z.literal('')),
  SHOWROOM_SHIFT_STEP: z.coerce.number().optional(),
  SHOWROOM_COPY_PLAN: booleanString.optional(),

  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'debug'])
    .default('info'),
  LOG_DIR: z.string().default('logs'),

  THROTTLE_TTL_SEC: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = result.data;

  if (env.NODE_ENV === 'production') {
    const productionErrors: string[] = [];
    if (env.DB_SYNC) {
      productionErrors.push(
        'DB_SYNC must be false in production (use migrations instead)',
      );
    }
    if (env.JWT_SECRET === 'change-me-in-production') {
      productionErrors.push(
        'JWT_SECRET must be changed from the default value in production',
      );
    }
    if (env.JWT_SECRET.length < 32) {
      productionErrors.push(
        'JWT_SECRET must be at least 32 characters in production',
      );
    }
    if (!env.ENCRYPTION_KEY) {
      productionErrors.push('ENCRYPTION_KEY is required in production');
    }
    if (productionErrors.length) {
      throw new Error(
        'Invalid production environment:\n' +
          productionErrors.map((m) => `  - ${m}`).join('\n'),
      );
    }
  }

  return env;
}
