#!/usr/bin/env bun

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { CodebuffAnalyzer, checkApiKey, checkAwsCliInstalled, validateAwsProfile } from './codebuff.js';
import { generateAWSAnalysisPrompt, generateQuickSnapshotPrompt } from './prompts/aws-analysis.js';

const VERSION = '1.0.0';

program
  .name('cloutive')
  .description('AWS Infrastructure Analysis CLI - Uses Codebuff AI to generate comprehensive reports')
  .version(VERSION);

program
  .command('analyze')
  .description('Generate a comprehensive AWS infrastructure analysis report')
  .requiredOption('-p, --profile <profile>', 'AWS CLI profile name')
  .option('-r, --region <region>', 'AWS region (auto-detected if not specified)')
  .option('-o, --output <file>', 'Output file path', 'aws-analysis-report.md')
  .option('-c, --client <name>', 'Client name for the report')
  .option('-n, --consultant <name>', 'Consultant name for the report')
  .option('-s, --max-steps <number>', 'Maximum agent steps', '50')
  .action(async (options) => {
    console.log(chalk.bold.blue('\n☁️  Cloutive AWS Infrastructure Analyzer\n'));

    // Pre-flight checks
    const spinner = ora('Checking prerequisites...').start();

    // Check CODEBUFF_API_KEY
    const apiKey = checkApiKey();
    if (!apiKey) {
      spinner.fail('CODEBUFF_API_KEY environment variable not set');
      console.log(chalk.yellow('\nPlease set your Codebuff API key:'));
      console.log(chalk.gray('  export CODEBUFF_API_KEY=your_api_key'));
      console.log(chalk.gray('\nGet your API key at: https://codebuff.com'));
      process.exit(1);
    }

    // Check aws cli
    if (!await checkAwsCliInstalled()) {
      spinner.fail('AWS CLI not found');
      console.log(chalk.yellow('\nPlease install AWS CLI first:'));
      console.log(chalk.gray('  https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html'));
      process.exit(1);
    }

    spinner.text = `Validating AWS profile: ${options.profile}...`;

    // Validate AWS profile
    if (!await validateAwsProfile(options.profile)) {
      spinner.fail(`AWS profile '${options.profile}' not found or invalid`);
      console.log(chalk.yellow('\nPlease check your AWS credentials:'));
      console.log(chalk.gray(`  aws configure --profile ${options.profile}`));
      console.log(chalk.gray('  # or check ~/.aws/credentials'));
      process.exit(1);
    }

    spinner.succeed('Prerequisites validated');

    // Display configuration
    console.log(chalk.gray('\nConfiguration:'));
    console.log(chalk.gray('  Profile:'), chalk.white(options.profile));
    console.log(chalk.gray('  Region:'), chalk.white(options.region || 'auto-detect'));
    console.log(chalk.gray('  Output:'), chalk.white(options.output));
    console.log(chalk.gray('  Max Steps:'), chalk.white(options.maxSteps));
    if (options.client) console.log(chalk.gray('  Client:'), chalk.white(options.client));
    if (options.consultant) console.log(chalk.gray('  Consultant:'), chalk.white(options.consultant));

    // Generate prompt
    const prompt = generateAWSAnalysisPrompt({
      profile: options.profile,
      region: options.region,
      clientName: options.client,
      consultantName: options.consultant,
      outputFile: options.output,
    });

    // Run analysis using SDK
    try {
      const analyzer = new CodebuffAnalyzer(apiKey);
      const result = await analyzer.analyze({
        prompt,
        profile: options.profile,
        region: options.region,
        outputFile: options.output,
        maxAgentSteps: parseInt(options.maxSteps, 10),
      });

      if (result.success) {
        console.log(chalk.green.bold(`\n✅ Report generated: ${options.output}`));
        if (result.creditsUsed !== undefined) {
          console.log(chalk.gray(`   Credits used: ${result.creditsUsed.toFixed(4)}`));
        }
        if (result.traceFile) {
          console.log(chalk.gray(`   Trace log: ${result.traceFile}`));
        }
        if (result.summaryFile) {
          console.log(chalk.gray(`   Summary: ${result.summaryFile}`));
        }
        console.log();
      } else {
        console.error(chalk.red(`\n❌ Analysis failed: ${result.error}`));
        if (result.traceFile) {
          console.log(chalk.gray(`   Trace log: ${result.traceFile}`));
        }
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Analysis failed:'), error);
      process.exit(1);
    }
  });

program
  .command('snapshot')
  .description('Generate a quick AWS system snapshot')
  .requiredOption('-p, --profile <profile>', 'AWS CLI profile name')
  .option('-r, --region <region>', 'AWS region')
  .option('-o, --output <file>', 'Output file path', 'aws-snapshot.md')
  .option('-s, --max-steps <number>', 'Maximum agent steps', '25')
  .action(async (options) => {
    console.log(chalk.bold.blue('\n☁️  Cloutive Quick Snapshot\n'));

    const spinner = ora('Checking prerequisites...').start();

    // Check CODEBUFF_API_KEY
    const apiKey = checkApiKey();
    if (!apiKey) {
      spinner.fail('CODEBUFF_API_KEY environment variable not set');
      console.log(chalk.yellow('\nPlease set your Codebuff API key:'));
      console.log(chalk.gray('  export CODEBUFF_API_KEY=your_api_key'));
      process.exit(1);
    }

    if (!await checkAwsCliInstalled()) {
      spinner.fail('AWS CLI not found');
      process.exit(1);
    }

    if (!await validateAwsProfile(options.profile)) {
      spinner.fail(`AWS profile '${options.profile}' invalid`);
      process.exit(1);
    }

    spinner.succeed('Prerequisites validated');

    const prompt = generateQuickSnapshotPrompt({
      profile: options.profile,
      region: options.region,
      outputFile: options.output,
    });

    try {
      const analyzer = new CodebuffAnalyzer(apiKey);
      const result = await analyzer.analyze({
        prompt,
        profile: options.profile,
        region: options.region,
        outputFile: options.output,
        maxAgentSteps: parseInt(options.maxSteps, 10),
      });

      if (result.success) {
        console.log(chalk.green.bold(`\n✅ Snapshot generated: ${options.output}`));
        if (result.creditsUsed !== undefined) {
          console.log(chalk.gray(`   Credits used: ${result.creditsUsed.toFixed(4)}`));
        }
        console.log();
      } else {
        console.error(chalk.red(`\n❌ Snapshot failed: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Snapshot failed:'), error);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check if all prerequisites are installed')
  .action(async () => {
    console.log(chalk.bold.blue('\n🔍 Checking Prerequisites\n'));

    // Check CODEBUFF_API_KEY
    const apiKeySpinner = ora('Checking CODEBUFF_API_KEY...').start();
    const apiKey = checkApiKey();
    if (apiKey) {
      apiKeySpinner.succeed('CODEBUFF_API_KEY is set');
    } else {
      apiKeySpinner.fail('CODEBUFF_API_KEY is not set');
    }

    // Check AWS CLI
    const awsSpinner = ora('Checking AWS CLI...').start();
    const awsInstalled = await checkAwsCliInstalled();
    if (awsInstalled) {
      awsSpinner.succeed('AWS CLI is installed');
    } else {
      awsSpinner.fail('AWS CLI is not installed');
    }

    console.log();

    // Summary
    if (apiKey && awsInstalled) {
      console.log(chalk.green('✅ All prerequisites are satisfied!'));
    } else {
      console.log(chalk.yellow('⚠️  Some prerequisites are missing:'));
      if (!apiKey) {
        console.log(chalk.gray('  - Set CODEBUFF_API_KEY environment variable'));
      }
      if (!awsInstalled) {
        console.log(chalk.gray('  - Install AWS CLI'));
      }
    }

    console.log();
  });

program.parse();
