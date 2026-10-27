import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';

/**
 * Thin wrapper so services can be tested with a fake. Asks Gemini for JSON that
 * matches a schema (structured output) and returns the parsed object.
 */
@Injectable()
export class GeminiClient {
  private client: GoogleGenAI | null = null;

  isConfigured() {
    return Boolean(env().GEMINI_API_KEY);
  }

  async generateJson(args: {
    system: string;
    prompt: string;
    schema: Record<string, unknown>;
    timeoutMs: number;
    temperature?: number;
  }): Promise<unknown> {
    if (!this.isConfigured()) throw new Error('GEMINI_API_KEY is not set');
    this.client ??= new GoogleGenAI({ apiKey: env().GEMINI_API_KEY! });

    const abort = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        abort.abort();
        reject(new Error(`Gemini timed out after ${args.timeoutMs} ms`));
      }, args.timeoutMs);
    });
    try {
      const call = this.client.models.generateContent({
        model: env().GEMINI_MODEL,
        contents: args.prompt,
        config: {
          systemInstruction: args.system,
          responseMimeType: 'application/json',
          responseJsonSchema: args.schema,
          temperature: args.temperature ?? 0.7,
          maxOutputTokens: 400,
          abortSignal: abort.signal,
        },
      });
      const res = await Promise.race([call, timeout]);
      const text = res.text;
      if (!text) throw new Error('Empty response from Gemini');
      return JSON.parse(text);
    } finally {
      clearTimeout(timer);
    }
  }
}
