# LLM Council Backend

NestJS backend for the **LLM Council** application.  
It orchestrates a 3‑stage “LLM council” over the OpenRouter API and streams structured events back to the React frontend.

### Tech stack

- **Framework**: NestJS 11
- **Runtime**: Node.js (recommended: 20+)
- **LLM Gateway**: OpenRouter (`https://openrouter.ai`)

---

## Getting started

### 1. Install dependencies

From the project root:

```bash
cd backend
npm install
```

### 2. Configure environment

The backend can read the OpenRouter API key either from incoming requests or from an environment variable.

- **Optional**
  - `PORT` – HTTP port for the Nest app (default: `3001`).

You can create a simple `.env` (or set system env vars) like:

```bash
PORT=3001
```

### 3. Run the server

```bash
cd backend
npm run start:dev
```

The backend will be available at `http://localhost:3001` (or `http://localhost:$PORT`).

---

## Council configuration

Default council models and chairman model are defined in `src/common/config.ts`:

- `COUNCIL_MODELS` – array of OpenRouter model IDs used as council members (e.g. `openai/gpt-5.2`, `google/gemini-3-pro-preview`, `anthropic/claude-sonnet-4.5`).
- `CHAIRMAN_MODEL` – single model used in Stage 3 to synthesize the final answer (default: `openai/gpt-5.2`).

You can override these **per request** via the `council_models` and `chairman_model` fields in the request body (see below).

---

## API

Base path: `http://localhost:3001/api/council`

### POST `/process`

Start a council processing request.  
Response is streamed as **Server‑Sent Events (SSE)** with `Content-Type: text/event-stream`.

**Request body**

```json
{
  "content": "Your question here",
  "api_key": "sk-or-v1-... (optional)",
  "council_models": ["openai/gpt-5.2", "google/gemini-3-pro-preview"],
  "chairman_model": "openai/gpt-5.2",
  "generate_title": true
}
```

- **content** (string, required): user question or prompt.
- **api_key** (string, optional): OpenRouter API key for this request; falls back to `OPENROUTER_API_KEY` env var if omitted.
- **council_models** (string[], optional): override the default council models for this request.
- **chairman_model** (string, optional): override the default chairman model for this request.
- **generate_title** (boolean, optional): if `true`, an additional `title_complete` event is emitted.

**Streaming response**

Events are sent in lines prefixed with `data: `, each containing a JSON object. Example sequence:

```text
data: {"type":"stream_start","stage":"stream_start","message":"Stream initialized","timestamp":"2024-12-15T..."} 

data: {"type":"stage1_start","stage":"stage1_start","message":"Collecting individual responses...","timestamp":"..."}

data: {"type":"stage1_complete","stage":"stage1_complete","data":[/* Stage 1 results */],"message":"Stage 1 complete","timestamp":"..."}

data: {"type":"stage2_start","stage":"stage2_start","message":"Collecting peer rankings...","timestamp":"..."}

data: {"type":"stage2_complete","stage":"stage2_complete","data":[/* Stage 2 results */],"metadata":{/* label_to_model, aggregate_rankings */},"message":"Stage 2 complete","timestamp":"..."}

data: {"type":"stage3_start","stage":"stage3_start","message":"Synthesizing final answer...","timestamp":"..."}

data: {"type":"stage3_complete","stage":"stage3_complete","data":{/* final synthesis */},"message":"Stage 3 complete","timestamp":"..."}

data: {"type":"title_complete","stage":"title_complete","data":{"title":"..."},"timestamp":"..."}

data: {"type":"complete","stage":"complete","message":"Council process complete","timestamp":"..."}
```

On error, an event with `type: "error"` is emitted.

### GET `/process/:traceId/status`

Return the last known status for a given `traceId` (if tracked by `CouncilStatusService`).  
This is useful for polling‑based or diagnostic clients; the current React frontend relies primarily on SSE streaming instead.

---

## Development scripts

From the `backend` directory:

- `npm run start` – start NestJS in normal mode
- `npm run start:dev` – start development server with hot reload
- `npm run start:debug` – start in debug mode with watch
- `npm run start:prod` – start compiled app from `dist/main.js`
- `npm run build` – compile TypeScript to `dist`
- `npm run lint` – run ESLint
- `npm run test` / `test:watch` / `test:cov` / `test:e2e` – run unit/e2e tests


