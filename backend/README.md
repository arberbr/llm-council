# LLM Council Backend

NestJS backend for the LLM Council application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run start:dev
```

The backend will be available at `http://localhost:3001`

## API Endpoints

### POST /api/council/process

Start a council processing request.

**Request Body:**
```json
{
  "content": "Your question here",
  "api_key": "sk-or-v1-...",
  "council_models": ["openai/gpt-5.1", "google/gemini-3-pro-preview"],
  "chairman_model": "google/gemini-3-pro-preview",
  "generate_title": true
}
```

**Response:**
```json
{
  "traceId": "uuid-here",
  "stage": "stream_start",
  "message": "Stream initialized",
  "timestamp": "2024-12-15T..."
}
```

### GET /api/council/process/:traceId/status

Get the current status of a council processing request.

**Response:**
```json
{
  "stage": "stage1_complete",
  "data": {...},
  "message": "Stage 1 complete",
  "timestamp": "2024-12-15T..."
}
```

## Development

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run lint` - Run ESLint

