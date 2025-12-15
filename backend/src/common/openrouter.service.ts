/**
 * OpenRouter API client for making LLM requests.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface QueryResponse {
  content: string;
  reasoning_details?: any;
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);

  /**
   * Query a single model via OpenRouter API.
   *
   * @param {string} model - OpenRouter model identifier (e.g., "openai/gpt-4o")
   * @param {Array<{role: string, content: string}>} messages - List of message objects
   * @param {number} timeout - Request timeout in milliseconds (default: 120000ms)
   * @param {string|null} apiKey - Optional API key (falls back to env var if not provided)
   * @returns {Promise<QueryResponse|null>} Response object or null if failed
   */
  async queryModel(
    model: string,
    messages: Array<{ role: string; content: string }>,
    timeout: number = 120000,
    apiKey: string | null = null,
  ): Promise<QueryResponse | null> {
    if (!apiKey) {
      this.logger.error('No API key provided');
      throw new Error(
        'OpenRouter API key is required. Provide it in the request or set OPENROUTER_API_KEY environment variable.',
      );
    }

    if (!apiKey.trim()) {
      this.logger.error('API key is empty');
      throw new Error('OpenRouter API key cannot be empty.');
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const payload = {
      model,
      messages,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      this.logger.log(`Querying model: ${model}`);
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `HTTP error for ${model}: ${response.status} - ${errorText}`,
        );
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`,
        );
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        this.logger.error(
          `Invalid response format for ${model}:`,
          JSON.stringify(data).substring(0, 500),
        );
        throw new Error('Invalid response format from OpenRouter');
      }

      const message = data.choices[0].message;
      this.logger.log(`Successfully received response from ${model}`);

      return {
        content: message.content,
        reasoning_details: message.reasoning_details,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.error(
          `Timeout querying model ${model} after ${timeout}ms`,
        );
      } else {
        this.logger.error(
          `Error querying model ${model}:`,
          error.message,
        );
        if (error.stack) {
          this.logger.error(`Stack trace:`, error.stack);
        }
      }
      return null;
    }
  }

  /**
   * Query multiple models in parallel.
   *
   * @param {string[]} models - List of OpenRouter model identifiers
   * @param {Array<{role: string, content: string}>} messages - List of message objects to send to each model
   * @param {string|null} apiKey - Optional API key (falls back to env var if not provided)
   * @returns {Promise<Record<string, QueryResponse|null>>} Dict mapping model identifier to response (or null if failed)
   */
  async queryModelsParallel(
    models: string[],
    messages: Array<{ role: string; content: string }>,
    apiKey: string | null = null,
  ): Promise<Record<string, QueryResponse | null>> {
    this.logger.log(`Querying ${models.length} models in parallel`);

    // Create promises for all models
    const promises = models.map((model) =>
      this.queryModel(model, messages, 120000, apiKey),
    );

    // Wait for all to complete
    const responses = await Promise.all(promises);

    // Map models to their responses
    const result: Record<string, QueryResponse | null> = {};
    let successCount = 0;
    for (let i = 0; i < models.length; i++) {
      result[models[i]] = responses[i];
      if (responses[i] !== null) {
        successCount++;
      }
    }

    this.logger.log(
      `Completed parallel queries: ${successCount}/${models.length} successful`,
    );

    if (successCount === 0) {
      this.logger.error('All model queries failed!');
    }

    return result;
  }
}

