import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface RunSummary {
  startTime: string;
  endTime: string;
  durationMs: number;
  profile: string;
  region?: string;
  outputFile: string;
  creditsUsed?: number;
  success: boolean;
  error?: string;
}

export interface CodebuffEvent {
  timestamp: string;
  type: string;
  data: unknown;
}

export class Logger {
  private events: CodebuffEvent[] = [];
  private logsDir: string;
  private runId: string;

  constructor(logsDir: string = './logs') {
    this.logsDir = logsDir;
    this.runId = this.generateRunId();
    this.ensureLogsDir();
  }

  private generateRunId(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private ensureLogsDir(): void {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Log a Codebuff event for tracing
   */
  logEvent(type: string, data: unknown): void {
    const event: CodebuffEvent = {
      timestamp: new Date().toISOString(),
      type,
      data,
    };
    this.events.push(event);
  }

  /**
   * Handle Codebuff SDK events
   */
  handleEvent = (event: unknown): void => {
    this.logEvent('codebuff_event', event);
  };

  /**
   * Save all events to a trace file
   */
  saveTrace(): string {
    const filename = `codebuff-trace-${this.runId}.json`;
    const filepath = join(this.logsDir, filename);
    writeFileSync(filepath, JSON.stringify(this.events, null, 2));
    return filepath;
  }

  /**
   * Save run summary
   */
  saveSummary(summary: RunSummary): string {
    const filename = `run-summary-${this.runId}.json`;
    const filepath = join(this.logsDir, filename);
    writeFileSync(filepath, JSON.stringify(summary, null, 2));
    return filepath;
  }

  /**
   * Get the run ID for this logger instance
   */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Get all logged events
   */
  getEvents(): CodebuffEvent[] {
    return [...this.events];
  }
}
