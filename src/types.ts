export interface Stage1Response {
  model: string;
  response: string;
}

export interface Stage2Ranking {
  model: string;
  ranking: string;
  parsed_ranking?: string[];
}

export interface AggregateRanking {
  model: string;
  average_rank: number;
  rankings_count: number;
}

export interface Stage3Final {
  model: string;
  response: string;
}

export interface AssistantMessage {
  role: 'assistant';
  stage1: Stage1Response[] | null;
  stage2: Stage2Ranking[] | null;
  stage3: Stage3Final | null;
  metadata?: {
    label_to_model?: Record<string, string>;
    aggregate_rankings?: AggregateRanking[];
  } | null;
  loading?: {
    stage1?: boolean;
    stage2?: boolean;
    stage3?: boolean;
  } | null;
}

export interface UserMessage {
  role: 'user';
  content: string;
}

export type Message = UserMessage | AssistantMessage;

export interface Conversation {
  id: string;
  created_at: string;
  title?: string;
  messages: Message[];
}

export interface ConversationSummary {
  id: string;
  created_at: string;
  title?: string;
  message_count: number;
}


