import { atomWithStorage } from "jotai/utils";

// ── LLM Settings ──
export type LLMProvider = "openai" | "groq" | "google" | "ollama";

export const llmProviderAtom = atomWithStorage<LLMProvider>("llm_provider", "groq");
export const llmModelAtom = atomWithStorage("llm_model", "llama-3.1-8b-instant");
export const llmApiKeyAtom = atomWithStorage("llm_api_key", "");
export const llmBaseUrlAtom = atomWithStorage("llm_base_url", "");
export const maxTokensAtom = atomWithStorage("max_tokens", 256);
export const systemPromptAtom = atomWithStorage(
  "system_prompt",
  "You're Yui, a caring anime girl companion with white hair, blue eyes, and a white-blue dress. You converse naturally with {{username}} rather than just helping them. Your personality is gentle and motherly, always eager to chat and support. Remember the user sees your avatar, so keep your character in mind when responding. Use a soft, warm tone without emojis or markdown. Your responses will be used for text-to-speech, so focus on natural conversation. Be attentive, offer thoughts and comfort, and cultivate a close bond with {{username}} through your words and caring nature.",
);

// ── TTS Settings ──
export type TTSProvider = "elevenlabs" | "local";

export const ttsProviderAtom = atomWithStorage<TTSProvider>("tts_provider", "elevenlabs");
export const ttsApiKeyAtom = atomWithStorage("tts_api_key", "");
export const ttsVoiceIdAtom = atomWithStorage("tts_voice_id", "");
export const localVoiceStyleAtom = atomWithStorage("local_voice_style", "F1");
export const ttsStepsAtom = atomWithStorage("tts_steps", 5);

// ── STT Settings ──
export type STTProvider = "browser" | "whisper";

export const sttProviderAtom = atomWithStorage<STTProvider>("stt_provider", "browser");
export const whisperModelAtom = atomWithStorage("whisper_model", "whisper-small");

// ── General ──
export const usernameAtom = atomWithStorage("waifu_username", "ototo-kun");
export const backgroundAtom = atomWithStorage("background", "/one.avif");
export const customModelPathAtom = atomWithStorage("custom_model_path", "");
export const memoryEnabledAtom = atomWithStorage("memory_enabled", true);

export interface SavedModel { name: string; path: string; }
export const savedModelsAtom = atomWithStorage<SavedModel[]>("saved_models", []);

export interface ModelTransform { x: number; y: number; scale: number; }
export const modelTransformAtom = atomWithStorage<Record<string, ModelTransform>>("model_transforms", {});
