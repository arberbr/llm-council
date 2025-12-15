/**
 * Configuration for the LLM Council.
 */

// Default council members - list of OpenRouter model identifiers
export const COUNCIL_MODELS = [
  'openai/gpt-5.2',
  'google/gemini-3-pro-preview',
  'anthropic/claude-sonnet-4.5',
];

// Chairman model - synthesizes final response
export const CHAIRMAN_MODEL = 'openai/gpt-5.2';