import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { type CoreMessage, streamText } from "ai";
import prisma from "~/lib/db";

export const maxDuration = 30;

type LLMProvider = "openai" | "groq" | "google" | "ollama";

interface ChatRequest {
  messages: CoreMessage[];
  username?: string;
  provider?: LLMProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  systemPrompt?: string;
}

function buildModel(provider: LLMProvider, modelId: string, apiKey: string, baseUrl: string) {
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY || "",
        ...(baseUrl ? { baseURL: baseUrl } : {}),
      });
      return openai(modelId);
    }
    case "groq": {
      const groq = createOpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: apiKey || process.env.GROQ_API_KEY || "",
      });
      return groq(modelId);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey: apiKey || process.env.GOOGLE_API_KEY || "" });
      return google(modelId);
    }
    case "ollama": {
      const ollama = createOpenAI({
        baseURL: baseUrl || "http://localhost:11434/v1",
        apiKey: "ollama",
      });
      return ollama(modelId);
    }
    default: {
      const fallback = createOpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: apiKey || process.env.GROQ_API_KEY || "",
      });
      return fallback(modelId);
    }
  }
}

const DEFAULT_SYSTEM_PROMPT =
  "You're Yui, a caring anime girl companion with white hair, blue eyes, and a white-blue dress. You converse naturally with {{username}} rather than just helping them. Your personality is gentle and motherly, always eager to chat and support. Remember the user sees your avatar, so keep your character in mind when responding. Use a soft, warm tone without emojis or markdown. Your responses will be used for text-to-speech, so focus on natural conversation. Be attentive, offer thoughts and comfort, and cultivate a close bond with {{username}} through your words and caring nature.";

export async function POST(req: Request) {
  try {
    const {
      messages,
      username = "ototo-kun",
      provider = "groq",
      model: modelId = "llama-3.1-8b-instant",
      apiKey = "",
      baseUrl = "",
      maxTokens = 256,
      systemPrompt,
    } = (await req.json()) as ChatRequest;

    console.info(`[chat] provider=${provider} model=${modelId} maxTokens=${maxTokens}`);

    const model = buildModel(provider, modelId, apiKey, baseUrl);
    
    // Inject memories
    const memories = await prisma.memoryFact.findMany({ orderBy: { createdAt: "asc" } });
    const memoryContext = memories.length > 0 
      ? `\n\nImportant facts about {{username}} you must remember:\n${memories.map((m: { content: string }) => `- ${m.content}`).join("\n")}` 
      : "";
    
    const prompt = (systemPrompt || DEFAULT_SYSTEM_PROMPT).replaceAll("{{username}}", username) + memoryContext.replaceAll("{{username}}", username);

    let fullText = "";
    const { textStream } = await streamText({
      model: model as any,
      maxTokens: Math.max(50, Math.min(maxTokens, 4096)),
      messages,
      system: prompt,
    });

    for await (const textPart of textStream) {
      fullText += textPart;
    }

    return new Response(
      JSON.stringify({ role: "assistant", content: fullText } as CoreMessage),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[chat] Error:", error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}