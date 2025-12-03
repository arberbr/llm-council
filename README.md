# LLM Council

![llmcouncil](header.jpg)

A local web application that creates an "LLM Council" by querying multiple large language models simultaneously, having them evaluate each other's responses, and synthesizing a final answer through a designated Chairman model. Instead of asking a single LLM provider (e.g., OpenAI GPT-5.1, Google Gemini 3.0 Pro, Anthropic Claude Sonnet 4.5, xAI Grok-4), you can consult them all as a council and see their collective wisdom.

## How It Works

The application uses a 3-stage deliberation process:

### Stage 1: First Opinions
The user's query is sent to all council members in parallel. Each LLM provides its individual response, which is displayed in a tabbed interface so you can inspect each model's answer side-by-side.

### Stage 2: Peer Review
Each council member receives the responses from all other members, but with **anonymized identities** (labeled as "Response A", "Response B", etc.) to prevent bias. Each model evaluates and ranks the responses based on accuracy and insight. The system calculates aggregate rankings across all peer evaluations.

### Stage 3: Final Synthesis
The designated Chairman model receives all individual responses and peer rankings, then synthesizes them into a single comprehensive final answer that represents the council's collective wisdom.

## Features

- **Multi-LLM Consultation**: Query multiple models simultaneously via OpenRouter
- **Anonymized Peer Review**: Models evaluate each other without knowing identities to prevent bias
- **Real-time Streaming**: Watch the 3-stage process unfold in real-time with Server-Sent Events
- **Conversation Management**: Create, view, and delete conversations with auto-generated titles
- **Transparent Process**: Inspect raw model outputs, rankings, and parsed results at each stage
- **Markdown Support**: Full markdown rendering for all responses
- **Dark/Light Theme**: Toggle between themes for comfortable viewing

## Vibe Code Alert

