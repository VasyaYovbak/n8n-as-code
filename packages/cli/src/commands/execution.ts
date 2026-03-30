import fs from 'fs';
import path from 'path';
import Table from 'cli-table3';
import chalk from 'chalk';
import { BaseCommand } from './base.js';
import { ExecutionStatus } from '../core/index.js';

export interface ExecutionListCommandOptions {
    workflowId?: string;
    projectId?: string;
    status?: string;
    limit?: number;
    json?: boolean;
}

export interface ExecutionDownloadCommandOptions {
    outputDir?: string;
    includeData?: boolean;
    json?: boolean;
}

export class ExecutionCommand extends BaseCommand {
    async listRecent(options: ExecutionListCommandOptions): Promise<void> {
        const result = await this.client.listExecutions({
            workflowId: options.workflowId,
            projectId: options.projectId,
            status: options.status as ExecutionStatus | undefined,
            limit: options.limit,
            includeData: false,
        });

        const legacyResult = {
            items: result.data,
            total: result.total,
            nextCursor: result.nextCursor,
        };

        if (options.json) {
            console.log(JSON.stringify(legacyResult, null, 2));
            return;
        }

        if (result.data.length === 0) {
            console.log(chalk.yellow('No executions found.'));
            return;
        }

        const table = new Table({
            head: [
                chalk.bold('ID'),
                chalk.bold('Workflow'),
                chalk.bold('Status'),
                chalk.bold('Mode'),
                chalk.bold('Started'),
            ],
            wordWrap: true,
        });

        for (const item of result.data) {
            table.push([
                item.id,
                item.workflowName || item.workflowId || '-',
                item.status || '-',
                item.mode || '-',
                item.startedAt || '-',
            ]);
        }

        console.log('\n' + table.toString() + '\n');
        if (typeof legacyResult.total === 'number') {
            console.log(chalk.dim(`Total matching executions: ${legacyResult.total}`));
        }
    }

    async downloadExecution(executionId: string, options: ExecutionDownloadCommandOptions): Promise<void> {
        const payload = await this.client.getExecution(executionId, { includeData: options.includeData ?? true });
        const outputDir = this.resolveExecutionsDirectory(options.outputDir);
        fs.mkdirSync(outputDir, { recursive: true });

        const filePath = path.resolve(outputDir, `${executionId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

        if (options.json) {
            console.log(JSON.stringify({
                executionId,
                path: filePath,
            }, null, 2));
            return;
        }

        console.log(filePath);
    }

    private resolveExecutionsDirectory(override?: string): string {
        if (override?.trim()) {
            return path.resolve(process.cwd(), override.trim());
        }

        const localConfig = this.configService.getLocalConfig();
        const configuredFolder = typeof (localConfig as any).executionsFolder === 'string'
            ? (localConfig as any).executionsFolder.trim()
            : '';

        return path.resolve(process.cwd(), configuredFolder || '.executions');
    }

    async list(options: {
        workflowId?: string;
        status?: ExecutionStatus;
        projectId?: string;
        limit?: number;
        cursor?: string;
        includeData?: boolean;
        json?: boolean;
    } = {}): Promise<void> {
        try {
            const result = await this.client.listExecutions(options);

            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
                return;
            }

            if (result.data.length === 0) {
                console.log(chalk.yellow('No executions found.'));
                return;
            }

            const table = new Table({
                head: [
                    chalk.bold('ID'),
                    chalk.bold('Status'),
                    chalk.bold('Mode'),
                    chalk.bold('Workflow'),
                    chalk.bold('Started'),
                    chalk.bold('Stopped'),
                ],
                wordWrap: true,
            });

            for (const execution of result.data) {
                table.push([
                    execution.id,
                    execution.status,
                    execution.mode,
                    execution.workflowName || execution.workflowId || '-',
                    execution.startedAt || '-',
                    execution.stoppedAt || '-',
                ]);
            }

            console.log(`\n${table.toString()}\n`);
            console.log(chalk.dim(`Total returned: ${typeof result.total === 'number' ? result.total : result.data.length}`));
            if (result.nextCursor) {
                console.log(chalk.dim(`Next cursor: ${result.nextCursor}`));
            }
        } catch (error) {
            this.exitWithError('Failed to list executions', error);
        }
    }

    async get(id: string, options: { includeData?: boolean; json?: boolean } = {}): Promise<void> {
        try {
            const execution = await this.client.getExecution(id, { includeData: options.includeData });
            console.log(JSON.stringify(execution, null, 2));
        } catch (error) {
            this.exitWithError(`Failed to fetch execution ${id}`, error);
        }
    }
}
