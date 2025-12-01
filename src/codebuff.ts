import { CodebuffClient } from '@codebuff/sdk';
import chalk from 'chalk';
import { spawn } from 'bun';
import { Logger, type RunSummary } from './logger.js';

export interface AnalyzerOptions {
  prompt: string;
  profile: string;
  region?: string;
  outputFile: string;
  cwd?: string;
  maxAgentSteps?: number;
}

export interface AnalyzerResult {
  success: boolean;
  creditsUsed?: number;
  error?: string;
  traceFile?: string;
  summaryFile?: string;
}

/**
 * CodebuffAnalyzer - Uses @codebuff/sdk to run AI agent conversations
 */
export class CodebuffAnalyzer {
  private client: CodebuffClient;
  private logger: Logger;

  constructor(apiKey: string, logsDir?: string) {
    this.client = new CodebuffClient({ apiKey });
    this.logger = new Logger(logsDir);
  }

  /**
   * Run analysis using the Codebuff SDK
   */
  async analyze(options: AnalyzerOptions): Promise<AnalyzerResult> {
    const {
      prompt,
      profile,
      region,
      outputFile,
      cwd = process.cwd(),
      maxAgentSteps = 50,
    } = options;

    const startTime = new Date();
    this.logger.logEvent('analysis_start', { profile, region, outputFile, cwd });

    console.log(chalk.blue('\n🤖 Starting Codebuff AI analysis...\n'));
    console.log(chalk.gray('Profile:'), chalk.cyan(profile));
    console.log(chalk.gray('Region:'), chalk.cyan(region || 'auto-detect'));
    console.log(chalk.gray('Output:'), chalk.cyan(outputFile));
    console.log(chalk.gray('Working directory:'), chalk.cyan(cwd));
    console.log(chalk.gray('Max steps:'), chalk.cyan(maxAgentSteps.toString()));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      const result = await this.client.run({
        agent: 'codebuff/base@0.0.16',
        prompt,
        cwd,
        maxAgentSteps,
        handleEvent: this.logger.handleEvent,
      });

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      // Extract credits used from result (defensive handling)
      let creditsUsed: number | undefined;
      if (result && typeof result === 'object') {
        // Try multiple possible paths for credits
        const resultObj = result as Record<string, unknown>;
        if (resultObj.sessionState && typeof resultObj.sessionState === 'object') {
          const sessionState = resultObj.sessionState as Record<string, unknown>;
          if (sessionState.mainAgentState && typeof sessionState.mainAgentState === 'object') {
            const mainAgentState = sessionState.mainAgentState as Record<string, unknown>;
            creditsUsed = mainAgentState.creditsUsed as number | undefined;
          }
        }
        // Fallback: direct creditsUsed property
        if (creditsUsed === undefined && 'creditsUsed' in resultObj) {
          creditsUsed = resultObj.creditsUsed as number | undefined;
        }
      }

      // Check for error response
      if (result && typeof result === 'object' && 'type' in result && (result as Record<string, unknown>).type === 'error') {
        const errorResult = result as { type: string; message?: string };
        throw new Error(errorResult.message || 'Unknown error from Codebuff');
      }

      console.log(chalk.gray('\n' + '─'.repeat(50)));
      console.log(chalk.green('✓ Codebuff analysis complete'));
      if (creditsUsed !== undefined) {
        console.log(chalk.gray('Credits used:'), chalk.yellow(creditsUsed.toFixed(4)));
      }

      // Save logs
      const traceFile = this.logger.saveTrace();
      const summary: RunSummary = {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs,
        profile,
        region,
        outputFile,
        creditsUsed,
        success: true,
      };
      const summaryFile = this.logger.saveSummary(summary);

      this.logger.logEvent('analysis_complete', { durationMs, creditsUsed });

      return {
        success: true,
        creditsUsed,
        traceFile,
        summaryFile,
      };
    } catch (error) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.logEvent('analysis_error', { error: errorMessage, durationMs });

      // Save logs even on error
      const traceFile = this.logger.saveTrace();
      const summary: RunSummary = {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs,
        profile,
        region,
        outputFile,
        success: false,
        error: errorMessage,
      };
      const summaryFile = this.logger.saveSummary(summary);

      return {
        success: false,
        error: errorMessage,
        traceFile,
        summaryFile,
      };
    }
  }

  /**
   * Get the logger instance for external access
   */
  getLogger(): Logger {
    return this.logger;
  }
}

/**
 * Check if CODEBUFF_API_KEY environment variable is set
 */
export function checkApiKey(): string | null {
  return process.env.CODEBUFF_API_KEY || null;
}

/**
 * Check if aws CLI is available
 */
export async function checkAwsCliInstalled(): Promise<boolean> {
  try {
    const proc = spawn({
      cmd: ['aws', '--version'],
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Validate AWS profile exists
 */
export async function validateAwsProfile(profile: string): Promise<boolean> {
  try {
    const proc = spawn({
      cmd: ['aws', 'sts', 'get-caller-identity', '--profile', profile],
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}
