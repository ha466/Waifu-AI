"use client";

import { useAtom } from "jotai";
import React, { useEffect, useState } from "react";
import { isLoadingAtom, lastMessageAtom, audioPlayingAtom } from "~/atoms/ChatAtom";
import Spinner from "./Spinner";

export default function ChatterBox() {
  const [message] = useAtom(lastMessageAtom);
  const [isLoading] = useAtom(isLoadingAtom);
  const [isPlaying] = useAtom(audioPlayingAtom);
  const [key, setKey] = useState(0);
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setKey(prevKey => prevKey + 1);
    setDisplayedText("");
  }, [message]);

  useEffect(() => {
    if (!message?.content) return;
    const text = message.content as string;
    let i = 0;
    setDisplayedText("");
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 15);
    return () => clearInterval(interval);
  }, [message?.content]);

  if (!message && !isLoading) {
    return null;
  }

  // Auto-hide when audio stops playing and we're not loading
  if (!isLoading && !isPlaying) {
    return null;
  }

  return (
    <div className="absolute bottom-28 right-8 flex flex-col items-end z-20">
      {isLoading ? (
        <Spinner />
      ) : (
        <div
          key={key}
          className="flex max-w-[340px] justify-start rounded-2xl rounded-br-sm border-[2px] border-white/20 bg-black/60 backdrop-blur-md p-4 shadow-lg animate-message-appear"
        >
          <span className="text-sm font-medium text-white/90 leading-relaxed text-left whitespace-pre-wrap">
            {displayedText}
            <span className="inline-block w-1.5 h-3 ml-0.5 align-baseline bg-indigo-400 animate-pulse" />
          </span>
        </div>
      )}
      <style jsx>{`
        @keyframes messageAppear {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-message-appear {
          animation: messageAppear 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}