import { type CoreMessage } from "ai";
import { ElevenLabsClient } from "elevenlabs";

export const maxDuration = 30;

interface SynthRequest {
  message: CoreMessage;
  provider?: "elevenlabs" | "local";
  apiKey?: string;
  voiceId?: string;
}

export async function POST(req: Request) {
  const { message, provider = "elevenlabs", apiKey, voiceId } =
    (await req.json()) as SynthRequest;

  // If local TTS is selected, client handles it — return 204
  if (provider === "local") {
    return new Response(null, { status: 204 });
  }

  // Use provided key/voiceId or fall back to env vars
  const key = apiKey || process.env.ELEVENLABS_API_KEY || "";
  const voice = voiceId || process.env.VOICE_ID || "";

  if (!key) {
    return new Response(JSON.stringify({ error: "Missing ElevenLabs API key" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const elevenlabs = new ElevenLabsClient({ apiKey: key });

  const audio = await elevenlabs.generate({
    voice,
    model_id: "eleven_turbo_v2_5",
    voice_settings: { similarity_boost: 0.5, stability: 0.55 },
    text: message.content as string,
  });

  return new Response(audio as never, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}