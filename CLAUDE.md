# CLAUDE.md - Technical Notes for LLM Council

This file contains technical details, architectural decisions, and important implementation notes for future development sessions.

## Project Overview

LLM Council is a 3-stage deliberation system where multiple LLMs collaboratively answer user questions. The key innovation is anonymized peer review in Stage 2, preventing models from playing favorites. The entire system uses client-side storage (localStorage) while the backend handles only LLM API calls.

## Architecture

### Backend Structure (`backend/`)

**`config.py`**
- Contains default `COUNCIL_MODELS` (list of OpenRouter model identifiers)
- Contains default `CHAIRMAN_MODEL` (model that synthesizes final answer)
- Environment variable `OPENROUTER_API_KEY` from `.env` as optional fallback
- Backend runs on **port 8001**

**`openrouter.py`**
- `query_model()`: Single async model query with 120s default timeout
- `query_models_parallel()`: Parallel queries using `asyncio.gather()`
- Returns dict with 'content' and optional 'reasoning_details'
- Graceful degradation: returns None on failure, continues with successful responses

**`council.py`** - The Core Logic
- `stage1_collect_responses()`: Parallel queries to all council models
- `stage2_collect_rankings()`:
  - Anonymizes responses as "Response A, B, C, etc."
  - Creates `label_to_model` mapping for de-anonymization
  - Prompts models to evaluate and rank (with strict format requirements)
  - Returns tuple: (rankings_list, label_to_model_dict)
  - Each ranking includes both raw text and `parsed_ranking` list
- `stage3_synthesize_final()`: Chairman synthesizes from all responses + rankings
- `parse_ranking_from_text()`: Extracts "FINAL RANKING:" section, handles both numbered lists and plain format
- `calculate_aggregate_rankings()`: Computes average rank position across all peer evaluations
- `generate_conversation_title()`: Uses `google/gemini-2.5-flash` for fast title generation

**`main.py`**
- FastAPI app with CORS enabled for all origins (`allow_origins=["*"]`)
- **Stateless** - backend does NOT store any conversations
- POST `/api/council/process`: SSE streaming endpoint for 3-stage processing
- POST `/api/council/generate-title`: Utility endpoint for title generation
- Validates settings (API key, chairman, min 2 council models) before processing

### Frontend Structure (`frontend/src/`)

**`App.jsx`**
- Main orchestration: manages conversations list and current conversation
- Handles SSE streaming events and updates UI progressively
- Validates settings before sending (API key, chairman, 2+ council models)
- Uses `react-router-dom` for URL-based conversation navigation

**`api.js`**
- `sendMessageStream()`: Handles SSE streaming from backend
- All storage operations delegate to `storage.js` (localStorage)
- Reads settings from localStorage: `openRouterApiKey`, `councilModels`, `chairmanModel`
- Uses `VITE_REACT_BACKEND_API` env var or defaults to `http://localhost:8001`

**`storage.js`**
- Pure localStorage-based conversation storage
- Storage key: `llm-council-conversations`
- Generates UUIDs for conversation IDs
- Exports: `listConversations`, `createConversation`, `getConversation`, `deleteConversation`, `addUserMessage`, `addAssistantMessage`, `updateConversationTitle`

**`components/ChatInterface.jsx`**
- Multiline textarea (3 rows, resizable)
- Enter to send, Shift+Enter for new line
- User messages wrapped in markdown-content class for padding

**`components/Stage1.jsx`**
- Tab view of individual model responses
- ReactMarkdown rendering with markdown-content wrapper
- Shows model short name (after `/`) in tabs

**`components/Stage2.jsx`**
- **Critical Feature**: Tab view showing RAW evaluation text from each model
- De-anonymization happens CLIENT-SIDE for display (models receive anonymous labels)
- Shows "Extracted Ranking" below each evaluation so users can validate parsing
- Aggregate rankings ("Street Cred") shown with average position and vote count
- Explanatory text clarifies that boldface model names are for readability only

**`components/Stage3.jsx`**
- Final synthesized answer from chairman
- Shows chairman model name prominently

**`components/LeftSidebar.jsx`**
- Conversation list with titles and message counts
- New conversation button
- Delete conversation with confirmation
- Home navigation

**`components/RightSidebar.jsx`**
- **Settings UI** for all configuration:
  - OpenRouter API key input (password field)
  - Chairman model dropdown
  - Council models multi-select checkboxes
  - Minimum 2 council models enforced
- Theme toggle (dark/light mode)
- Real-time validation errors displayed

**`context/ThemeContext.jsx`**
- Theme state management via React Context
- Persists to localStorage key: `theme`
- Default theme: `dark`
- Sets `data-theme` attribute on document root

## Available Models

Configured in `RightSidebar.jsx` - all via OpenRouter:

| Provider | Model ID | Display Name |
|----------|----------|--------------|
| Anthropic | anthropic/claude-haiku-4.5 | Claude Haiku 4.5 |
| Anthropic | anthropic/claude-sonnet-4.5 | Claude Sonnet 4.5 |
| Anthropic | anthropic/claude-opus-4.5 | Claude Opus 4.5 |
| DeepSeek | deepseek/deepseek-v3.2 | DeepSeek V3.2 |
| Google | google/gemini-3-pro-preview | Gemini 3 Pro |
| OpenAI | openai/gpt-5.1 | GPT-5.1 |
| xAI | x-ai/grok-4 | Grok 4 |
| Qwen | qwen/qwen3-coder-plus | Qwen3 Coder Plus |
| Mistral | mistralai/mistral-medium-3.1 | Mistral Medium 3.1 |

