import 'dotenv/config';
import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const EnvSchema = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    // On Render, the app's own address (Render sets RENDER_EXTERNAL_URL), since the API serves the pages.
    FRONTEND_URL: optional.transform((v) => v ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173'),
    APP_TIMEZONE: z.string().default('Europe/Skopje'),

    GEMINI_API_KEY: optional,
    GEMINI_MODEL: z.string().default('gemini-flash-lite-latest'),

    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    GOOGLE_REDIRECT_URI: optional,
    TOKEN_ENCRYPTION_KEY: optional,
  })
  .superRefine((env, ctx) => {
    // Google is "on" once a client ID or secret is set. A redirect URI on its own (as in
    // .env.example) is ignored, so a fresh copy of the example file always starts.
    const google = [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI];
    const googleStarted = Boolean(env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET);
    if (googleStarted && !google.every(Boolean)) {
      const missing = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'].filter((_, i) => !google[i]);
      ctx.addIssue({
        code: 'custom',
        message: `Google Calendar is half configured. Also set ${missing.join(', ')}, or clear the Google variables to run without it`,
      });
    }
    if (googleStarted && google.every(Boolean)) {
      const key = env.TOKEN_ENCRYPTION_KEY ? Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64') : null;
      if (!key || key.length !== 32) {
        ctx.addIssue({
          code: 'custom',
          message: 'TOKEN_ENCRYPTION_KEY must be 32 random bytes in base64 when Google Calendar is configured',
        });
      }
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: env.APP_TIMEZONE });
    } catch {
      ctx.addIssue({ code: 'custom', message: `APP_TIMEZONE "${env.APP_TIMEZONE}" is not a valid IANA zone` });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Validated once at startup so a misconfigured deploy fails loudly instead of at the first request. */
export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const lines = parsed.error.issues.map((i) => ` - ${i.path.join('.') || 'env'}: ${i.message}`);
      throw new Error(`Invalid environment:\n${lines.join('\n')}`);
    }
    cached = parsed.data;
  }
  return cached;
}
