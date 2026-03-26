"use client";
import { useEffect, useState, memo } from 'react';
import dynamic from 'next/dynamic';
import { useAtomValue } from 'jotai';
import { IoSettingsSharp } from 'react-icons/io5';
import { backgroundAtom } from '~/atoms/SettingsAtom';
import ChatInput from "~/components/ChatInput";

const Bg = memo(({ src }: { src: string }) => (
  <div
    className="absolute inset-0 z-0 overflow-hidden bg-cover bg-center transition-all duration-700"
    style={{ backgroundImage: `url(${src})` }}
  />
));

const Box = dynamic(() => import("~/components/ChatterBox"), { ssr: false });
const Model = dynamic(() => import("~/components/Model"), { ssr: false });
const Settings = dynamic(() => import("~/components/Settings"), { ssr: false });

const Dots = () => (
  <div className="flex space-x-2 animate-pulse">
    {[...Array(3)].map((_, i) => <div key={i} className="w-3 h-3 bg-gray-500 rounded-full" />)}
  </div>
);

export default function Page() {
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const background = useAtomValue(backgroundAtom);

  useEffect(() => {
    const s = document.createElement('script');
    s.src = '/live2dcubismcore.min.js';
    s.defer = true;
    s.onload = () => setReady(true);
    document.body.appendChild(s);
    return () => { document.body.removeChild(s); };
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <Bg src={background} />

      <button
        onClick={() => setSettingsOpen(true)}
        className="absolute top-5 right-5 z-30 rounded-full p-3 text-white/60 backdrop-blur-md bg-white/10 border border-white/10 shadow-lg transition-all hover:bg-white/20 hover:text-white hover:scale-110 hover:rotate-90 duration-300"
        aria-label="Open settings"
      >
        <IoSettingsSharp size={22} />
      </button>

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full slideUp">
        <ChatInput />
        <div className="h-screen flex justify-center items-center w-full">
          {!ready ? <Dots /> : (<><Box /><Model /></>)}
        </div>
      </div>
    </main>
  );
}