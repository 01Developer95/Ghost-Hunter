"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const scanner_1 = require("./scanner");
const validator_1 = require("./validator");
const program = new commander_1.Command();
program
    .name('ghost-hunter')
    .description('A deterministic tool to find AI hallucinations and unused code')
    .version('1.0.0')
    .argument('[directory]', 'Directory to scan', '.')
    .action(async (directory) => {
    console.log(chalk_1.default.blue(`👻 Ghost Hunter scanning: ${directory}...`));
    try {
        const imports = await (0, scanner_1.scanProject)(directory);
        const report = await (0, validator_1.validateImports)(directory, imports);
        if (report.hallucinations.length > 0) {
            console.log(chalk_1.default.red('\n🚨 Hallucinations Detected (AI Lied!):'));
            report.hallucinations.forEach(h => {
                console.log(`  - ${chalk_1.default.bold(h.module)}: Used member ${chalk_1.default.bold(h.member)} does not exist in installed version.`);
                console.log(`    File: ${h.file}:${h.line}`);
            });
        }
        else {
            console.log(chalk_1.default.green('\n✅ No Hallucinations detected.'));
        }
        if (report.unused.length > 0) {
            console.log(chalk_1.default.yellow('\n⚠️  Unused Imports (Bloat):'));
            report.unused.forEach(u => {
                console.log(`  - ${chalk_1.default.bold(u.module)}: Imported but never used.`);
                console.log(`    File: ${u.file}:${u.line}`);
            });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('Error scanning project:'), error);
        process.exit(1);
    }
});
program.parse();
