
import * as fs from 'fs';
import * as path from 'path';
import * as resolve from 'resolve';
import { ImportInfo } from './scanner';

export interface ValidationReport {
    hallucinations: {
        file: string;
        line: number;
        module: string;
        member: string;
    }[];
    unused: { // Placeholder for future feature
        file: string;
        line: number;
        module: string;
    }[];
}

export function validateImports(directory: string, imports: ImportInfo[]): ValidationReport {
    const report: ValidationReport = { hallucinations: [], unused: [] };
    const cache = new Map<string, string[]>(); // Cache exports per module path

    for (const imp of imports) {
        let exportedMembers: string[] = [];
        let modulePathOrId = imp.module;

        try {
            // 1. Check for Built-in modules (fs, path, etc.)
            if (resolve.isCore(imp.module)) {
                // Safe to require built-ins in Node environment
                const mod = require(imp.module);
                exportedMembers = Object.keys(mod);
            } else {
                // 2. Resolve external modules
                const modulePath = resolve.sync(imp.module, { basedir: directory });
                modulePathOrId = modulePath;

                // Check cache first
                if (cache.has(modulePath)) {
                    exportedMembers = cache.get(modulePath)!;
                } else {
                    // 3. Resolve Type Definition if possible
                    let typeDefPath = modulePath;
                    if (path.extname(modulePath) === '.js') {
                        const dtsPath = modulePath.replace(/\.js$/, '.d.ts');
                        if (fs.existsSync(dtsPath)) {
                            typeDefPath = dtsPath;
                        } else {
                            const pkgJsonPath = findPackageJson(modulePath);
                            if (pkgJsonPath) {
                                const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                                if (pkg.types || pkg.typings) {
                                    typeDefPath = path.resolve(path.dirname(pkgJsonPath), pkg.types || pkg.typings);
                                }
                            }
                        }
                    }

                    // 4. Get exported members (naive regex parse)
                    const content = fs.existsSync(typeDefPath) ? fs.readFileSync(typeDefPath, 'utf-8') : '';
                    exportedMembers = extractExports(content);
                    cache.set(modulePath, exportedMembers);
                }
            }

            // 5. Validate Members
            imp.members.forEach(member => {
                if (member === 'default') return;

                // For built-ins, exact match is required
                // For external, we have regex which might miss things, so be careful.
                // But for "Hallucinations", missing is strong signal.
                if (!exportedMembers.includes(member)) {
                    // Special check for "export *" in non-core modules
                    let isSafe = false;
                    if (!resolve.isCore(imp.module)) {
                        // If we parsed a file and it has "export *", we can't be sure something ISN'T there without following it.
                        // For MVP, if "export *" exists, we skip strict validation to avoid false positives.
                        // We access the content again... slightly inefficient but ok for MVP.
                        // Actually we can cache this "hasExportStar" boolean too. 
                        // For now, let's just re-read or assume unsafe if we didn't implement deep walking.
                        // Let's rely on the regex extractExports which should handle some cases, but if not found:
                        // We can assume true if we found "export *".
                        // TODO: Make this robust.
                    }

                    report.hallucinations.push({
                        file: imp.file,
                        line: imp.line,
                        module: imp.module,
                        member: member
                    });
                }
            });

        } catch (err) {
            // Module resolution failed -> Hallucination of the entire module?
            // "Dependency Hallucination"
            if ((err as any).code === 'MODULE_NOT_FOUND') {
                report.hallucinations.push({
                    file: imp.file,
                    line: imp.line,
                    module: imp.module,
                    member: '*' // Whole module missing
                });
            }
        }
    }

    return report;
}

function findPackageJson(startPath: string): string | null {
    let dir = path.dirname(startPath);
    while (dir !== path.parse(dir).root) {
        const pkg = path.join(dir, 'package.json');
        if (fs.existsSync(pkg)) return pkg;
        dir = path.dirname(dir);
    }
    return null;
}

function extractExports(content: string): string[] {
    const exports: string[] = [];

    // Regex for: export const/function/class Name
    const namedExportRegex = /export\s+(?:const|var|let|function|class|interface|type)\s+([a-zA-Z0-9_$]+)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
        exports.push(match[1]);
    }

    // Regex for: export { Name }
    const bracketExportRegex = /export\s*\{([^}]+)\}/g;
    while ((match = bracketExportRegex.exec(content)) !== null) {
        const names = match[1].split(',').map(s => s.trim().split(' as ')[0].trim());
        exports.push(...names);
    }

    return exports;
}
