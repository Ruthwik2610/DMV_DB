/**
 * Frontend scaffold templates for ZIP download.
 * Mirrors the backend api/scaffold.js templates so ZIP downloads
 * contain a complete, deployable project structure.
 */

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const REACT_VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
})
`;

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

function reactPackageJson(name, extraDeps = {}) {
    return JSON.stringify({
        name: name || 'llmatscale-site',
        private: true,
        version: '1.0.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', ...extraDeps },
        devDependencies: { '@vitejs/plugin-react': '^4.3.0', vite: '^5.4.0' },
    }, null, 2);
}

function reactIndexHtml(rawName) {
    const name = escHtml(rawName || 'LLM at Scale.AI Site');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <meta name="description" content="${name} — Built with LLM at Scale.AI">
  <meta property="og:title" content="${name}">
  <meta property="og:description" content="Built with LLM at Scale.AI">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌐</text></svg>">
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/themes.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`;
}

function vanillaPackageJson(name) {
    return JSON.stringify({
        name: name || 'llmatscale-site',
        private: true,
        version: '1.0.0',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        devDependencies: { vite: '^5.4.0' },
    }, null, 2);
}

/**
 * Returns a { path: content } map of the full scaffolded project.
 * Used for ZIP download on the frontend.
 */
export function getScaffoldFiles(files, template, projectName) {
    const result = {};

    if (template === 'vanilla') {
        result['package.json'] = vanillaPackageJson(projectName);
        for (const [name, code] of Object.entries(files)) {
            result[name.replace(/^\//, '')] = code;
        }
        if (!result['index.html']) {
            result['index.html'] = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName || 'LLM at Scale.AI Site'}</title>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/themes.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <script type="module" src="main.js"></script>
</body>
</html>`;
        }
    } else {
        result['package.json'] = reactPackageJson(projectName, detectDeps(files));
        result['vite.config.js'] = REACT_VITE_CONFIG;
        result['index.html'] = reactIndexHtml(projectName);
        result['src/main.jsx'] = REACT_MAIN_JSX;

        let hasStyles = false;
        for (const [name, code] of Object.entries(files)) {
            const cleanName = name.replace(/^\//, '');
            const filePath = cleanName.startsWith('src/') ? cleanName : `src/${cleanName}`;
            result[filePath] = code;
            if (cleanName === 'styles.css' || cleanName === 'App.css') hasStyles = true;
        }
        if (!hasStyles) result['src/styles.css'] = '/* Add your styles here */\n';
    }

    return result;
}
