/**
 * 3-stage LLM Council orchestration.
 */

import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../common/openrouter.service';
import { COUNCIL_MODELS, CHAIRMAN_MODEL } from '../common/config';
import {
  Stage1Result,
  Stage2Result,
  Stage3Result,
  AggregateRanking,
} from './interfaces/council.interface';

@Injectable()
export class CouncilService {
  private readonly logger = new Logger(CouncilService.name);

  constructor(private readonly openRouterService: OpenRouterService) {}

  /**
   * Stage 1: Collect individual responses from all council models.
   *
   * @param {string} userQuery - The user's question
   * @param {string[]|null} councilModels - Optional list of council models (falls back to config if not provided)
   * @param {string|null} apiKey - Optional API key (falls back to config if not provided)
   * @returns {Promise<Stage1Result[]>} List of response objects
   */
  async stage1CollectResponses(
    userQuery: string,
    councilModels: string[] | null = null,
    apiKey: string | null = null,
  ): Promise<Stage1Result[]> {
    const models = councilModels || COUNCIL_MODELS;
    const messages = [{ role: 'user', content: userQuery }];

    // Query all models in parallel
    const responses = await this.openRouterService.queryModelsParallel(
      models,
      messages,
      apiKey,
    );

    // Format results
    const stage1Results: Stage1Result[] = [];
    for (const [model, response] of Object.entries(responses)) {
      if (response !== null) {
        // Only include successful responses
        stage1Results.push({
          model,
          response: response.content || '',
        });
      }
    }

    return stage1Results;
  }

  /**
   * Parse the FINAL RANKING section from the model's response.
   *
   * @param {string} rankingText - The full text response from the model
   * @returns {string[]} List of response labels in ranked order
   */
  parseRankingFromText(rankingText: string): string[] {
    // Look for "FINAL RANKING:" section
    if (rankingText.includes('FINAL RANKING:')) {
      // Extract everything after "FINAL RANKING:"
      const parts = rankingText.split('FINAL RANKING:');
      if (parts.length >= 2) {
        const rankingSection = parts[1];
        // Try to extract numbered list format (e.g., "1. Response A")
        // This pattern looks for: number, period, optional space, "Response X"
        const numberedMatches = rankingSection.match(/\d+\.\s*Response [A-Z]/g);
        if (numberedMatches) {
          // Extract just the "Response X" part
          return numberedMatches
            .map((m) => {
              const match = m.match(/Response [A-Z]/);
              return match ? match[0] : '';
            })
            .filter(Boolean);
        }

        // Fallback: Extract all "Response X" patterns in order
        const matches = rankingSection.match(/Response [A-Z]/g);
        if (matches) {
          return matches;
        }
      }
    }

    // Fallback: try to find any "Response X" patterns in order
    const matches = rankingText.match(/Response [A-Z]/g);
    return matches || [];
  }

  /**
   * Stage 2: Each model ranks the anonymized responses.
   *
   * @param {string} userQuery - The original user query
   * @param {Stage1Result[]} stage1Results - Results from Stage 1
   * @param {string[]|null} councilModels - Optional list of council models (falls back to config if not provided)
   * @param {string|null} apiKey - Optional API key (falls back to config if not provided)
   * @returns {Promise<[Stage2Result[], Record<string, string>]>} Tuple of rankings list and label_to_model mapping
   */
  async stage2CollectRankings(
    userQuery: string,
    stage1Results: Stage1Result[],
    councilModels: string[] | null = null,
    apiKey: string | null = null,
  ): Promise<[Stage2Result[], Record<string, string>]> {
    const models = councilModels || COUNCIL_MODELS;

    // Create anonymized labels for responses (Response A, Response B, etc.)
    const labels: string[] = [];
    for (let i = 0; i < stage1Results.length; i++) {
      labels.push(String.fromCharCode(65 + i)); // A, B, C, ...
    }

    // Create mapping from label to model name
    const labelToModel: Record<string, string> = {};
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const result = stage1Results[i];
      labelToModel[`Response ${label}`] = result.model;
    }

    // Build the ranking prompt
    const responsesText = stage1Results
      .map((result, i) => `Response ${labels[i]}:\n${result.response}`)
      .join('\n\n');

    const rankingPrompt = `You are evaluating different responses to the following question:

Question: ${userQuery}

Here are the responses from different models (anonymized):

${responsesText}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example of the correct format for your ENTIRE response:

Response A provides good detail on X but misses Y...
Response B is accurate but lacks depth on Z...
Response C offers the most comprehensive answer...

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Now provide your evaluation and ranking:`;

    const messages = [{ role: 'user', content: rankingPrompt }];

    // Get rankings from all council models in parallel
    const responses = await this.openRouterService.queryModelsParallel(
      models,
      messages,
      apiKey,
    );

