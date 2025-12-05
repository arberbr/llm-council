# LLM Council

A local web application that creates an "LLM Council" by querying multiple large language models simultaneously, having them evaluate each other's responses, and synthesizing a final answer through a designated Chairman model. Instead of relying on a single AI provider, you can consult multiple models as a council and receive their collective wisdom.

## How It Works

The application uses a 3-stage deliberation process:

### Stage 1: First Opinions
The user's query is sent to all council members in parallel. Each LLM provides its individual response, displayed in a tabbed interface so you can inspect each model's answer side-by-side.

### Stage 2: Peer Review
Each council member receives the responses from all other members, but with **anonymized identities** (labeled as "Response A", "Response B", etc.) to prevent bias. Each model evaluates and ranks the responses based on accuracy and insight. The system calculates aggregate rankings ("Street Cred") across all peer evaluations.

### Stage 3: Final Synthesis
The designated Chairman model receives all individual responses and peer rankings, then synthesizes them into a single comprehensive final answer that represents the council's collective wisdom.

## Features

- **Multi-LLM Consultation**: Query multiple models simultaneously via OpenRouter API
- **Configurable via UI**: Select council models, chairman, and enter your API key directly in the settings sidebar
- **Anonymized Peer Review**: Models evaluate each other without knowing identities to prevent bias
- **Real-time Streaming**: Watch the 3-stage process unfold in real-time with Server-Sent Events (SSE)
- **Conversation Management**: Create, view, and delete conversations with auto-generated titles
- **Client-Side Storage**: All conversations stored in browser localStorage (no server-side database)
- **Transparent Process**: Inspect raw model outputs, rankings, and parsed results at each stage
- **Markdown Support**: Full markdown rendering for all responses
- **Dark/Light Theme**: Toggle between themes for comfortable viewing
- **Aggregate Rankings**: See combined "Street Cred" scores showing which models performed best

## Available Models

The following models are available for selection (via OpenRouter):

| Provider | Models |
|----------|--------|
| Anthropic | Claude Haiku 4.5, Claude Sonnet 4.5, Claude Opus 4.5 |
| OpenAI | GPT-5.1 |
| Google | Gemini 3 Pro |
| xAI | Grok 4 |
| DeepSeek | DeepSeek V3.2 |
| Qwen | Qwen3 Coder Plus |
| Mistral | Mistral Medium 3.1 |

## Prerequisites

- Python 3.10 or higher
- Node.js 18+ and npm
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

### 2. Run the Application

Start both servers in separate terminals:

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

### Ports
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8001

### 3. Configure Settings

Open the application and click the ⚙ (settings) button in the top-right corner to configure:

1. **OpenRouter API Key**: Enter your API key from [openrouter.ai](https://openrouter.ai/)
2. **Chairman Model**: Select which model synthesizes the final answer
3. **Council Models**: Check at least 2 models to participate in deliberation

All settings are stored in your browser's localStorage.

> **Note:** You can also set `OPENROUTER_API_KEY` in a `.env` file as a fallback, but the UI-based configuration is preferred.

## Project Structure

```
llm-council/
├── backend/
│   ├── __init__.py
│   ├── config.py          # Configuration and defaults
│   ├── council.py         # 3-stage orchestration logic
│   ├── main.py            # FastAPI server and endpoints
│   └── openrouter.py      # OpenRouter API client
├── frontend/
│   ├── src/
│   │   ├── api.js         # API client (localStorage + backend)
│   │   ├── storage.js     # LocalStorage conversation management
│   │   ├── App.jsx        # Main application component
│   │   ├── context/
│   │   │   └── ThemeContext.jsx
│   │   └── components/
│   │       ├── ChatInterface.jsx
│   │       ├── LeftSidebar.jsx    # Conversation list
│   │       ├── RightSidebar.jsx   # Settings panel
│   │       ├── Stage1.jsx         # Individual responses view
│   │       ├── Stage2.jsx         # Peer rankings view
│   │       └── Stage3.jsx         # Final synthesis view
│   ├── package.json
│   └── vite.config.js
├── pyproject.toml
└── README.md
```

## Tech Stack

### Backend
- **FastAPI** - Python web framework with async support
- **httpx** - Async HTTP client for API requests
- **uvicorn** - ASGI server
- **python-dotenv** - Environment variable management
- **pydantic** - Data validation and settings

### Frontend
- **React 19** - UI framework
- **Vite 7** - Build tool and dev server
- **react-markdown** - Markdown rendering
- **react-router-dom** - Client-side routing

### Storage
- **Browser localStorage** - All conversations and settings stored client-side

### Package Management
- **uv** - Python dependency management
- **npm** - JavaScript dependency management

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
    ↓
Save to localStorage
```

The entire flow uses async/parallel operations where possible to minimize latency.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/council/process` | Process message through 3-stage council (SSE stream) |
| POST | `/api/council/generate-title` | Generate conversation title |

## Error Handling

The system is designed for graceful degradation:
- If some models fail in Stage 1, the process continues with successful responses
- If a model fails in Stage 2, other rankings are still collected
- If the Chairman fails, an error message is returned
- Frontend validates settings before sending (API key, minimum 2 council models, chairman selected)
- Errors are logged but don't expose internal details to users

## Development Notes

### Running Backend
Always run the backend from the project root:
```bash
uv run python -m backend.main
```
Not from the backend directory, as this ensures proper module resolution.

### CORS
CORS is enabled for all origins in development. Update `backend/main.py` if you need more restrictive origins in production.

### Markdown Rendering
All markdown content must be wrapped in `<div className="markdown-content">` for proper styling. This class is defined globally in `frontend/src/index.css`.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Fallback API key (UI setting preferred) | None |
| `VITE_REACT_BACKEND_API` | Backend URL for frontend | `http://localhost:8001` |

## License

This project is provided as-is under the MIT License. Feel free to use, modify, and distribute as you see fit.
