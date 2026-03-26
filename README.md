# AI Waifu 🌸

A modern, highly customizable AI companion platform powered by Next.js, Live2D, and local/remote AI models.

## ✨ Features
- **Live2D Drag & Drop**: Load any custom Live2D model via `.zip` uploads directly in the UI. Move, scale, and interact with the avatar seamlessly.
- **Local & Remote LLMs**: Switch instantly between local models running on **Ollama**, or cloud providers like **Groq**, **OpenAI**, and **Google Gemini**.
- **Persistent Database Memory**: Powered by Prisma and SQLite. Add specific "User Facts" that the AI will always remember and inject into its system prompt context.
- **Voice Interactions**: Leverage built-in highly responsive Web Speech API, or use local ONNX **Whisper** integration for Speech-to-Text. For voice generation, use local **Supertonic 2** or **ElevenLabs**.
- **Glassy Modern UI**: A completely overhauled, dark-themed, glassmorphism UI offering deep customization over tokens, voices, and dynamic backgrounds.
- **Auto-Hiding ChatterBox**: Real-time typewriter text streaming that perfectly syncs with speech and hides seamlessly when the character stops talking.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- pnpm (>= 9.0.0)

### Installation
1. **Clone the repository:**
   ```sh
   git clone https://github.com/LazerCuber/Waifu-AI.git
   cd Waifu-AI
   ```
2. **Install dependencies:**
   ```sh
   pnpm install
   ```
3. **Database Setup:**
   Initialize the SQLite database for custom user memories and assets.
   ```sh
   pnpm dlx prisma db push
   ```
4. **Environment Variables:**
   Rename `.env.example` to `.env` (or create a new `.env` file) and add any applicable keys:
   ```env
   OPENAI_API_KEY="your_api_key_here"
   GROQ_API_KEY="your_api_key_here"
   GOOGLE_API_KEY="your_api_key_here"
   ELEVENLABS_API_KEY="your_api_key_here"
   DATABASE_URL="file:./dev.db"
   ```
   *(Note: You can also configure these API keys and provider selections directly inside the application's Settings UI without restarting the server!)*

5. **Start the Development Server:**
   ```sh
   pnpm run dev
   ```
6. **Interact!**
   Open [http://localhost:3000](http://localhost:3000) and click the microphone icon at the bottom of the screen to start chatting. You can access the unified Settings Modal using the gear icon in the top right.

## 🛠 Tech Stack
- **Framework**: Next.js 14, React 18
- **Styling**: Tailwind CSS, Jotai (State Management), React Hot Toast
- **Database**: Prisma ORM, SQLite
- **Avatar Engine**: Pixi.js, Pixi-Live2D-Display
- **AI/ML**: Vercel AI SDK, ONNX Runtime Web, Hugging Face Transformers

---
*Inspired by the original wAIfu repo, completely overhauled for stability, local inference, component modularity, and database persistence.*


# Project File Diagram

Below is the architecture and file diagram for the AI Waifu application.

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