**Default Configuration:**
- Council: GPT-5.1, Gemini 3 Pro, Claude Sonnet 4.5, Grok 4
- Chairman: Gemini 3 Pro

## Key Design Decisions

### Client-Side Storage
All conversations are stored in browser localStorage (`llm-council-conversations`). The backend is completely stateless and only handles LLM API calls. This simplifies deployment and keeps user data private.

### Server-Sent Events (SSE) for Streaming
The `/api/council/process` endpoint returns SSE events as each stage completes:
- `stage1_start` / `stage1_complete`
- `stage2_start` / `stage2_complete` (includes metadata)
- `stage3_start` / `stage3_complete`
- `title_complete` (if first message)
- `complete` / `error`

This provides real-time UI updates without waiting for all stages.

### Stage 2 Prompt Format
The Stage 2 prompt is very specific to ensure parseable output:
```
1. Evaluate each response individually first
2. Provide "FINAL RANKING:" header
3. Numbered list format: "1. Response C", "2. Response A", etc.
4. No additional text after ranking section
```

### De-anonymization Strategy
- Models receive: "Response A", "Response B", etc.
- Backend creates mapping: `{"Response A": "openai/gpt-5.1", ...}`
- Frontend displays model names in **bold** for readability
- Users see explanation that original evaluation used anonymous labels

### Error Handling Philosophy
- Continue with successful responses if some models fail (graceful degradation)
- Never fail the entire request due to single model failure
- Validate settings on both client and server before processing
- Log errors but don't expose internal details to users

## Important Implementation Details

### Relative Imports
All backend modules use relative imports (e.g., `from .config import ...`). This is critical for Python's module system to work correctly when running as `python -m backend.main`.

### Port Configuration
- Backend: 8001
- Frontend: 5173 (Vite default)
- Update both `backend/main.py` and `frontend/src/api.js` if changing

### Markdown Rendering
All ReactMarkdown components must be wrapped in `<div className="markdown-content">` for proper spacing. This class is defined globally in `index.css`.

### localStorage Keys
| Key | Purpose |
|-----|---------|
| `llm-council-conversations` | All conversation data |
| `openRouterApiKey` | OpenRouter API key |
| `councilModels` | JSON array of selected council model IDs |
| `chairmanModel` | Selected chairman model ID |
| `theme` | Theme preference (`light` or `dark`) |

### Title Generation
Auto-generated titles use `google/gemini-2.5-flash` for speed/cost. Title is generated in parallel with Stage 1 for first message only.

## Common Gotchas

1. **Module Import Errors**: Always run backend as `uv run python -m backend.main` from project root, not from backend directory
2. **CORS Issues**: Currently wide-open (`*`) for development; restrict in production
3. **Ranking Parse Failures**: If models don't follow format, fallback regex extracts any "Response X" patterns in order
4. **Settings Validation**: Both frontend (`App.jsx`) and backend (`main.py`) validate settings - keep in sync
5. **Conversation Not Loading**: Check that `conversationId` exists in localStorage

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/council/process` | Process message through 3-stage council (SSE stream) |
| POST | `/api/council/generate-title` | Generate conversation title |

### Request Body for `/api/council/process`
```json
{
  "content": "User's question",
  "api_key": "sk-or-v1-...",
  "council_models": ["openai/gpt-5.1", "google/gemini-3-pro-preview", ...],
  "chairman_model": "google/gemini-3-pro-preview",
  "generate_title": true
}
```

## Tech Stack

### Backend
- **FastAPI** - Python web framework with async support
- **httpx** - Async HTTP client for API requests
- **uvicorn** - ASGI server
- **python-dotenv** - Environment variable management (optional fallback)
- **pydantic** - Data validation and settings

### Frontend
- **React 19** - UI framework
- **Vite 7** - Build tool and dev server
- **react-markdown** - Markdown rendering
- **react-router-dom** - Client-side routing

### Package Management
- **uv** - Python dependency management
- **npm** - JavaScript dependency management

## Data Flow Summary

```
User Query (from ChatInterface)
    ↓
Frontend validates settings (App.jsx)
    ↓
POST /api/council/process with SSE streaming
    ↓
Backend validates settings
    ↓
Stage 1: Parallel queries → [individual responses] → SSE event
    ↓
Stage 2: Anonymize → Parallel ranking queries → [evaluations + parsed rankings] → SSE event
    ↓
Aggregate Rankings Calculation → included in Stage 2 metadata
    ↓
Stage 3: Chairman synthesis with full context → SSE event
    ↓
Title Generation (parallel, first message only) → SSE event
    ↓
Frontend: Progressive UI updates via SSE callbacks
    ↓
Save complete message to localStorage
```

The entire flow is async/parallel where possible to minimize latency.

## Future Enhancement Ideas

- Streaming individual model responses (token-by-token)
- Export conversations to markdown/PDF
- Model performance analytics over time
- Custom ranking criteria (not just accuracy/insight)
- Support for reasoning models (o1, etc.) with special handling
- Conversation search/filtering
- Import/export conversations (JSON backup)
