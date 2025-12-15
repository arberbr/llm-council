import { Injectable } from '@nestjs/common';
import { CouncilStatus } from './interfaces/council.interface';

@Injectable()
export class CouncilStatusService {
  private statuses: Map<string, CouncilStatus> = new Map();

  /**
   * Set status for a trace ID
   */
  setStatus(traceId: string, status: CouncilStatus): void {
    this.statuses.set(traceId, status);
  }

  /**
   * Get status for a trace ID
   */
  getStatus(traceId: string): CouncilStatus | null {
    return this.statuses.get(traceId) || null;
  }

  /**
   * Check if a trace ID exists
   */
  hasStatus(traceId: string): boolean {
    return this.statuses.has(traceId);
  }

  /**
   * Delete status for a trace ID (cleanup)
   */
  deleteStatus(traceId: string): void {
    this.statuses.delete(traceId);
  }
}

