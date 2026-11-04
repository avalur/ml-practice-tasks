/* Client-safe half of src/lib/ai.ts: the providers a teacher can pick for their
 * own key. Every one of them speaks the OpenAI chat-completions protocol, which
 * is what lets one adapter serve all of them. */

export type AiProviderId = "openrouter" | "gemini" | "openai" | "anthropic" | "xai" | "meta" | "custom";

export const AI_PROVIDERS: Record<
  AiProviderId,
  { label: string; baseUrl: string; modelHint: string; keyUrl?: string }
> = {
  openrouter: {
    label: "OpenRouter (one key for many models)",
    baseUrl: "https://openrouter.ai/api/v1",
    modelHint: "e.g. anthropic/claude-sonnet-5-5, google/gemini-2.5-pro",
    keyUrl: "https://openrouter.ai/keys",
  },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    modelHint: "e.g. gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", modelHint: "e.g. gpt-5-mini" },
  anthropic: { label: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1", modelHint: "e.g. claude-sonnet-5-5" },
  xai: { label: "xAI Grok", baseUrl: "https://api.x.ai/v1", modelHint: "e.g. grok-4" },
  meta: { label: "Meta Muse", baseUrl: "https://api.meta.ai/v1", modelHint: "e.g. muse-spark-1.3" },
  custom: { label: "Other OpenAI-compatible endpoint", baseUrl: "", modelHint: "the model id your endpoint expects" },
};

export type AiMode = "generate" | "edit";

export type AiKeyStatus = {
  own: { provider: AiProviderId; model: string; hint: string; baseUrl: string | null } | null;
  platform: { available: boolean; limit: number; usedToday: number };
};
