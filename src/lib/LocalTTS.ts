/**
 * Local TTS using Supertone/supertonic-2 ONNX models.
 * Ported from the tts/ sample project's helper.js.
 * Runs entirely client-side via onnxruntime-web (WebGPU → WASM fallback).
 */

// We lazy-import onnxruntime-web to avoid SSR issues
let ort: typeof import("onnxruntime-web") | null = null;

async function getOrt() {
    if (!ort) {
        ort = await import("onnxruntime-web");
    }
    return ort;
}

// ── Available voices ──
export const VOICE_STYLES = [
    { id: "F1", label: "Female 1", path: "/tts/voice_styles/F1.json" },
    { id: "F2", label: "Female 2", path: "/tts/voice_styles/F2.json" },
    { id: "F3", label: "Female 3", path: "/tts/voice_styles/F3.json" },
    { id: "F5", label: "Female 5", path: "/tts/voice_styles/F5.json" },
    { id: "M1", label: "Male 1", path: "/tts/voice_styles/M1.json" },
    { id: "M2", label: "Male 2", path: "/tts/voice_styles/M2.json" },
    { id: "M3", label: "Male 3", path: "/tts/voice_styles/M3.json" },
    { id: "M4", label: "Male 4", path: "/tts/voice_styles/M4.json" },
    { id: "M5", label: "Male 5", path: "/tts/voice_styles/M5.json" },
] as const;

export type VoiceStyleId = (typeof VOICE_STYLES)[number]["id"];

const AVAILABLE_LANGS = ["en", "ko", "es", "pt", "fr"];

// ── Unicode Processor ──
class UnicodeProcessor {
    constructor(private indexer: number[]) { }

    call(textList: string[], langList: string[]) {
        const processedTexts = textList.map((text, i) => this.preprocessText(text, langList[i]!));
        const textIdsLengths = processedTexts.map((t) => t.length);
        const maxLen = Math.max(...textIdsLengths);

        const textIds = processedTexts.map((text) => {
            const row = new Array(maxLen).fill(0);
            for (let j = 0; j < text.length; j++) {
                const cp = text.codePointAt(j)!;
                row[j] = cp < this.indexer.length ? this.indexer[cp]! : -1;
            }
            return row;
        });

        const textMask = this.getTextMask(textIdsLengths);
        return { textIds, textMask };
    }

