/**
 * Local Speech-to-Text using Whisper models via @huggingface/transformers.
 * Supports whisper-small, whisper-medium, whisper-large-v3-turbo.
 * Runs entirely client-side via ONNX/WebGPU.
 */

export type WhisperModel = "whisper-small" | "whisper-medium" | "whisper-large-v3-turbo";

export const WHISPER_MODELS: { id: WhisperModel; label: string; size: string }[] = [
    { id: "whisper-small", label: "Whisper Small", size: "~240 MB" },
    { id: "whisper-medium", label: "Whisper Medium", size: "~760 MB" },
    { id: "whisper-large-v3-turbo", label: "Whisper Large V3 Turbo", size: "~800 MB" },
];

const MODEL_MAP: Record<WhisperModel, string> = {
    "whisper-small": "onnx-community/whisper-small",
    "whisper-medium": "onnx-community/whisper-medium",
    "whisper-large-v3-turbo": "onnx-community/whisper-large-v3-turbo",
};

let pipeline: any = null;
let currentModelId: WhisperModel | null = null;
let loadingPromise: Promise<void> | null = null;

async function ensureLoaded(
    modelId: WhisperModel,
    onProgress?: (msg: string) => void,
): Promise<void> {
    if (pipeline && currentModelId === modelId) return;
    if (loadingPromise && currentModelId === modelId) return loadingPromise;

    // Reset if switching model
    pipeline = null;
    currentModelId = modelId;

    loadingPromise = (async () => {
        onProgress?.(`Loading ${modelId}... This may take a while on first use.`);
        const { pipeline: createPipeline } = await import("@huggingface/transformers");

        pipeline = await createPipeline(
            "automatic-speech-recognition",
            MODEL_MAP[modelId],
            {
                dtype: {
                    encoder_model: "q4",
                    decoder_model_merged: "q4",
                },
                device: "webgpu",
            } as any,
        );

        onProgress?.(`${modelId} loaded!`);
    })();

    return loadingPromise;
}

/**
 * Transcribe audio from a Float32Array of samples at the given sample rate.
 */
export async function transcribeAudio(
    audioData: Float32Array,
    sampleRate: number,
    modelId: WhisperModel = "whisper-small",
    onProgress?: (msg: string) => void,
): Promise<string> {
    await ensureLoaded(modelId, onProgress);

    if (!pipeline) throw new Error("Whisper pipeline not initialized");

    // Resample to 16kHz if needed (Whisper expects 16kHz)
    let resampled = audioData;
    if (sampleRate !== 16000) {
        resampled = resampleTo16k(audioData, sampleRate);
    }

    const result = await pipeline(resampled, {
        language: "en",
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
    });

    return (result as any).text?.trim() || "";
}

/** Simple linear resampling to 16kHz */
function resampleTo16k(data: Float32Array, fromRate: number): Float32Array {
    const ratio = fromRate / 16000;
    const newLength = Math.round(data.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
        const srcIdx = i * ratio;
        const idx = Math.floor(srcIdx);
        const frac = srcIdx - idx;
        const a = data[idx] ?? 0;
        const b = data[Math.min(idx + 1, data.length - 1)] ?? 0;
        result[i] = a + frac * (b - a);
    }
    return result;
}
