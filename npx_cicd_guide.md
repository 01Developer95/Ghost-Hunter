# Simulation Guide: `npx` & CI/CD for Ghost Import Hunter

Measurements for success in this workshop: Understanding how a user interacts with your tool via `npx` and how you automate its quality and release via CI/CD.

## Part 1: The User Experience (npx)

**Scenario:** A developer wants to use `ghost-import-hunter` to check their project for AI hallucinations. They do NOT want to install it permanently.

### 1. Current State (Local Development)
Right now, since your tool is local, you run it like this:
```bash
# In your project root
npx ts-node src/index.ts .
```
**What's happening?**
- `npx` downloads `ts-node` (a temporary runner).
- It executes your `src/index.ts` file directly.

### 2. The Goal State (Published Tool)
Once you publish your package to npm (the public registry), a user anywhere in the world will run:
```bash
npx ghost-import-hunter
```

**Step-by-Step Simulation of what happens:**
1.  **User types:** `npx ghost-import-hunter` in *their* terminal.
2.  **Lookup:** `npx` asks the npm registry: "Where is the latest `ghost-import-hunter`?"
3.  **Download:** It downloads a zip of your package to a temporary cache folder on their machine.
4.  **Execute:** It reads your `package.json` file:
    ```json
    "bin": {
        "ghost-hunter": "./dist/index.js"
    }
    ```
    It sees that the binary command is mapped to `./dist/index.js`.
5.  **Run:** It executes `node dist/index.js`.
6.  **Cleanup:** Once your tool finishes running, `npx` removes the cached files (mostly). The user's machine stays clean.

---

## Part 2: Your Workflow (CI/CD)

**Scenario:** You are modifying `ghost-import-hunter`. You want to ensure you don't break it (CI) and automatically release it to users (CD).

### 1. Continuous Integration (CI) - The "Safety Net"
**Concept:** Every time you push code to GitHub, a robot wakes up and checks your work.

**Simulation:**
1.  **You:** Edit `src/index.ts` to add a new feature.
2.  **You:** `git commit -m "feat: faster scanning"` & `git push`.
3.  **GitHub Actions (The Robot):**
    *   Spins up a virtual machine (Ubuntu).
    *   Clones your code.
    *   Runs `npm install`.
    *   Runs **`npm run build`** (Compiles TS -> JS).
    *   Runs **`npm test`** (If you have tests).
4.  **Result:**
    *   ✅ **Pass:** You see a green checkmark on your PR. You can merge.
    *   ❌ **Fail:** You get an email. You *cannot* merge until you fix it.

### 2. Continuous Deployment (CD) - The "Delivery Truck"
**Concept:** When you release a new version, the robot handles the publishing.

**Simulation:**
1.  **You:** Decide the code is ready. You create a "Release" on GitHub (tag `v1.0.1`).
2.  **GitHub Actions:**
    *   Detects the new tag.
    *   Builds the project again (to be sure).
    *   Authenticates with npm using a secret key (NPM_TOKEN).
    *   Runs **`npm publish`**.
3.  **Result:** Within minutes, users worldwide can run `npx ghost-import-hunter@1.0.1`.

---

## Setup Guide

To enable this, you need a `.github/workflows/ci.yml` file.

### Sample `ci.yml` for Ghost Import Hunter

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - run: npm ci
      - run: npm run build
      # - run: npm test  <-- Add this when you verify tests
```