    private preprocessText(text: string, lang: string): string {
        text = text.normalize("NFKD");
        // Remove emojis
        text = text.replace(
            /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu,
            "",
        );

        const replacements: Record<string, string> = {
            "–": "-", "‑": "-", "—": "-", _: " ",
            "\u201C": '"', "\u201D": '"', "\u2018": "'", "\u2019": "'",
            "´": "'", "`": "'", "[": " ", "]": " ", "|": " ", "/": " ",
            "#": " ", "→": " ", "←": " ",
        };
        for (const [k, v] of Object.entries(replacements)) text = text.replaceAll(k, v);

        text = text.replace(/[♥☆♡©\\]/g, "");
        text = text.replaceAll("@", " at ");
        text = text.replaceAll("e.g.,", "for example, ");
        text = text.replaceAll("i.e.,", "that is, ");
        text = text.replace(/ ,/g, ",").replace(/ \./g, ".").replace(/ !/g, "!").replace(/ \?/g, "?");
        text = text.replace(/\s+/g, " ").trim();

        if (!/[.!?;:,'")\]}…。」』】〉》›»]$/.test(text)) text += ".";
        if (!AVAILABLE_LANGS.includes(lang)) throw new Error(`Invalid language: ${lang}`);
        return `<${lang}>${text}</${lang}>`;
    }

    private getTextMask(lengths: number[]) {
        const maxLen = Math.max(...lengths);
        return lengths.map((len) => {
            const row = new Array(maxLen).fill(0.0);
            for (let j = 0; j < Math.min(len, maxLen); j++) row[j] = 1.0;
            return [row];
        });
    }
}

// ── Style ──
class Style {
    constructor(
        public ttl: any, // ort.Tensor
        public dp: any,  // ort.Tensor
    ) { }
}

// ── TextToSpeech engine ──
class TextToSpeech {
    public sampleRate: number;

    constructor(
        private cfgs: any,
        private textProcessor: UnicodeProcessor,
        private dpOrt: any,
        private textEncOrt: any,
        private vectorEstOrt: any,
        private vocoderOrt: any,
    ) {
        this.sampleRate = cfgs.ae.sample_rate;
    }

    async call(
        text: string,
        lang: string,
        style: Style,
        totalStep: number,
        speed = 1.05,
        silenceDuration = 0.3,
        progressCallback?: (step: number, total: number) => void,
    ) {
        const maxLen = lang === "ko" ? 120 : 300;
        const textList = chunkText(text, maxLen);
        const langList = new Array(textList.length).fill(lang);
        let wavCat: number[] = [];
        let durCat = 0;

        for (let i = 0; i < textList.length; i++) {
            const { wav, duration } = await this._infer(
                [textList[i]!], [langList[i]], style, totalStep, speed, progressCallback,
            );
            if (wavCat.length === 0) {
                wavCat = wav;
                durCat = duration[0]!;
            } else {
                const silenceLen = Math.floor(silenceDuration * this.sampleRate);
                wavCat = [...wavCat, ...new Array(silenceLen).fill(0), ...wav];
                durCat += duration[0]! + silenceDuration;
            }
        }
        return { wav: wavCat, duration: [durCat] };
    }

    private async _infer(
        textList: string[],
        langList: string[],
        style: Style,
        totalStep: number,
        speed: number,
        progressCallback?: (step: number, total: number) => void,
    ) {
        const _ort = await getOrt();
        const bsz = textList.length;
        const { textIds, textMask } = this.textProcessor.call(textList, langList);

        const textIdsTensor = new _ort.Tensor(
            "int64",
            new BigInt64Array(textIds.flat().map((x: number) => BigInt(x))),
            [bsz, textIds[0]!.length],
        );
        const textMaskTensor = new _ort.Tensor(
            "float32",
            new Float32Array(textMask.flat(2) as number[]),
            [bsz, 1, (textMask[0]! as number[][])[0]!.length],
        );

        // Duration prediction
        const dpOut = await this.dpOrt.run({ text_ids: textIdsTensor, style_dp: style.dp, text_mask: textMaskTensor });
        const duration = Array.from(dpOut.duration.data as Float32Array).map((d: number) => d / speed);

        // Text encoding
        const teOut = await this.textEncOrt.run({ text_ids: textIdsTensor, style_ttl: style.ttl, text_mask: textMaskTensor });
        const textEmb = teOut.text_emb;

        // Sample noisy latent
        let { xt, latentMask } = this.sampleNoisyLatent(duration, bsz);
        const latentMaskTensor = new _ort.Tensor(
            "float32",
            new Float32Array(latentMask.flat(2) as number[]),
            [bsz, 1, (latentMask[0]! as number[][])[0]!.length],
        );

        const totalStepTensor = new _ort.Tensor("float32", new Float32Array(bsz).fill(totalStep), [bsz]);

        // Denoising loop
        for (let step = 0; step < totalStep; step++) {
            progressCallback?.(step + 1, totalStep);
            const currentStepTensor = new _ort.Tensor("float32", new Float32Array(bsz).fill(step), [bsz]);
            const latentDim = xt[0]!.length;
            const latentLen = xt[0]![0]!.length;
            const xtTensor = new _ort.Tensor("float32", new Float32Array(xt.flat(2) as number[]), [bsz, latentDim, latentLen]);

            const veOut = await this.vectorEstOrt.run({
                noisy_latent: xtTensor,
                text_emb: textEmb,
                style_ttl: style.ttl,
                latent_mask: latentMaskTensor,
                text_mask: textMaskTensor,
                current_step: currentStepTensor,
                total_step: totalStepTensor,
            });

            const denoised = Array.from(veOut.denoised_latent.data as Float32Array);
            xt = [];
            let idx = 0;
            for (let b = 0; b < bsz; b++) {
                const batch: number[][] = [];
                for (let d = 0; d < latentDim; d++) {
                    const row: number[] = [];
                    for (let t = 0; t < latentLen; t++) row.push(denoised[idx++]!);
                    batch.push(row);
                }
                xt.push(batch);
            }
        }

        // Vocoder
        const finalXt = new _ort.Tensor("float32", new Float32Array(xt.flat(2) as number[]), [bsz, xt[0]!.length, xt[0]![0]!.length]);
        const vocOut = await this.vocoderOrt.run({ latent: finalXt });
        const wav = Array.from(vocOut.wav_tts.data as Float32Array);

        return { wav, duration };
    }

    private sampleNoisyLatent(duration: number[], bsz: number) {
        const maxDur = Math.max(...duration);
        const wavLenMax = Math.floor(maxDur * this.sampleRate);
        const wavLengths = duration.map((d) => Math.floor(d * this.sampleRate));
        const chunkSize = this.cfgs.ae.base_chunk_size * this.cfgs.ttl.chunk_compress_factor;
        const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize);
        const latentDimVal = this.cfgs.ttl.latent_dim * this.cfgs.ttl.chunk_compress_factor;

        const xt: number[][][] = [];
        for (let b = 0; b < bsz; b++) {
            const batch: number[][] = [];
            for (let d = 0; d < latentDimVal; d++) {
                const row: number[] = [];
                for (let t = 0; t < latentLen; t++) {
                    const u1 = Math.max(0.0001, Math.random());
                    const u2 = Math.random();
                    row.push(Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2));
                }
                batch.push(row);
            }
            xt.push(batch);
        }

        const latentLengths = wavLengths.map((len) => Math.floor((len + chunkSize - 1) / chunkSize));
        const latentMask = latentLengths.map((len) => {
            const row = new Array(latentLen).fill(0.0);
            for (let j = 0; j < Math.min(len, latentLen); j++) row[j] = 1.0;
            return [row];
        });

        // Apply mask
        for (let b = 0; b < bsz; b++)
            for (let d = 0; d < latentDimVal; d++)
                for (let t = 0; t < latentLen; t++)
                    xt[b]![d]![t]! *= (latentMask[b]! as number[][])[0]![t]!;

        return { xt, latentMask };
    }
}

