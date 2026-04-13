/**
 * Project Scaffold Module
 * Wraps LLM-generated files into deployable Vite+React or Vanilla projects.
 * Used by deploy endpoints (Vercel & GitHub) and referenced by frontend for ZIP.
 */

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── React Scaffold Templates ─────────────────────────────────────────

// Packages the LLM commonly uses — detected from generated code and added to package.json
const KNOWN_PACKAGES = {
    'react-router-dom': '^7.1.0',
    'lucide-react': '^0.460.0',
    'framer-motion': '^11.15.0',
    'react-icons': '^5.4.0',
    'axios': '^1.7.0',
    '@headlessui/react': '^2.2.0',
    'clsx': '^2.1.0',
    'recharts': '^2.15.0',
    'date-fns': '^4.1.0',
    'zustand': '^5.0.0',
};

function detectDeps(files) {
    const allCode = Object.values(files).join('\n');
    const deps = {};
    for (const [pkg, version] of Object.entries(KNOWN_PACKAGES)) {
        if (allCode.includes(pkg)) deps[pkg] = version;
    }
    return deps;
}

function reactPackageJson(projectName, extraDeps = {}) {
    return JSON.stringify({
        name: projectName || 'atlas-site',
        private: true,
        version: '1.0.0',
        type: 'module',
        scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
        },
        dependencies: {
            react: '^19.0.0',
            'react-dom': '^19.0.0',
            ...extraDeps,
        },
        devDependencies: {
            '@vitejs/plugin-react': '^4.3.0',
            vite: '^5.4.0',
        },
    }, null, 2);
}

function reactViteConfig(projectName) {
    // Use './' as base so assets resolve correctly on GitHub Pages
    return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
})
`;
}

function reactIndexHtml(projectName) {
    const name = escHtml(projectName || 'Atlas Site');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <meta name="description" content="${name} — Built with Atlas AI">
  <meta property="og:title" content="${name}">
  <meta property="og:description" content="Built with Atlas AI">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>">
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/themes.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"><\/script>
</body>
</html>`;
}

const REACT_MAIN_JSX = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;

// ── Vanilla Scaffold Templates ───────────────────────────────────────

function vanillaPackageJson(projectName) {
    return JSON.stringify({
        name: projectName || 'atlas-site',
        private: true,
        version: '1.0.0',
        scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview',
        },
        devDependencies: {
            vite: '^5.4.0',
        },
    }, null, 2);
}

// ── GitHub Actions Workflow ──────────────────────────────────────────

const GITHUB_PAGES_WORKFLOW = `name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install && npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
`;

const GITHUB_PAGES_WORKFLOW_VANILLA = `name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
`;

// ── Scaffold Functions ───────────────────────────────────────────────

/**
 * Returns a plain { path: content } map of the full scaffolded project.
 * Used by both backend (deploy) and can be serialized for frontend (ZIP).
 */
export function getScaffoldFilesRaw(files, template, projectName) {
    const result = {};

    if (template === 'vanilla') {
        result['package.json'] = vanillaPackageJson(projectName);
        // Map user files to root
        for (const [name, code] of Object.entries(files)) {
            const cleanName = name.replace(/^\//, '');
            result[cleanName] = code;
        }
        // If no index.html from user, create a basic one
        if (!result['index.html']) {
            result['index.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName || 'Atlas Site'}</title>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/themes.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <script type="module" src="main.js"><\/script>
</body>
</html>`;
        }
    } else {
        // React template
        result['package.json'] = reactPackageJson(projectName, detectDeps(files));
        result['vite.config.js'] = reactViteConfig(projectName);
        result['index.html'] = reactIndexHtml(projectName);
        result['src/main.jsx'] = REACT_MAIN_JSX;

        // Ensure styles.css exists (main.jsx imports it)
        let hasStyles = false;

        for (const [name, code] of Object.entries(files)) {
            const cleanName = name.replace(/^\//, '');
            // Place user files under src/
            const filePath = cleanName.startsWith('src/') ? cleanName : `src/${cleanName}`;
            result[filePath] = code;
            if (cleanName === 'styles.css' || cleanName === 'App.css') {
                hasStyles = true;
            }
        }

        if (!hasStyles) {
            result['src/styles.css'] = '/* Add your styles here */\n';
        }
    }

    return result;
}

/**
 * Scaffolds a project and returns files in Vercel deployment API format.
 * Each file: { file: "path", data: "<base64>", encoding: "base64" }
 */
export function scaffoldForVercel(files, template, projectName) {
    const raw = getScaffoldFilesRaw(files, template, projectName);
    return Object.entries(raw).map(([filePath, content]) => ({
        file: filePath,
        data: Buffer.from(content, 'utf-8').toString('base64'),
        encoding: 'base64',
    }));
}

/**
 * Scaffolds a project and returns files for GitHub API.
 * Each file: { path: "path", content: "<base64>" }
 * Also includes GitHub Actions workflow for React projects.
 */
export function scaffoldForGitHub(files, template, projectName) {
    const raw = getScaffoldFilesRaw(files, template, projectName);

    // Add GitHub Pages workflow
    if (template === 'vanilla') {
        raw['.github/workflows/deploy.yml'] = GITHUB_PAGES_WORKFLOW_VANILLA;
    } else {
        raw['.github/workflows/deploy.yml'] = GITHUB_PAGES_WORKFLOW;
    }

    return Object.entries(raw).map(([filePath, content]) => ({
        path: filePath,
        content: Buffer.from(content, 'utf-8').toString('base64'),
    }));
}
