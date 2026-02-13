#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { scanProject } from './scanner';
import { validateImports } from './validator';

const program = new Command();

program
    .name('ghost-hunter')
    .description('A deterministic tool to find AI hallucinations and unused code')
    .version('1.0.0')
    .argument('[directory]', 'Directory to scan', '.')
    .action(async (directory) => {
        console.log(chalk.blue(`👻 Ghost Hunter scanning: ${directory}...`));

        try {
            const imports = await scanProject(directory);
            const report = await validateImports(directory, imports);

            if (report.hallucinations.length > 0) {
                console.log(chalk.red('\n🚨 Hallucinations Detected (AI Lied!):'));
                report.hallucinations.forEach(h => {
                    console.log(`  - ${chalk.bold(h.module)}: Used member ${chalk.bold(h.member)} does not exist in installed version.`);
                    console.log(`    File: ${h.file}:${h.line}`);
                });
            } else {
                console.log(chalk.green('\n✅ No Hallucinations detected.'));
            }

            if (report.unused.length > 0) {
                console.log(chalk.yellow('\n⚠️  Unused Imports (Bloat):'));
                report.unused.forEach(u => {
                    console.log(`  - ${chalk.bold(u.module)}: Imported but never used.`);
                    console.log(`    File: ${u.file}:${u.line}`);
                });
            }

        } catch (error) {
            console.error(chalk.red('Error scanning project:'), error);
            process.exit(1);
        }
    });

program.parse();