// ── Public API ──

let ttsEngine: TextToSpeech | null = null;
let currentStyle: Style | null = null;
let currentStyleId: string | null = null;
let loadingPromise: Promise<void> | null = null;

export async function ensureModelLoaded(
    onProgress?: (message: string) => void,
): Promise<void> {
    if (ttsEngine) return;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        const _ort = await getOrt();
        const basePath = "/tts/onnx";

        onProgress?.("Loading TTS configuration...");
        const cfgsResp = await fetch(`${basePath}/tts.json`);
        const cfgs = await cfgsResp.json();

        const indexerResp = await fetch(`${basePath}/unicode_indexer.json`);
        const indexer = await indexerResp.json();
        const textProcessor = new UnicodeProcessor(indexer);

        const models = [
            { name: "Duration Predictor", file: "duration_predictor.onnx" },
            { name: "Text Encoder", file: "text_encoder.onnx" },
            { name: "Vector Estimator", file: "vector_estimator.onnx" },
            { name: "Vocoder", file: "vocoder.onnx" },
        ];

        // Try WebGPU first, fallback to WASM
        let sessionOpts: any = { executionProviders: ["webgpu"], graphOptimizationLevel: "all" };
        let sessions: any[] = [];
        try {
            for (let i = 0; i < models.length; i++) {
                onProgress?.(`Loading ${models[i]!.name} (${i + 1}/${models.length})...`);
                sessions.push(await _ort.InferenceSession.create(`${basePath}/${models[i]!.file}`, sessionOpts));
            }
        } catch {
            onProgress?.("WebGPU unavailable, falling back to WebAssembly...");
            sessionOpts = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
            sessions = [];
            for (let i = 0; i < models.length; i++) {
                onProgress?.(`Loading ${models[i]!.name} (${i + 1}/${models.length})...`);
                sessions.push(await _ort.InferenceSession.create(`${basePath}/${models[i]!.file}`, sessionOpts));
            }
        }

        ttsEngine = new TextToSpeech(cfgs, textProcessor, sessions[0], sessions[1], sessions[2], sessions[3]);
        onProgress?.("TTS models loaded!");
    })();

    return loadingPromise;
}

export async function loadVoiceStyle(styleId: VoiceStyleId): Promise<void> {
    if (currentStyleId === styleId && currentStyle) return;
    const _ort = await getOrt();

    const voice = VOICE_STYLES.find((v) => v.id === styleId);
    if (!voice) throw new Error(`Unknown voice style: ${styleId}`);

    const resp = await fetch(voice.path);
    const data = await resp.json();

    const ttlData = new Float32Array(data.style_ttl.data.flat(Infinity));
    const dpData = new Float32Array(data.style_dp.data.flat(Infinity));

    const ttlTensor = new _ort.Tensor("float32", ttlData, data.style_ttl.dims);
    const dpTensor = new _ort.Tensor("float32", dpData, data.style_dp.dims);

    currentStyle = new Style(ttlTensor, dpTensor);
    currentStyleId = styleId;
}

export async function synthesizeLocal(text: string, voiceStyleId: VoiceStyleId = "F1", steps = 5): Promise<ArrayBuffer> {
    await ensureModelLoaded();
    await loadVoiceStyle(voiceStyleId);

    if (!ttsEngine || !currentStyle) throw new Error("TTS not initialized");

    const { wav, duration } = await ttsEngine.call(text, "en", currentStyle, steps, 1.05, 0.3);
    const wavLen = Math.floor(ttsEngine.sampleRate * duration[0]!);
    const wavOut = wav.slice(0, wavLen);

    return writeWavFile(wavOut, ttsEngine.sampleRate);
}

// ── WAV writer ──
function writeWavFile(audioData: number[], sampleRate: number): ArrayBuffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = audioData.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const ws = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    ws(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    ws(8, "WAVE");
    ws(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    ws(36, "data");
    view.setUint32(40, dataSize, true);

    const int16 = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
        int16[i] = Math.floor(Math.max(-1.0, Math.min(1.0, audioData[i]!)) * 32767);
    }
    new Uint8Array(buffer, 44).set(new Uint8Array(int16.buffer));

    return buffer;
}

// ── Text chunker ──
function chunkText(text: string, maxLen = 300): string[] {
    const paragraphs = text.trim().split(/\n\s*\n+/).filter((p) => p.trim());
    const chunks: string[] = [];

    for (let paragraph of paragraphs) {
        paragraph = paragraph.trim();
        if (!paragraph) continue;
        const sentences = paragraph.split(
            /(?<!Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Sr\.|Jr\.|etc\.|e\.g\.|i\.e\.|vs\.)(?<![A-Z]\.)(?<=[.!?])\s+/,
        );
        let cur = "";
        for (const s of sentences) {
            if (cur.length + s.length + 1 <= maxLen) {
                cur += (cur ? " " : "") + s;
            } else {
                if (cur) chunks.push(cur.trim());
                cur = s;
            }
        }
        if (cur) chunks.push(cur.trim());
    }
    return chunks;
}