This project was 99% vibe coded as a fun Saturday hack to explore and evaluate multiple LLMs side-by-side, inspired by [reading books together with LLMs](https://x.com/karpathy/status/1990577951671509438). It's useful to see multiple responses side-by-side and the cross-opinions of all LLMs on each other's outputs. 

**This project is provided as-is for inspiration.** I don't intend to maintain or improve it. Code is ephemeral now and libraries are over—ask your LLM to change it in whatever way you like.

## Prerequisites

- Python 3.10 or higher
- Node.js and npm
- [uv](https://docs.astral.sh/uv/) package manager for Python
- OpenRouter API key ([get one here](https://openrouter.ai/))

## Setup

### 1. Install Dependencies

**Backend (Python):**
```bash
uv sync
```

**Frontend (JavaScript):**
```bash
cd frontend
npm install
cd ..
```

### 2. Configure API Key

Create a `.env` file in the project root:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Get your API key at [openrouter.ai](https://openrouter.ai/). Make sure to purchase credits or sign up for automatic top-up.

### 3. Configure Models (Optional)

Edit `backend/config.py` to customize your council:

```python
COUNCIL_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4",
]

CHAIRMAN_MODEL = "google/gemini-3-pro-preview"
```

You can use any model identifier supported by OpenRouter. The chairman model can be the same as or different from the council members.

## Running the Application

### Option 1: Use the Start Script (Recommended)

```bash
./start.sh
```

This script starts both the backend and frontend servers. The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8001

Press `Ctrl+C` to stop both servers.

### Option 2: Run Manually

**Terminal 1 (Backend):**
```bash
uv run python -m backend.main
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

## Project Structure

```
llm-council/
├── backend/                 # FastAPI backend
│   ├── __init__.py
│   ├── main.py             # FastAPI app and API endpoints
│   ├── council.py          # 3-stage council orchestration logic
│   ├── openrouter.py       # OpenRouter API client
│   ├── storage.py          # JSON-based conversation storage
│   └── config.py           # Configuration (models, API keys)
├── frontend/               # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx         # Main app component
│   │   ├── api.js          # API client
│   │   ├── components/
│   │   │   ├── ChatInterface.jsx  # Main chat UI
│   │   │   ├── Sidebar.jsx        # Conversation list
│   │   │   ├── Stage1.jsx         # Individual responses view
│   │   │   ├── Stage2.jsx         # Peer rankings view
│   │   │   └── Stage3.jsx         # Final synthesis view
│   │   └── ThemeContext.jsx       # Theme management
│   └── package.json
├── data/
│   └── conversations/      # JSON conversation storage
├── start.sh                # Startup script
├── pyproject.toml          # Python dependencies
└── README.md
```

## API Endpoints

The backend provides a REST API with the following endpoints:

- `GET /` - Health check
- `GET /api/conversations` - List all conversations (metadata only)
- `POST /api/conversations` - Create a new conversation
- `GET /api/conversations/{id}` - Get a specific conversation
- `DELETE /api/conversations/{id}` - Delete a conversation
- `POST /api/conversations/{id}/message` - Send a message (non-streaming)
- `POST /api/conversations/{id}/message/stream` - Send a message (streaming via SSE)

## Tech Stack

- **Backend:**
  - FastAPI (Python web framework)
  - httpx (async HTTP client)
  - OpenRouter API (unified LLM API)
  - uvicorn (ASGI server)
  - python-dotenv (environment variables)

- **Frontend:**
  - React 19
  - Vite (build tool)
  - react-markdown (markdown rendering)
  - react-router-dom (routing)

- **Storage:**
  - JSON files in `data/conversations/`

- **Package Management:**
  - uv for Python dependencies
  - npm for JavaScript dependencies

## How Stage 2 Anonymization Works

To prevent models from playing favorites, responses are anonymized during peer review:

1. Responses are labeled as "Response A", "Response B", "Response C", etc.
2. Models receive only these anonymous labels, not the actual model names
3. The backend maintains a `label_to_model` mapping for de-anonymization
4. The frontend displays model names in **bold** for readability, with a note that the original evaluation used anonymous labels
5. This ensures unbiased peer evaluation while maintaining transparency

## Data Flow

```
User Query
    ↓
Stage 1: Parallel queries → [individual responses]
    ↓
Stage 2: Anonymize → Parallel ranking queries → [evaluations + parsed rankings]
    ↓
Aggregate Rankings Calculation → [sorted by avg position]
    ↓
Stage 3: Chairman synthesis with full context
    ↓
Return: {stage1, stage2, stage3, metadata}
    ↓
Frontend: Display with tabs + validation UI
```

The entire flow uses async/parallel operations where possible to minimize latency.

## Configuration Details

### Ports
- **Backend**: 8001 (configurable in `backend/main.py`)
- **Frontend**: 5173 (Vite default, configurable in `frontend/vite.config.js`)

### Storage
Conversations are stored as JSON files in `data/conversations/`. Each conversation includes:
- `id`: Unique identifier
- `created_at`: ISO timestamp
- `title`: Auto-generated or "New Conversation"
- `messages`: Array of user and assistant messages

Assistant messages contain:
- `role`: "assistant"
- `stage1`: Array of individual model responses
- `stage2`: Array of peer rankings
- `stage3`: Final synthesized response

Note: Metadata (label_to_model mapping, aggregate rankings) is not persisted to storage—it's only available in API responses.

## Error Handling

The system is designed for graceful degradation:
- If some models fail in Stage 1, the process continues with successful responses
- If a model fails in Stage 2, other rankings are still collected
- If the Chairman fails, an error message is returned
- Errors are logged but don't expose internal details to users

## Development Notes

### Running Backend
Always run the backend from the project root:
```bash
uv run python -m backend.main
```

Not from the backend directory, as this ensures proper module resolution.

### CORS
CORS is enabled for `http://localhost:5173` and `http://localhost:3000`. Update `backend/main.py` if you need different origins.

### Markdown Rendering
All markdown content must be wrapped in `<div className="markdown-content">` for proper styling. This class is defined globally in `frontend/src/index.css`.

## License

This project is provided as-is without any warranty. Feel free to use, modify, and distribute as you see fit.

## Acknowledgments

Inspired by the idea of [reading books together with LLMs](https://x.com/karpathy/status/1990577951671509438) and the desire to evaluate multiple LLMs side-by-side in a collaborative setting.
