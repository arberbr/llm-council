import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CouncilService } from './council.service';
import { CouncilStatusService } from './council-status.service';
import { ProcessCouncilDto } from './dto/process-council.dto';

@Controller('api/council')
export class CouncilController {
  constructor(
    private readonly councilService: CouncilService,
    private readonly statusService: CouncilStatusService,
  ) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  async processCouncil(@Body() dto: ProcessCouncilDto, @Res() res: Response) {
    // Debug: Log received data (without exposing full API key)
    console.log('[CouncilController] Received request:', {
      content: dto.content?.substring(0, 50) + '...',
      hasApiKey: !!dto.api_key,
      apiKeyLength: dto.api_key?.length || 0,
      council_models: dto.council_models,
      chairman_model: dto.chairman_model,
    });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial stream start event
    this.sendSSEEvent(res, {
      type: 'stream_start',
      stage: 'stream_start',
      message: 'Stream initialized',
      timestamp: new Date().toISOString(),
    });

    // Process and stream events
    try {
      await this.processCouncilWithStreaming(dto, res);
    } catch (error: any) {
      this.sendSSEEvent(res, {
        type: 'error',
        stage: 'error',
        message: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      });
    } finally {
      res.end();
    }
  }

  @Get('process/:traceId/status')
  async getStatus(@Param('traceId') traceId: string) {
    const status = this.statusService.getStatus(traceId);
    if (!status) {
      throw new NotFoundException(`Status not found for traceId: ${traceId}`);
    }
    return status;
  }

  /**
   * Send an SSE event to the client
   */
  private sendSSEEvent(res: Response, event: any): void {
    const data = JSON.stringify(event);
    res.write(`data: ${data}\n\n`);
  }

  /**
   * Process council with SSE streaming
   */
  private async processCouncilWithStreaming(
    dto: ProcessCouncilDto,
    res: Response,
  ): Promise<void> {
    const { content, api_key, council_models, chairman_model, generate_title } =
      dto;

    // Normalize api_key: use provided value, or null if empty/undefined
    const normalizedApiKey = api_key && api_key.trim() ? api_key.trim() : null;
    
    if (!normalizedApiKey) {
      console.warn('[CouncilController] No API key provided in request');
    }

    try {
      // Stage 1: Collect responses
      this.sendSSEEvent(res, {
        type: 'stage1_start',
        stage: 'stage1_start',
        message: 'Collecting individual responses...',
        timestamp: new Date().toISOString(),
      });

      const stage1Results = await this.councilService.stage1CollectResponses(
        content,
        council_models,
        normalizedApiKey,
      );

      if (!stage1Results || stage1Results.length === 0) {
        throw new Error(
          'Stage 1 failed: No responses received from any model. Check API key and model availability.',
        );
      }

      this.sendSSEEvent(res, {
        type: 'stage1_complete',
        stage: 'stage1_complete',
        data: stage1Results,
        message: 'Stage 1 complete',
        timestamp: new Date().toISOString(),
      });

      // Stage 2: Collect rankings
      this.sendSSEEvent(res, {
        type: 'stage2_start',
        stage: 'stage2_start',
        message: 'Collecting peer rankings...',
        timestamp: new Date().toISOString(),
      });

      const [stage2Results, labelToModel] =
        await this.councilService.stage2CollectRankings(
          content,
          stage1Results,
          council_models,
          normalizedApiKey,
        );
      const aggregateRankings =
        this.councilService.calculateAggregateRankings(
          stage2Results,
          labelToModel,
        );

      this.sendSSEEvent(res, {
        type: 'stage2_complete',
        stage: 'stage2_complete',
        data: stage2Results,
        metadata: {
          label_to_model: labelToModel,
          aggregate_rankings: aggregateRankings,
        },
        message: 'Stage 2 complete',
        timestamp: new Date().toISOString(),
      });

      // Stage 3: Synthesize final answer
      this.sendSSEEvent(res, {
        type: 'stage3_start',
        stage: 'stage3_start',
        message: 'Synthesizing final answer...',
        timestamp: new Date().toISOString(),
      });

      const stage3Result = await this.councilService.stage3SynthesizeFinal(
        content,
        stage1Results,
        stage2Results,
        chairman_model,
        normalizedApiKey,
      );

      this.sendSSEEvent(res, {
        type: 'stage3_complete',
        stage: 'stage3_complete',
        data: stage3Result,
        message: 'Stage 3 complete',
        timestamp: new Date().toISOString(),
      });

      // Title generation (if requested)
      if (generate_title) {
        try {
          const title = await this.councilService.generateConversationTitle(
            content,
            normalizedApiKey,
          );
          this.sendSSEEvent(res, {
            type: 'title_complete',
            stage: 'title_complete',
            data: { title },
            timestamp: new Date().toISOString(),
          });
        } catch (titleError: any) {
          // Don't fail the whole request if title generation fails
          console.error('Title generation error:', titleError.message);
        }
      }

      // Complete
      this.sendSSEEvent(res, {
        type: 'complete',
        stage: 'complete',
        message: 'Council process complete',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.sendSSEEvent(res, {
        type: 'error',
        stage: 'error',
        message: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}

