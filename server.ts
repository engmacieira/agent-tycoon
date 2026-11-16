import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

interface LlmExecuteBody {
  model: string;
  systemInstruction?: string;
  prompt: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  envVarName?: string;
  clientApiKey?: string;
}

function formatApiError(err: unknown): { status: number; apiError: string } {
  let status = 500;
  let message = err instanceof Error ? err.message : 'Unknown API error';

  if (typeof err === 'object' && err !== null) {
    const maybeErr = err as { status?: number; code?: number; message?: string };
    if (typeof maybeErr.status === 'number') status = maybeErr.status;
    else if (typeof maybeErr.code === 'number') status = maybeErr.code;
    if (typeof maybeErr.message === 'string') message = maybeErr.message;
  }

  // @google/genai often wraps Google REST JSON inside err.message
  const jsonStart = message.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(message.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed.error) {
        if (typeof parsed.error.code === 'number') status = parsed.error.code;
        if (typeof parsed.error.message === 'string') {
          message = parsed.error.message;
        }
      }
    } catch {
      // Keep original message if not valid JSON
    }
  }

  return {
    status,
    apiError: `[Erro API ${status}: ${message}]`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Server-side LLM proxy endpoint for Atlas, Vega, and Island Specialists
  app.post('/api/llm/execute', async (req: Request, res: Response) => {
    try {
      const body = req.body as LlmExecuteBody;
      const {
        model,
        systemInstruction,
        prompt,
        responseMimeType,
        maxOutputTokens,
        envVarName,
        clientApiKey,
      } = body;

      if (!prompt || !model) {
        res.status(400).json({
          ok: false,
          status: 400,
          apiError: '[Erro API 400: Missing model or prompt]',
          error: 'Missing model or prompt',
        });
        return;
      }

      const providedKey =
        clientApiKey && clientApiKey.trim().length > 0 && clientApiKey.trim() !== 'FALLBACK_TEST_KEY'
          ? clientApiKey.trim()
          : undefined;
      const envKey = envVarName ? process.env[envVarName] : undefined;
      const rawGlobalGeminiKey = process.env.GEMINI_API_KEY;
      const validGlobalGeminiKey =
        rawGlobalGeminiKey && rawGlobalGeminiKey !== 'MY_GEMINI_API_KEY'
          ? rawGlobalGeminiKey
          : undefined;

      // Priority: explicit user-configured key for this agent > agent-specific env var > server GEMINI_API_KEY
      const isGoogleModel =
        model.startsWith('gemini-') || model.startsWith('gemma-') || model.startsWith('models/');
      const resolvedKey =
        providedKey || envKey || (isGoogleModel ? validGlobalGeminiKey : undefined);

      if (!resolvedKey) {
        res.json({
          ok: false,
          fallbackRecommended: true,
          error: 'NO_API_KEY',
        });
        return;
      }

      // 1. Google Gemini / Gemma (@google/genai)
      if (isGoogleModel) {
        const ai = new GoogleGenAI({
          apiKey: resolvedKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const resolvedMaxOutputTokens =
          typeof maxOutputTokens === 'number' && maxOutputTokens > 0
            ? maxOutputTokens
            : model === 'gemini-3.1-pro-preview' || model === 'gemini-3-flash-preview'
            ? 16384
            : 8192;

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            maxOutputTokens: resolvedMaxOutputTokens,
            ...(systemInstruction ? { systemInstruction } : {}),
            ...(responseMimeType ? { responseMimeType } : {}),
          },
        });

        const text = response.text ?? '';
        const finishReason = response.candidates?.[0]?.finishReason;
        const usage = response.usageMetadata;
        const promptTokenCount = usage?.promptTokenCount ?? 0;
        const candidatesTokenCount = usage?.candidatesTokenCount ?? 0;
        const totalTokenCount = usage?.totalTokenCount ?? promptTokenCount + candidatesTokenCount;

        res.json({
          ok: true,
          text,
          finishReason,
          usageMetadata: {
            promptTokenCount,
            candidatesTokenCount,
            totalTokenCount,
          },
          inputTokens: promptTokenCount,
          outputTokens: candidatesTokenCount,
          provider: 'google-genai',
        });
        return;
      }

      // 2. OpenAI (gpt-*)
      if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-') || model.startsWith('o4-')) {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resolvedKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
              { role: 'user', content: prompt },
            ],
            ...(responseMimeType === 'application/json' ? { response_format: { type: 'json_object' } } : {}),
          }),
        });

        if (!openaiRes.ok) {
          let detail = await openaiRes.text();
          try {
            const parsed = JSON.parse(detail) as { error?: { message?: string } };
            if (parsed.error?.message) detail = parsed.error.message;
          } catch {
            // Keep raw text
          }
          res.json({
            ok: false,
            fallbackRecommended: false,
            status: openaiRes.status,
            apiError: `[Erro API ${openaiRes.status}: ${detail}]`,
            error: `OPENAI_ERROR_${openaiRes.status}`,
          });
          return;
        }

        const data = (await openaiRes.json()) as {
          choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        const text = data.choices?.[0]?.message?.content ?? '';
        const rawFinish = data.choices?.[0]?.finish_reason;
        const finishReason = rawFinish === 'length' ? 'MAX_TOKENS' : rawFinish;
        const promptTokenCount = data.usage?.prompt_tokens ?? 0;
        const candidatesTokenCount = data.usage?.completion_tokens ?? 0;
        res.json({
          ok: true,
          text,
          finishReason,
          usageMetadata: {
            promptTokenCount,
            candidatesTokenCount,
            totalTokenCount: data.usage?.total_tokens ?? promptTokenCount + candidatesTokenCount,
          },
          inputTokens: promptTokenCount,
          outputTokens: candidatesTokenCount,
          provider: 'openai',
        });
        return;
      }

      // 3. Anthropic (claude-*)
      if (model.startsWith('claude-')) {
        const anthropicModel = model === 'claude-sonnet' ? 'claude-sonnet-4-5' : model;
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': resolvedKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: anthropicModel,
            max_tokens: typeof maxOutputTokens === 'number' && maxOutputTokens > 0 ? maxOutputTokens : 8192,
            ...(systemInstruction ? { system: systemInstruction } : {}),
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!claudeRes.ok) {
          let detail = await claudeRes.text();
          try {
            const parsed = JSON.parse(detail) as { error?: { message?: string } };
            if (parsed.error?.message) detail = parsed.error.message;
          } catch {
            // Keep raw text
          }
          res.json({
            ok: false,
            fallbackRecommended: false,
            status: claudeRes.status,
            apiError: `[Erro API ${claudeRes.status}: ${detail}]`,
            error: `ANTHROPIC_ERROR_${claudeRes.status}`,
          });
          return;
        }

        const data = (await claudeRes.json()) as {
          content?: Array<{ text?: string }>;
          stop_reason?: string;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const text = data.content?.[0]?.text ?? '';
        const finishReason = data.stop_reason === 'max_tokens' ? 'MAX_TOKENS' : data.stop_reason;
        const promptTokenCount = data.usage?.input_tokens ?? 0;
        const candidatesTokenCount = data.usage?.output_tokens ?? 0;
        res.json({
          ok: true,
          text,
          finishReason,
          usageMetadata: {
            promptTokenCount,
            candidatesTokenCount,
            totalTokenCount: promptTokenCount + candidatesTokenCount,
          },
          inputTokens: promptTokenCount,
          outputTokens: candidatesTokenCount,
          provider: 'anthropic',
        });
        return;
      }

      res.json({
        ok: false,
        fallbackRecommended: false,
        status: 400,
        apiError: `[Erro API 400: Modelo não suportado "${model}"]`,
        error: 'UNSUPPORTED_MODEL',
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.json({
        ok: false,
        fallbackRecommended: false,
        status: formatted.status,
        apiError: formatted.apiError,
        error: formatted.apiError,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PixelHQ 8-Bits server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
