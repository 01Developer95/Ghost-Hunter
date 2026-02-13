"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImports = validateImports;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const resolve = __importStar(require("resolve"));
function validateImports(directory, imports) {
    const report = { hallucinations: [], unused: [] };
    const cache = new Map(); // Cache exports per module path
    for (const imp of imports) {
        let exportedMembers = [];
        let modulePathOrId = imp.module;
        try {
            // 1. Check for Built-in modules (fs, path, etc.)
            if (resolve.isCore(imp.module)) {
                // Safe to require built-ins in Node environment
                const mod = require(imp.module);
                exportedMembers = Object.keys(mod);
            }
            else {
                // 2. Resolve external modules
                const modulePath = resolve.sync(imp.module, { basedir: directory });
                modulePathOrId = modulePath;
                // Check cache first
                if (cache.has(modulePath)) {
                    exportedMembers = cache.get(modulePath);
                }
                else {
                    // 3. Resolve Type Definition if possible
                    let typeDefPath = modulePath;
                    if (path.extname(modulePath) === '.js') {
                        const dtsPath = modulePath.replace(/\.js$/, '.d.ts');
                        if (fs.existsSync(dtsPath)) {
                            typeDefPath = dtsPath;
                        }
                        else {
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
                if (member === 'default')
                    return;
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
        }
        catch (err) {
            // Module resolution failed -> Hallucination of the entire module?
            // "Dependency Hallucination"
            if (err.code === 'MODULE_NOT_FOUND') {
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
function findPackageJson(startPath) {
    let dir = path.dirname(startPath);
    while (dir !== path.parse(dir).root) {
        const pkg = path.join(dir, 'package.json');
        if (fs.existsSync(pkg))
            return pkg;
        dir = path.dirname(dir);
    }
    return null;
}
function extractExports(content) {
    const exports = [];
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
