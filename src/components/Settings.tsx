"use client";

import { useAtom } from "jotai";
import { useState, useRef, useEffect, useCallback } from "react";
import { IoClose, IoRefresh } from "react-icons/io5";
import toast from "react-hot-toast";
import {
  llmProviderAtom, llmModelAtom, llmApiKeyAtom, llmBaseUrlAtom,
  maxTokensAtom, systemPromptAtom,
  ttsProviderAtom, ttsApiKeyAtom, ttsVoiceIdAtom, localVoiceStyleAtom, ttsStepsAtom,
  sttProviderAtom, whisperModelAtom,
  usernameAtom, backgroundAtom, customModelPathAtom, memoryEnabledAtom, savedModelsAtom, type SavedModel,
  type LLMProvider, type TTSProvider, type STTProvider,
} from "~/atoms/SettingsAtom";
import { VOICE_STYLES } from "~/lib/LocalTTS";
import { WHISPER_MODELS } from "~/lib/LocalSTT";

interface MemoryFact { id: number; content: string; }
interface Asset { id: number; type: string; name: string; path: string; }

type Tab = "llm" | "voice" | "general";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "llm", label: "LLM", icon: "🧠" },
  { id: "voice", label: "Voice", icon: "🎤" },
  { id: "general", label: "General", icon: "⚙️" },
];

const LLM_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "groq", label: "Groq" },
  { value: "google", label: "Google Gemini" },
  { value: "ollama", label: "Ollama (Local)" },
];

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o-mini", groq: "llama-3.1-8b-instant",
  google: "gemini-2.0-flash", ollama: "llama3",
};

const BACKGROUNDS = [
  { id: "/one.avif", label: "Purple Gradient" },
  { id: "/two.avif", label: "Blue Sky" },
  { id: "/three.avif", label: "Sunset" },
];

interface SettingsProps { open: boolean; onClose: () => void; }

