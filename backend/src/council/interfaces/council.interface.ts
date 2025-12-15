export interface Stage1Result {
  model: string;
  response: string;
}

export interface Stage2Result {
  model: string;
  ranking: string;
  parsed_ranking: string[];
}

export interface Stage3Result {
  model: string;
  response: string;
}

export interface AggregateRanking {
  model: string;
  average_rank: number;
  rankings_count: number;
}

export type CouncilStage =
  | 'stream_start'
  | 'stage1_start'
  | 'stage1_complete'
  | 'stage2_start'
  | 'stage2_complete'
  | 'stage3_start'
  | 'stage3_complete'
  | 'title_complete'
  | 'complete'
  | 'error';

export interface CouncilStatus {
  stage: CouncilStage;
  data?: any;
  metadata?: any;
  message?: string;
  timestamp: string;
}

