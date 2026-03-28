import fs from 'fs';
import path from 'path';
import Table from 'cli-table3';
import chalk from 'chalk';
import { BaseCommand } from './base.js';
import { IExecutionListResult } from '../core/index.js';

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
            status: options.status,
            limit: options.limit,
            includeData: false,
        });

        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }

        if (result.items.length === 0) {
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

        for (const item of result.items) {
            table.push([
                item.id,
                item.workflowName || item.workflowId || '-',
                item.status || '-',
                item.mode || '-',
                item.startedAt || '-',
            ]);
        }

        console.log('\n' + table.toString() + '\n');
        if (typeof result.total === 'number') {
            console.log(chalk.dim(`Total matching executions: ${result.total}`));
        }
    }

    async downloadExecution(executionId: string, options: ExecutionDownloadCommandOptions): Promise<void> {
        const payload = await this.client.getExecution(executionId, options.includeData ?? true);
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
}
