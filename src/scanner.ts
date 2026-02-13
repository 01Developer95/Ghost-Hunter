
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface ImportInfo {
    file: string;
    line: number;
    module: string;
    members: string[]; // Start with named imports only
}

export async function scanProject(directory: string): Promise<ImportInfo[]> {
    const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: directory,
        ignore: ['node_modules/**', 'dist/**', 'build/**']
    });

    const imports: ImportInfo[] = [];

    for (const file of files) {
        const filePath = path.join(directory, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true
        );

        ts.forEachChild(sourceFile, (node) => {
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;

                // Skip relative imports for now, focus on packages
                if (moduleSpecifier.startsWith('.')) return;

                const namedImports: string[] = [];
                const importClause = node.importClause;

                if (importClause && importClause.namedBindings) {
                    if (ts.isNamedImports(importClause.namedBindings)) {
                        importClause.namedBindings.elements.forEach((element) => {
                            namedImports.push(element.name.text);
                        });
                    }
                }

                if (namedImports.length > 0) {
                    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    imports.push({
                        file: filePath,
                        line: line + 1,
                        module: moduleSpecifier,
                        members: namedImports,
                    });
                }
            }
        });
    }

    return imports;
}
