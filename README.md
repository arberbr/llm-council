## LLM Council

LLM Council is a full‑stack demo that lets you run a “council” of different LLMs via **OpenRouter** and view a structured, 3‑stage reasoning process:

- **Stage 1** – each model responds independently  
- **Stage 2** – models rank and critique each other’s responses  
- **Stage 3** – a “chairman” model synthesizes a final answer

The frontend is a React + Vite single‑page app; the backend is a NestJS service that orchestrates the council and streams events back to the UI.

---

## Architecture overview

- **Frontend (this package)**
  - React + Vite app in `src/`
  - Routing and URL‑based conversation selection via `react-router-dom`
  - Conversations stored entirely in `localStorage` (`src/libs/storage.js`)
  - Backend used only for LLM council processing (`src/libs/api.js`)
  - Three main UI regions:
    - `LeftSidebar` – conversation list and actions
    - `ChatInterface` – messages and 3‑stage council results
    - `RightSidebar` – settings (OpenRouter key, models selection, etc.)

- **Backend (`backend/` folder)**
  - NestJS app exposing `/api/council/process` and `/api/council/process/:traceId/status`
  - Uses `OpenRouterService` to talk to OpenRouter (`https://openrouter.ai`)
  - Orchestration logic in `CouncilService`:
    - parallel model queries (Stage 1)
    - peer ranking and aggregate ranking (Stage 2)
    - chairman synthesis and optional title generation (Stage 3)
  - Streams structured SSE events consumed by the frontend

---

## Prerequisites

- **Node.js** 20+ (recommended)
- **npm** 10+  
- An **OpenRouter** account and API key (`https://openrouter.ai`)

---

## Installation

Clone the repo and install dependencies for the frontend:

```bash
git clone <this-repo-url>
cd llm-council
npm install
```

> For backend setup and deployment details, see `backend/README.md`.

---

## Configuration

### Frontend (root)

Frontend talks to the backend via `VITE_REACT_BACKEND_API`.  
If not set, it defaults to `http://localhost:3001`.

Create `.env` in the project root if you need to customize:

```bash
VITE_REACT_BACKEND_API=http://localhost:3001
```

At runtime, the user sets:

- **OpenRouter API key** – stored in `localStorage` (`openRouterApiKey`)
- **Council models** – JSON‑encoded array in `localStorage` (`councilModels`)
- **Chairman model** – single model id in `localStorage` (`chairmanModel`)

---

## Running in development

### Start the frontend

From the project root:

```bash
npm run dev
```

Vite will start on `http://localhost:5173` (by default).

---

## Usage

1. Open the app in your browser (e.g. `http://localhost:5173`).
2. On the **Settings** panel (right sidebar):
   - paste your **OpenRouter API key** (required)
   - choose **council models** (at least 2)
   - choose a **chairman model** (required)
3. Create a new conversation from the left sidebar.
4. Ask a question in the chat input and send it.
5. Watch the 3 stages stream in:
   - Stage 1 responses from each model
   - Stage 2 rankings plus aggregate rankings and label → model mapping
   - Stage 3 final synthesis and optional title

Conversations and messages are stored locally in your browser (no backend persistence).

---

## Scripts

From the **frontend (root)**:

- `npm run dev` – start Vite dev server
- `npm run build` – create production build
- `npm run preview` – preview production build
- `npm run lint` – run ESLint