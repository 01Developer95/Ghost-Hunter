# Ghost Import Hunter 👻

**The AI Hallucination Detector for Codebases.**

AI coding assistants (ChatGPT, Copilot) often "hallucinate" code imports—suggesting functions that don't satisfy the installed version of a library or don't exist at all.

**Ghost Hunter** is a deterministic tool that scans your TypeScript/JavaScript project and verifies every import against your actual `node_modules`.

## Features
- 🚨 **Hallucination Detection**: Finds imports that do not exist in the installed package version.
- 📦 **Zero-Config**: Just run it in your project root.
- ⚡ **Fast**: Uses AST parsing and efficient caching.

## Usage

```bash
# Run in your project directory
npx ts-node src/index.ts .
```

## How it works
1.  **Scans**: Parses all `.ts/.js` files to find imports.
2.  **Resolves**: Locates the `package.json` and type definitions (`.d.ts`) for every imported module.
3.  **Verifies**: Checks if the specific named export (e.g., `import { foo }`) actually exists in the library's exports.

## License
MIT
