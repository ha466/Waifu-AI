import type { CoreMessage } from "ai";
import { atom } from "jotai";

export const messageHistoryAtom = atom<CoreMessage[]>([]);
export const lastMessageAtom = atom<CoreMessage | null>(null);
export const isLoadingAtom = atom(false);
export const displayedTextAtom = atom<string>('');
export const audioPlayingAtom = atom(false);

// Shared audio analyser for lip sync — set by ChatInput, read by Model
export const audioAnalyserAtom = atom<AnalyserNode | null>(null);