    // Format results
    const stage2Results: Stage2Result[] = [];
    for (const [model, response] of Object.entries(responses)) {
      if (response !== null) {
        const fullText = response.content || '';
        const parsed = this.parseRankingFromText(fullText);
        stage2Results.push({
          model,
          ranking: fullText,
          parsed_ranking: parsed,
        });
      }
    }

    return [stage2Results, labelToModel];
  }

  /**
   * Calculate aggregate rankings across all models.
   *
   * @param {Stage2Result[]} stage2Results - Rankings from each model
   * @param {Record<string, string>} labelToModel - Mapping from anonymous labels to model names
   * @returns {AggregateRanking[]} List of models with average rank, sorted best to worst
   */
  calculateAggregateRankings(
    stage2Results: Stage2Result[],
    labelToModel: Record<string, string>,
  ): AggregateRanking[] {
    // Track positions for each model
    const modelPositions: Record<string, number[]> = {};

    for (const ranking of stage2Results) {
      const parsedRanking = this.parseRankingFromText(ranking.ranking);

      for (let position = 0; position < parsedRanking.length; position++) {
        const label = parsedRanking[position];
        if (label in labelToModel) {
          const modelName = labelToModel[label];
          if (!modelPositions[modelName]) {
            modelPositions[modelName] = [];
          }
          modelPositions[modelName].push(position + 1); // positions are 1-indexed
        }
      }
    }

    // Calculate average position for each model
    const aggregate: AggregateRanking[] = [];
    for (const [model, positions] of Object.entries(modelPositions)) {
      if (positions.length > 0) {
        const avgRank = positions.reduce((a, b) => a + b, 0) / positions.length;
        aggregate.push({
          model,
          average_rank: Math.round(avgRank * 100) / 100,
          rankings_count: positions.length,
        });
      }
    }

    // Sort by average rank (lower is better)
    aggregate.sort((a, b) => a.average_rank - b.average_rank);

    return aggregate;
  }

  /**
   * Stage 3: Chairman synthesizes final response.
   *
   * @param {string} userQuery - The original user query
   * @param {Stage1Result[]} stage1Results - Individual model responses from Stage 1
   * @param {Stage2Result[]} stage2Results - Rankings from Stage 2
   * @param {string|null} chairmanModel - Optional chairman model (falls back to config if not provided)
   * @param {string|null} apiKey - Optional API key (falls back to config if not provided)
   * @returns {Promise<Stage3Result>} Final synthesis result
   */
  async stage3SynthesizeFinal(
    userQuery: string,
    stage1Results: Stage1Result[],
    stage2Results: Stage2Result[],
    chairmanModel: string | null = null,
    apiKey: string | null = null,
  ): Promise<Stage3Result> {
    const model = chairmanModel || CHAIRMAN_MODEL;
    this.logger.log(
      `Stage 3 - Using chairman model: ${model} (provided: ${chairmanModel}, default: ${CHAIRMAN_MODEL})`,
    );

    // Build comprehensive context for chairman
    const stage1Text = stage1Results
      .map((result) => `Model: ${result.model}\nResponse: ${result.response}`)
      .join('\n\n');

    const stage2Text = stage2Results
      .map((result) => `Model: ${result.model}\nRanking: ${result.ranking}`)
      .join('\n\n');

    const chairmanPrompt = `You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: ${userQuery}

STAGE 1 - Individual Responses:
${stage1Text}

STAGE 2 - Peer Rankings:
${stage2Text}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:`;

    const messages = [{ role: 'user', content: chairmanPrompt }];

    // Query the chairman model
    const response = await this.openRouterService.queryModel(
      model,
      messages,
      120000,
      apiKey,
    );

    if (response === null) {
      // Fallback if chairman fails
      return {
        model,
        response: 'Error: Unable to generate final synthesis.',
      };
    }

    return {
      model,
      response: response.content || '',
    };
  }

  /**
   * Generate a short title for a conversation based on the first user message.
   *
   * @param {string} userQuery - The first user message
   * @param {string|null} apiKey - Optional API key (falls back to config if not provided)
   * @returns {Promise<string>} A short title (3-5 words)
   */
  async generateConversationTitle(
    userQuery: string,
    apiKey: string | null = null,
  ): Promise<string> {
    const titlePrompt = `Generate a very short title (3-5 words maximum) that summarizes the following question.
The title should be concise and descriptive. Do not use quotes or punctuation in the title.

Question: ${userQuery}

Title:`;

    const messages = [{ role: 'user', content: titlePrompt }];

    // Use gemini-2.5-flash for title generation (fast and cheap)
    const response = await this.openRouterService.queryModel(
      'google/gemini-2.5-flash',
      messages,
      30000,
      apiKey,
    );

    if (response === null) {
      // Fallback to a generic title
      return 'New Conversation';
    }

    let title = (response.content || 'New Conversation').trim();

    // Clean up the title - remove quotes, limit length
    title = title.replace(/^["']|["']$/g, '');

    // Truncate if too long
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }

    return title;
  }
}

