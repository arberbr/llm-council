"""FastAPI backend for LLM Council."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
import json
import asyncio
import logging

from .council import generate_conversation_title, stage1_collect_responses, stage2_collect_rankings, stage3_synthesize_final, calculate_aggregate_rankings

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LLM Council API")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessMessageRequest(BaseModel):
    """Request to process a message through the council."""
    content: str
    api_key: str | None = None
    council_models: List[str] | None = None
    chairman_model: str | None = None
    generate_title: bool = False  # Whether to generate a title for this message


def validate_settings(request: ProcessMessageRequest):
    """Validate that required settings are provided."""
    errors = []
    
    if not request.api_key or not request.api_key.strip():
        errors.append("OpenRouter API key is required")
    
    if not request.chairman_model or not request.chairman_model.strip():
        errors.append("Chairman model must be selected")
    
    if not request.council_models or not isinstance(request.council_models, list):
        errors.append("At least 2 council models must be selected")
    elif len(request.council_models) < 2:
        errors.append("At least 2 council models must be selected")
    
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    
    return True


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "LLM Council API"}


@app.post("/api/council/process")
async def process_message_stream(request: ProcessMessageRequest):
    """
    Process a message through the 3-stage council process.
    Returns Server-Sent Events as each stage completes.
    
    This is a stateless endpoint - it does not store anything.
    The client is responsible for storing conversations.
    """
    # Validate settings first (before creating the generator)
    validate_settings(request)
    
    # Debug: Log the request immediately when received
    logger.info("=" * 50)
    logger.info("COUNCIL PROCESS REQUEST RECEIVED")
    logger.info(f"api_key present: {request.api_key is not None}")
    logger.info(f"council_models: {request.council_models}")
    logger.info(f"chairman_model: {request.chairman_model}")
    logger.info(f"generate_title: {request.generate_title}")
    logger.info("=" * 50)

    async def event_generator():
        try:
            # Extract settings from request
            api_key = request.api_key
            council_models = request.council_models
            chairman_model = request.chairman_model

            # Start title generation in parallel if requested
            title_task = None
            if request.generate_title:
                title_task = asyncio.create_task(generate_conversation_title(request.content, api_key=api_key))

            # Stage 1: Collect responses
            yield f"data: {json.dumps({'type': 'stage1_start'})}\n\n"
            stage1_results = await stage1_collect_responses(request.content, council_models=council_models, api_key=api_key)
            yield f"data: {json.dumps({'type': 'stage1_complete', 'data': stage1_results})}\n\n"

            # Stage 2: Collect rankings
            yield f"data: {json.dumps({'type': 'stage2_start'})}\n\n"
            stage2_results, label_to_model = await stage2_collect_rankings(request.content, stage1_results, council_models=council_models, api_key=api_key)
            aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)
            yield f"data: {json.dumps({'type': 'stage2_complete', 'data': stage2_results, 'metadata': {'label_to_model': label_to_model, 'aggregate_rankings': aggregate_rankings}})}\n\n"

            # Stage 3: Synthesize final answer
            yield f"data: {json.dumps({'type': 'stage3_start'})}\n\n"
            stage3_result = await stage3_synthesize_final(request.content, stage1_results, stage2_results, chairman_model=chairman_model, api_key=api_key)
            yield f"data: {json.dumps({'type': 'stage3_complete', 'data': stage3_result})}\n\n"

            # Wait for title generation if it was started
            if title_task:
                title = await title_task
                yield f"data: {json.dumps({'type': 'title_complete', 'data': {'title': title}})}\n\n"

            # Send completion event
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            logger.error(f"Error in council process: {e}")
            # Send error event
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/api/council/generate-title")
async def generate_title(request: ProcessMessageRequest):
    """
    Generate a title for a conversation based on the first message.
    This is a utility endpoint for title generation.
    """
    if not request.api_key or not request.api_key.strip():
        raise HTTPException(status_code=400, detail="OpenRouter API key is required")
    
    title = await generate_conversation_title(request.content, api_key=request.api_key)
    return {"title": title}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
