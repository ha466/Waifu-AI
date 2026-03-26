"use client";

import type { CoreMessage } from "ai";
import { useAtom } from "jotai";
import { useEffect, useRef, useState, useCallback, useDeferredValue } from "react";
import toast from "react-hot-toast";
import { IoSend } from "react-icons/io5";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import {
  isLoadingAtom, lastMessageAtom, messageHistoryAtom, audioAnalyserAtom, audioPlayingAtom
} from "~/atoms/ChatAtom";
import {
  llmProviderAtom, llmModelAtom, llmApiKeyAtom, llmBaseUrlAtom,
  maxTokensAtom, systemPromptAtom,
  ttsProviderAtom, ttsApiKeyAtom, ttsVoiceIdAtom, localVoiceStyleAtom, ttsStepsAtom,
  sttProviderAtom, whisperModelAtom,
  usernameAtom, memoryEnabledAtom,
} from "~/atoms/SettingsAtom";
import type { VoiceStyleId } from "~/lib/LocalTTS";
import type { WhisperModel } from "~/lib/LocalSTT";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface IWindow extends Window { SpeechRecognition: any; webkitSpeechRecognition: any; }

const MEMORY_KEY = "chat_memory";

export default function ChatInput() {
  const [messages, setMessages] = useAtom(messageHistoryAtom);
  const [, setLastMessage] = useAtom(lastMessageAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom);
  const [, setAudioAnalyser] = useAtom(audioAnalyserAtom);
  const [, setAudioPlaying] = useAtom(audioPlayingAtom);
  const [input, setInput] = useState("");
  const deferredInput = useDeferredValue(input);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const generationIdRef = useRef<number>(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isAudioContextReady, setIsAudioContextReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [sttStatus, setSttStatus] = useState("");

  // Settings
  const [llmProvider] = useAtom(llmProviderAtom);
  const [llmModel] = useAtom(llmModelAtom);
  const [llmApiKey] = useAtom(llmApiKeyAtom);
  const [llmBaseUrl] = useAtom(llmBaseUrlAtom);
  const [maxTokens] = useAtom(maxTokensAtom);
  const [systemPrompt] = useAtom(systemPromptAtom);
  const [ttsProvider] = useAtom(ttsProviderAtom);
  const [ttsApiKey] = useAtom(ttsApiKeyAtom);
  const [ttsVoiceId] = useAtom(ttsVoiceIdAtom);
  const [localVoiceStyle] = useAtom(localVoiceStyleAtom);
  const [ttsSteps] = useAtom(ttsStepsAtom);
  const [sttProvider] = useAtom(sttProviderAtom);
  const [whisperModel] = useAtom(whisperModelAtom);
  const [username] = useAtom(usernameAtom);
  const [memoryEnabled] = useAtom(memoryEnabledAtom);

  // ── Memory: load on mount ──
  useEffect(() => {
    if (!memoryEnabled) return;
    try {
      const saved = localStorage.getItem(MEMORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CoreMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch { /* ignore */ }
  }, [memoryEnabled, setMessages]);

  // ── Memory: save on change ──
  useEffect(() => {
    if (!memoryEnabled) return;
    if (messages.length > 0) localStorage.setItem(MEMORY_KEY, JSON.stringify(messages));
  }, [messages, memoryEnabled]);

  // ── Browser SpeechRecognition ──
  useEffect(() => {
    if (sttProvider !== "browser") return;
    const w = window as unknown as IWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (SR) {
      recognitionRef.current = new SR();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";
      recognitionRef.current.onresult = (e: any) => {
        let interim = "", final_ = "";
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) final_ += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        setTranscript(interim || final_);
        if (final_) setInput(p => p + final_);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
    return () => { recognitionRef.current?.stop(); };
  }, [sttProvider]);

  // ── Toggle listening ──
  const toggleListening = useCallback(async () => {
    if (sttProvider === "browser") {
      if (!recognitionRef.current) return toast.error("Speech recognition not supported in this browser.");
      if (isListening) recognitionRef.current.stop();
      else { recognitionRef.current.start(); setTranscript(""); }
      setIsListening(p => !p);
    } else {
      if (isListening) {
        mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
        setIsListening(false);
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioChunksRef.current = [];
          const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
          mediaRecorderRef.current = mr;
          mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
          mr.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            if (!audioChunksRef.current.length) return;
            setSttStatus("Transcribing...");
            try {
              const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
              const buf = await blob.arrayBuffer();
              const ctx = new AudioContext();
              const ab = await ctx.decodeAudioData(buf);
              const ch = ab.getChannelData(0);
              ctx.close();
              const { transcribeAudio } = await import("~/lib/LocalSTT");
              const text = await transcribeAudio(ch, ab.sampleRate, whisperModel as WhisperModel, msg => setSttStatus(msg));
              if (text) { setInput(p => p + text); setTranscript(text); }
              setSttStatus("");
            } catch (err) { console.error(err); toast.error("Transcription failed."); setSttStatus("Failed"); setTimeout(() => setSttStatus(""), 2000); }
          };
          mr.start();
          setIsListening(true);
          setTranscript("");
        } catch { toast.error("Could not access microphone."); }
      }
    }
  }, [isListening, sttProvider, whisperModel]);

  // ── Audio context + analyser ──
  useEffect(() => {
    const init = async () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.3;
        analyser.connect(audioContextRef.current.destination);
        analyserNodeRef.current = analyser;
        setAudioAnalyser(analyser);
      }
      if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
      setIsAudioContextReady(true);
    };
    ["click", "touchstart"].forEach(ev => document.addEventListener(ev, init));
    return () => {
      ["click", "touchstart"].forEach(ev => document.removeEventListener(ev, init));
      audioContextRef.current?.close();
      setAudioAnalyser(null);
    };
  }, [setAudioAnalyser]);

  // ── TTS ──
  const synthesizeSentence = useCallback(async (sentence: string): Promise<AudioBuffer | null> => {
    try {
      if (ttsProvider === "local") {
        const { synthesizeLocal } = await import("~/lib/LocalTTS");
        const wav = await synthesizeLocal(sentence, localVoiceStyle as VoiceStyleId, ttsSteps);
        return await audioContextRef.current!.decodeAudioData(wav);
      }
      const res = await fetch("/api/synthasize", {
        method: "POST",
        body: JSON.stringify({ message: { content: sentence, role: "assistant" }, provider: ttsProvider, apiKey: ttsApiKey, voiceId: ttsVoiceId }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(res.statusText);
      return await audioContextRef.current!.decodeAudioData(await res.arrayBuffer());
    } catch (err) { console.error(err); toast.error("Voice synthesis failed."); return null; }
  }, [ttsProvider, ttsApiKey, ttsVoiceId, localVoiceStyle, ttsSteps]);

  const playSentence = useCallback((ab: AudioBuffer): Promise<void> => {
    return new Promise(resolve => {
      if (!audioContextRef.current) return resolve();
      if (audioContextRef.current.state === "suspended") audioContextRef.current.resume();
      sourceNodeRef.current?.stop();
      sourceNodeRef.current?.disconnect();
      sourceNodeRef.current = audioContextRef.current.createBufferSource();
      sourceNodeRef.current.buffer = ab;
      if (analyserNodeRef.current) sourceNodeRef.current.connect(analyserNodeRef.current);
      else sourceNodeRef.current.connect(audioContextRef.current.destination);
      sourceNodeRef.current.onended = () => resolve();
      sourceNodeRef.current.start();
    });
  }, []);

  const playNext = useCallback(async (genId: number) => {
    if (generationIdRef.current !== genId || !audioQueueRef.current.length) { 
        isPlayingRef.current = false; 
        setAudioPlaying(false);
        return; 
    }
    const a = audioQueueRef.current.shift();
    if (a) await playSentence(a);
    if (generationIdRef.current === genId) playNext(genId);
  }, [playSentence, setAudioPlaying]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // Abort previous TTS and clear queue
    generationIdRef.current += 1;
    const currentGen = generationIdRef.current;
    audioQueueRef.current = [];
    try { sourceNodeRef.current?.stop(); } catch (e) { /* ignore if already stopped */ }
    isPlayingRef.current = false;
    setAudioPlaying(false);
    
    setIsLoading(true);
    const newMsgs: CoreMessage[] = [...messages, { content: input, role: "user" }];
    setMessages(newMsgs);
    setInput("");
    setTranscript("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: newMsgs, username, provider: llmProvider, model: llmModel,
          apiKey: llmApiKey, baseUrl: llmBaseUrl, maxTokens, systemPrompt,
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || res.statusText);
      }
      const result = (await res.json()) as CoreMessage;
      setLastMessage(result);
      setMessages([...newMsgs, result]);
      setIsLoading(false);

      if (typeof result.content === "string") {
        const sentences = result.content.split(/(?<=\.|\?|!)/).map(s => s.trim()).filter(Boolean);
        (async () => {
          for (const s of sentences) {
            if (currentGen !== generationIdRef.current) break;
            const ab = await synthesizeSentence(s);
            if (currentGen !== generationIdRef.current) break;
            if (ab) {
              audioQueueRef.current.push(ab);
              if (!isPlayingRef.current && isAudioContextReady) { 
                isPlayingRef.current = true; 
                setAudioPlaying(true);
                playNext(currentGen); 
              }
            }
          }
        })();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to fetch response");
      setIsLoading(false);
    }
  }, [messages, input, setMessages, setLastMessage, setIsLoading, synthesizeSentence, playNext, isAudioContextReady, username, llmProvider, llmModel, llmApiKey, llmBaseUrl, maxTokens, systemPrompt, setAudioPlaying]);

  return (
    <div className="absolute bottom-10 h-10 w-full max-w-lg px-5 z-20" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <form onSubmit={handleSubmit}>
        <div className={`flex w-full items-center overflow-hidden rounded-[12px] bg-white shadow transition-all duration-300 ${
          isListening ? "border-red-400 shadow-red-400/20 shadow-lg" :
          isHovered || input ? "border-[rgb(196,191,228)] shadow-lg scale-105" : "border-transparent"
        } border-2`}>
          <div className="flex h-full items-center justify-center px-4">
            <button type="button" onClick={toggleListening} disabled={isLoading}
              className={`p-1 rounded-full transition-all ${isListening ? "bg-red-100 animate-pulse" : "hover:bg-gray-100"}`}>
              {isListening ? <FaMicrophoneSlash className="text-red-500" /> : <FaMicrophone className="text-gray-500 hover:text-gray-700" />}
            </button>
          </div>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              className="h-full w-full px-2 py-2 text-neutral-800 outline-none"
              type="text"
              placeholder={sttStatus || (isListening ? (sttProvider === "whisper" ? "🔴 Recording... click mic to stop" : transcript || "Listening...") : "Enter your message...")}
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !isLoading && handleSubmit(e as any)}
              disabled={isLoading}
            />
          </div>
          <div className="flex h-full items-center justify-center px-4">
            <button type="submit" disabled={isLoading}><IoSend className="text-blue-400 transition-colors hover:text-blue-500" /></button>
          </div>
        </div>
      </form>
    </div>
  );
}