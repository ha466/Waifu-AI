# Project File Diagram

Below is the high-level architecture and file diagram for the AI Waifu application.

```text
Waifu-AI/
├── .env                     (Environment Variables)
├── README.md                (Project Documentation)
├── next.config.js           (Next.js Configuration)
├── package.json             (Project Dependencies & Scripts)
├── tailwind.config.ts       (Tailwind CSS Configuration)
├── tsconfig.json            (TypeScript Configuration)
│
├── prisma/                  (Database Configuration)
│   └── schema.prisma        (SQLite Database Schema: AppConfig, Asset, MemoryFact)
│
├── public/                  (Static Assets)
│   ├── backgrounds/         (User-uploaded custom backgrounds)
│   ├── model/               (Vanilla Live2D models)
│   ├── one.avif, etc.       (Default Backgrounds)
│
└── src/                     (Application Source Code)
    ├── app/                 (Next.js App Router)
    │   ├── api/             (Backend API Routes)
    │   │   ├── chat/        (LLM Inference Route)
    │   │   ├── db/          (SQLite Memory CRUD)
    │   │   ├── ollama-models/(Local Ollama Fetcher)
    │   │   ├── synthasize/  (Cloud TTS processing)
    │   │   ├── upload-bg/   (Background Image uploader)
    │   │   └── upload-model/(Live2D ZIP uploader)
    │   ├── layout.tsx       (Root Layout & Providers)
    │   └── page.tsx         (Main UI Entry Point & Canvas)
    │
    ├── atoms/               (Jotai State Management)
    │   ├── ChatAtom.ts      (Chat UI state)
    │   └── SettingsAtom.ts  (Configuration & preferences)
    │
    ├── components/          (React UI Components)
    │   ├── ChatInput.tsx    (Text & Voice Input, STT handling)
    │   ├── ChatterBox.tsx   (AI Text streaming output)
    │   ├── Model.tsx        (Pixi.js Live2D Viewer)
    │   ├── Settings.tsx     (Glassmorphism Settings UI)
    │   └── Spinner.tsx      (Loading Indicator)
    │
    ├── lib/                 (Core Libraries & Utilities)
    │   ├── LocalSTT.ts      (ONNX WebGPU Whisper Inference)
    │   ├── LocalTTS.ts      (ONNX WebGPU Supertonic-2 Inference)
    │   └── db.ts            (Global Prisma Client Singleton)
    │
    └── styles/
        └── globals.css      (Global CSS & Tailwind Imports)
```