export default function Settings({ open, onClose }: SettingsProps) {
  const [tab, setTab] = useState<Tab>("llm");
  const [llmProvider, setLlmProvider] = useAtom(llmProviderAtom);
  const [llmModel, setLlmModel] = useAtom(llmModelAtom);
  const [llmApiKey, setLlmApiKey] = useAtom(llmApiKeyAtom);
  const [llmBaseUrl, setLlmBaseUrl] = useAtom(llmBaseUrlAtom);
  const [maxTokens, setMaxTokens] = useAtom(maxTokensAtom);
  const [systemPrompt, setSystemPrompt] = useAtom(systemPromptAtom);
  const [ttsProvider, setTtsProvider] = useAtom(ttsProviderAtom);
  const [ttsApiKey, setTtsApiKey] = useAtom(ttsApiKeyAtom);
  const [ttsVoiceId, setTtsVoiceId] = useAtom(ttsVoiceIdAtom);
  const [localVoiceStyle, setLocalVoiceStyle] = useAtom(localVoiceStyleAtom);
  const [ttsSteps, setTtsSteps] = useAtom(ttsStepsAtom);
  const [sttProvider, setSttProvider] = useAtom(sttProviderAtom);
  const [whisperModelId, setWhisperModelId] = useAtom(whisperModelAtom);
  const [username, setUsername] = useAtom(usernameAtom);
  const [background, setBackground] = useAtom(backgroundAtom);
  const [customModelPath, setCustomModelPath] = useAtom(customModelPathAtom);
  const [memoryEnabled, setMemoryEnabled] = useAtom(memoryEnabledAtom);
  const [savedModels, setSavedModels] = useAtom(savedModelsAtom);
  const [ollamaModels, setOllamaModels] = useState<{ name: string }[]>([]);
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);
  const [uploading, setUploading] = useState(false);
  
  // DB States
  const [memories, setMemories] = useState<MemoryFact[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [customBackgrounds, setCustomBackgrounds] = useState<Asset[]>([]);
  const [bgUploading, setBgUploading] = useState(false);
  
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Fetch DB assets
  useEffect(() => {
    if (open && tab === "general") {
      fetch('/api/db/memories').then(r => r.json()).then(d => Array.isArray(d) ? setMemories(d) : null).catch(() => {});
      fetch('/api/upload-bg').then(r => r.json()).then(d => Array.isArray(d) ? setCustomBackgrounds(d) : null).catch(() => {});
    }
  }, [open, tab]);

  const fetchOllamaModels = useCallback(async () => {
    if (llmProvider !== "ollama") return;
    let base = llmBaseUrl || "http://localhost:11434";
    base = base.replace(/\/v1\/?$/, ""); // Strip /v1 if present so we hit /api/tags correctly
    try {
      const res = await fetch(`/api/ollama-models?baseUrl=${encodeURIComponent(base)}`);
      const data = await res.json();
      if (Array.isArray(data)) { setOllamaModels(data); }
      else { setOllamaModels([]); }
    } catch {
      setOllamaModels([]);
      toast.error("Failed to fetch Ollama models");
    }
  }, [llmProvider, llmBaseUrl]);

  // Fetch Ollama models
  useEffect(() => {
    fetchOllamaModels();
  }, [fetchOllamaModels]);

  const handleProviderChange = useCallback((p: LLMProvider) => {
    setLlmProvider(p);
    setLlmModel(DEFAULT_MODELS[p]);
    if (p === "ollama") setLlmBaseUrl("http://localhost:11434/v1");
  }, [setLlmProvider, setLlmModel, setLlmBaseUrl]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const toastId = toast.loading("Uploading model...");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload-model", { method: "POST", body: form });
      const data = await res.json();
      if (data.path) {
        setCustomModelPath(data.path);
        setSavedModels((prev: SavedModel[]) => {
          if (prev.find((m: SavedModel) => m.path === data.path)) return prev;
          return [...prev, { name: data.name || "Custom Model", path: data.path }];
        });
        toast.success("Model uploaded successfully", { id: toastId });
      } else {
        toast.error(data.error || "Upload failed", { id: toastId });
      }
    } catch (err) {
      toast.error("Upload failed: " + err, { id: toastId });
    } finally {
      setUploading(false);
    }
  }, [setCustomModelPath, setSavedModels]);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgUploading(true);
    const toastId = toast.loading("Uploading background...");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload-bg", { method: "POST", body: form });
      const data = await res.json();
      if (data.path) {
        setCustomBackgrounds(prev => [data, ...prev]);
        setBackground(data.path);
        toast.success("Background uploaded!", { id: toastId });
      } else {
        toast.error("Failed to upload", { id: toastId });
      }
    } catch (err) { toast.error("Failed: " + err, { id: toastId }); }
    finally { setBgUploading(false); }
  };

  const deleteBg = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/upload-bg', { method: 'DELETE', body: JSON.stringify({ id }) });
      setCustomBackgrounds(prev => prev.filter(bg => bg.id !== id));
      toast.success("Background deleted");
    } catch {
      toast.error("Failed to delete background");
    }
  };

  const addMemory = async () => {
    if (!newMemory.trim()) return;
    const toastId = toast.loading("Saving memory...");
    try {
      const res = await fetch('/api/db/memories', { method: 'POST', body: JSON.stringify({ content: newMemory }) });
      const data = await res.json();
      if (data.id) {
        setMemories(prev => [...prev, data]);
        toast.success("Fact added to DB", { id: toastId });
      } else {
        toast.error("Failed to add memory", { id: toastId });
      }
      setNewMemory("");
    } catch {
      toast.error("Network error while adding memory", { id: toastId });
    }
  };

  const deleteMemory = async (id: number) => {
    try {
      await fetch('/api/db/memories', { method: 'DELETE', body: JSON.stringify({ id }) });
      setMemories(prev => prev.filter(m => m.id !== id));
      toast.success("Memory deleted");
    } catch {
      toast.error("Failed to delete memory");
    }
  };

  const clearMemory = useCallback(() => {
    localStorage.removeItem("chat_memory");
    toast.success("Chat history cleared!");
    setTimeout(() => window.location.reload(), 500);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md animate-fadeIn" onClick={onClose} />

      {/* Modal */}
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-2xl mx-4 animate-scaleIn"
      >
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#0d0d2b]/90 via-[#1a1a3e]/90 to-[#0d1b2a]/90 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <h2 className="text-lg font-bold text-white tracking-tight">Settings</h2>
            <button onClick={onClose} className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white">
              <IoClose size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 px-6 gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                  tab === t.id
                    ? "border-indigo-400 text-indigo-300"
                    : "border-transparent text-white/50 hover:text-white/80"
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-5 space-y-5 scrollbar-thin">

            {/* ── LLM Tab ── */}
            {tab === "llm" && (
              <>
                <GlassCard title="Provider">
                  <Row label="Provider">
                    <Sel value={llmProvider} onChange={v => handleProviderChange(v as LLMProvider)} options={LLM_PROVIDERS} />
                  </Row>
                  <Row label="Model">
                    {llmProvider === "ollama" && ollamaModels.length > 0 ? (
                      <div className="flex gap-2">
                        <Sel
                          value={llmModel}
                          onChange={setLlmModel}
                          options={ollamaModels.map(m => ({ value: m.name, label: m.name }))}
                        />
                        <button onClick={() => { toast.loading("Refreshing...", {id: "refresh"}); fetchOllamaModels().then(()=>toast.success("Refreshed models",{id:"refresh"}))}} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
                          <IoRefresh size={18} className="text-white/70" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Inp value={llmModel} onChange={setLlmModel} placeholder="e.g. gpt-4o-mini" />
                        {llmProvider === "ollama" && (
                          <button onClick={() => { toast.loading("Refreshing...", {id: "refresh"}); fetchOllamaModels().then(()=>toast.success("Refreshed models",{id:"refresh"}))}} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition">
                            <IoRefresh size={18} className="text-white/70" />
                          </button>
                        )}
                      </div>
                    )}
                  </Row>
                  {llmProvider !== "ollama" && (
                    <Row label="API Key">
                      <Inp value={llmApiKey} onChange={setLlmApiKey} placeholder="sk-..." type="password" />
                    </Row>
                  )}
                  {(llmProvider === "openai" || llmProvider === "ollama") && (
                    <Row label="Base URL">
                      <Inp value={llmBaseUrl} onChange={setLlmBaseUrl} placeholder={llmProvider === "ollama" ? "http://localhost:11434/v1" : "https://api.openai.com/v1"} />
                    </Row>
                  )}
                </GlassCard>

                <GlassCard title="Generation">
                  <Row label={`Max Tokens: ${maxTokens}`}>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={50} max={32768} step={50} value={maxTokens}
                        onChange={e => setMaxTokens(Number(e.target.value))}
                        className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                      />
                      <input 
                        type="number" min={50} max={131072} step={1}
                        value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))}
                        className="w-16 bg-black/30 border border-white/10 rounded px-1 py-1 text-xs text-center text-white outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-white/30 mt-1 pr-16 border-white">
                      <span>50</span><span>4096</span><span>8192</span><span>32k</span>
                    </div>
                  </Row>
                </GlassCard>

                <GlassCard title="System Prompt">
                  <textarea
                    value={localPrompt}
                    onChange={e => setLocalPrompt(e.target.value)}
                    onBlur={() => setSystemPrompt(localPrompt)}
                    rows={5}
                    placeholder="Customize the AI's personality..."
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none resize-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
                  />
                  <p className="text-[11px] text-white/40 mt-1">Use {"{{username}}"} as placeholder for the user&apos;s name.</p>
                </GlassCard>
              </>
            )}

            {/* ── Voice Tab ── */}
            {tab === "voice" && (
              <>
                <GlassCard title="Text-to-Speech">
                  <Row label="Provider">
                    <Sel value={ttsProvider} onChange={v => setTtsProvider(v as TTSProvider)} options={[
                      { value: "elevenlabs", label: "ElevenLabs" },
                      { value: "local", label: "Supertonic 2 (Local)" },
                    ]} />
                  </Row>
                  {ttsProvider === "elevenlabs" && (
                    <>
                      <Row label="API Key">
                        <Inp value={ttsApiKey} onChange={setTtsApiKey} placeholder="ElevenLabs key" type="password" />
                      </Row>
                      <Row label="Voice ID">
                        <Inp value={ttsVoiceId} onChange={setTtsVoiceId} placeholder="e.g. n7Wi4g1bhpw4Bs8HK5ph" />
                      </Row>
                    </>
                  )}
                  {ttsProvider === "local" && (
                    <>
                      <Row label="Voice Style">
                        <Sel value={localVoiceStyle} onChange={setLocalVoiceStyle} options={VOICE_STYLES.map(v => ({ value: v.id, label: v.label }))} />
                      </Row>
                      <Row label={`Denoising Steps: ${ttsSteps}`}>
                        <input
                          type="range" min={1} max={50} step={1} value={ttsSteps}
                          onChange={e => setTtsSteps(Number(e.target.value))}
                          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                        <div className="flex justify-between text-[10px] text-white/30 mt-1">
                          <span>1 (fast)</span><span>5</span><span>25</span><span>50 (quality)</span>
                        </div>
                      </Row>
                    </>
                  )}
                </GlassCard>

                <GlassCard title="Speech-to-Text">
                  <Row label="Provider">
                    <Sel value={sttProvider} onChange={v => setSttProvider(v as STTProvider)} options={[
                      { value: "browser", label: "Browser (Built-in)" },
                      { value: "whisper", label: "Whisper (Local AI)" },
                    ]} />
                  </Row>
                  {sttProvider === "whisper" && (
                    <Row label="Model">
                      <Sel value={whisperModelId} onChange={setWhisperModelId} options={WHISPER_MODELS.map(m => ({ value: m.id, label: `${m.label} (${m.size})` }))} />
                    </Row>
                  )}
                  <p className="text-[11px] text-white/40">
                    {sttProvider === "whisper"
                      ? "🧠 Runs locally via WebGPU. Downloads on first use."
                      : "Uses your browser's built-in recognition."}
                  </p>
                </GlassCard>
              </>
            )}

            {/* ── General Tab ── */}
            {tab === "general" && (
              <>
                <GlassCard title="Profile">
                  <Row label="Your Name">
                    <Inp value={username} onChange={setUsername} placeholder="How should the AI call you?" />
                  </Row>
                </GlassCard>

                <GlassCard title="Background">
                  <div className="grid grid-cols-3 gap-2">
                    {BACKGROUNDS.map(bg => (
                      <button
                        key={bg.id}
                        onClick={() => setBackground(bg.id)}
                        className={`relative h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          background === bg.id ? "border-indigo-400 shadow-lg shadow-indigo-500/20" : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg.id})` }} />
                        <div className="absolute inset-0 bg-black/30 flex items-end justify-center pb-1">
                          <span className="text-[9px] text-white font-medium">{bg.label}</span>
                        </div>
                        {background === bg.id && (
                          <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-indigo-400 border border-white" />
                        )}
                      </button>
                    ))}
                    {customBackgrounds.map(bg => (
                      <button
                        key={bg.id}
                        onClick={() => setBackground(bg.path)}
                        className={`relative h-16 rounded-lg overflow-hidden border-2 transition-all group ${
                          background === bg.path ? "border-indigo-400 shadow-lg shadow-indigo-500/20" : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg.path})` }} />
                        <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-1">
                          <span className="text-[9px] text-white font-medium truncate px-1">{bg.name}</span>
                        </div>
                        {background === bg.path && (
                          <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-indigo-400 border border-white" />
                        )}
                        <button 
                          onClick={(e) => deleteBg(bg.id, e)} 
                          className="absolute top-1 left-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                      </button>
                    ))}
                    <label className="relative h-16 rounded-lg overflow-hidden border-2 border-dashed border-white/20 transition-all hover:border-indigo-400/50 hover:bg-white/5 cursor-pointer flex flex-col items-center justify-center gap-1 group">
                      <span className="text-white/50 group-hover:text-indigo-300 text-xs">
                        {bgUploading ? "..." : "+ Upload"}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} disabled={bgUploading} />
                    </label>
                  </div>
                </GlassCard>

                <GlassCard title="Live2D Model">
                  <div className="space-y-2">
                    <Row label="Active Model">
                      <Sel
                        value={customModelPath || "default"}
                        onChange={v => setCustomModelPath(v === "default" ? "" : v)}
                        options={[
                          { value: "default", label: "Default (Vanilla)" },
                          ...savedModels.map((m: SavedModel) => ({ value: m.path, label: m.name }))
                        ]}
                      />
                    </Row>
                    <div className="flex gap-2 pt-2">
                      <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-white/20 bg-white/5 px-3 py-2 text-center text-sm text-white/60 transition hover:border-indigo-400/50 hover:bg-white/10">
                        {uploading ? "Uploading..." : "📁 Upload ZIP"}
                        <input type="file" accept=".zip" className="hidden" onChange={handleUpload} disabled={uploading} />
                      </label>
                      {customModelPath && (
                         <button
                           onClick={() => {
                             setSavedModels(savedModels.filter((m: SavedModel) => m.path !== customModelPath));
                             setCustomModelPath("");
                           }}
                           className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/20"
                         >
                           Delete
                         </button>
                      )}
                    </div>
                  </div>
                </GlassCard>

                <GlassCard title="Memory & Facts">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white/90">Chat History</p>
                      <p className="text-[10px] text-white/40">Remember recent messages via local storage</p>
                    </div>
                    <button
                      onClick={() => setMemoryEnabled(!memoryEnabled)}
                      className={`relative w-11 h-6 rounded-full transition-all ${memoryEnabled ? "bg-indigo-500" : "bg-white/20"}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${memoryEnabled ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  </div>

                  <hr className="border-white/10 my-3" />
                  
                  <div className="mb-2">
                    <p className="text-sm font-medium text-white/90">User Facts</p>
                    <p className="text-[10px] text-white/40">These facts are permanently saved in the database and fed to the AI context.</p>
                  </div>
                  
                  <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-thin pr-1">
                    {memories.map(m => (
                      <div key={m.id} className="flex gap-2 items-center bg-white/5 rounded-lg px-3 py-2 border border-white/5 group transition hover:border-white/10">
                        <span className="flex-1 text-xs text-white/80">{m.content}</span>
                        <button onClick={() => deleteMemory(m.id)} className="text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">✕</button>
                      </div>
                    ))}
                    {memories.length === 0 && <p className="text-xs text-white/30 text-center py-2 italic">No facts saved yet.</p>}
                  </div>

                  <div className="flex gap-2 mt-2">
                    <input
                      value={newMemory}
                      onChange={e => setNewMemory(e.target.value)}
                      placeholder="e.g. I live in Tokyo..."
                      className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/50"
                      onKeyDown={e => e.key === "Enter" && addMemory()}
                    />
                    <button onClick={addMemory} className="rounded-lg bg-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/30 transition">Add</button>
                  </div>
                </GlassCard>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-indigo-400 hover:to-purple-500 hover:shadow-indigo-500/30 active:scale-[0.98]"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
        .animate-scaleIn { animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      `}</style>
    </div>
  );
}

/* ── Sub-components ── */

function GlassCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.04] backdrop-blur-sm p-4 space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400/80">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-white/60">{label}</span>
      {children}
    </div>
  );
}

function Inp({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
    />
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-[#12122a] px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
