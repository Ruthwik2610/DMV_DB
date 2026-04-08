import React, { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import {
    Copy, Check, Download, Maximize2, Minimize2, Code, Eye,
    Rocket, ExternalLink, Github, RefreshCw, ChevronDown,
    Smartphone, Tablet, Monitor,
} from 'lucide-react';
import JSZip from 'jszip';
import { getScaffoldFiles } from '../utils/scaffoldTemplates';

// Lazy-load Sandpack so it only loads when code preview is needed (~250KB)
const SandpackLazy = React.lazy(() =>
    import('@codesandbox/sandpack-react').then(mod => ({ default: mod.Sandpack }))
);

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * SandpackPreview
 * Renders a live, interactive website preview from LLM-generated code files.
 * Supports React and vanilla HTML/CSS/JS templates.
 * Includes deploy to Vercel/GitHub and ZIP download.
 */
export default function SandpackPreview({ files, template = 'react', sourceRepo }) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeView, setActiveView] = useState('preview');

    // Deploy state
    const [deployState, setDeployState] = useState('idle'); // idle|deploying|polling|ready|error
    const [deployUrl, setDeployUrl] = useState(null);
    const [deployRepoUrl, setDeployRepoUrl] = useState(null);
    const [deployError, setDeployError] = useState(null);
    const [deployTarget, setDeployTarget] = useState(null);
    const [showDeployMenu, setShowDeployMenu] = useState(false);
    const [viewportWidth, setViewportWidth] = useState('100%'); // '375px' | '768px' | '1024px' | '100%'
    const deployMenuRef = useRef(null);
    const pollRef = useRef(null);

    const hasFiles = files && Object.keys(files).length > 0;

    // Light CSS sanitization only — JS/JSX is left untouched
    const sanitizeCode = (code, filename) => {
        let cleaned = code;
        if (filename.endsWith('.css')) {
            cleaned = cleaned.replace(/^@import\s+url\([^)]+\);?\s*$/gm, '');
            cleaned = cleaned.replace(/^@tailwind\s+\w+;?\s*$/gm, '');
        } else {
            cleaned = cleaned.replace(/^import\s+['"]https?:\/\/[^'"]+['"];?\s*$/gm, '');
        }
        return cleaned;
    };

    // Auto-detect npm packages used in the generated code
    const KNOWN_PACKAGES = {
        'react-router-dom': 'latest',
        'react-router': 'latest',
        'lucide-react': 'latest',
        'framer-motion': 'latest',
        'react-icons': 'latest',
        'axios': 'latest',
        '@headlessui/react': 'latest',
        'clsx': 'latest',
    };
    const allCode = Object.values(files).join('\n');
    const detectedDeps = {};
    for (const [pkg, version] of Object.entries(KNOWN_PACKAGES)) {
        if (allCode.includes(pkg)) {
            detectedDeps[pkg] = version;
        }
    }

    // Prepare files for Sandpack format
    // Sandpack's React template has a default /App.js that shows "Hello World".
    // We must map /App.jsx → /App.js to override it, otherwise both exist
    // and the template's index.js imports the default one.
    const sandpackFiles = {};
    for (const [name, code] of Object.entries(files)) {
        let key = name.startsWith('/') ? name : `/${name}`;
        // Sandpack resolves .jsx imports as .js — map ALL .jsx files to .js
        if (key.endsWith('.jsx')) key = key.replace(/\.jsx$/, '.js');
        sandpackFiles[key] = { code: sanitizeCode(code, key) };
    }

    // Ensure App.js exists for React template (all .jsx already mapped to .js above)
    if (template === 'react' && !sandpackFiles['/App.js']) {
        if (sandpackFiles['/index.js']) {
            sandpackFiles['/App.js'] = sandpackFiles['/index.js'];
            delete sandpackFiles['/index.js'];
        }
    }

    // Escape key exits fullscreen
    useEffect(() => {
        if (!expanded) return;
        const handler = (e) => { if (e.key === 'Escape') setExpanded(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [expanded]);

    // Close deploy menu on outside click
    useEffect(() => {
        if (!showDeployMenu) return;
        const handler = (e) => {
            if (deployMenuRef.current && !deployMenuRef.current.contains(e.target)) {
                setShowDeployMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showDeployMenu]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const handleCopyAll = async () => {
        try {
            const allCode = Object.entries(files)
                .map(([name, code]) => `// ── ${name} ──\n${code}`)
                .join('\n\n');
            await navigator.clipboard.writeText(allCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };

    const handleDownload = async () => {
        try {
            const zip = new JSZip();
            const scaffold = getScaffoldFiles(files, template);
            for (const [path, content] of Object.entries(scaffold)) {
                zip.file(path, content);
            }
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'atlas-project.zip';
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('ZIP download failed:', e);
        }
    };

    const handleDeploy = async (target) => {
        setShowDeployMenu(false);
        setDeployState('deploying');
        setDeployTarget(target);
        setDeployUrl(null);
        setDeployRepoUrl(null);
        setDeployError(null);
        const pollTarget = target === 'github-update' ? 'github' : target;

        try {
            const res = await fetch(`${API_URL}/deploy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    files,
                    template,
                    projectName: `atlas-${Date.now()}`,
                    target: target === 'github-update' ? 'github' : target,
                    sourceRepo: target === 'github-update' ? sourceRepo : undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setDeployState('error');
                setDeployError(data.error || 'Deployment failed');
                return;
            }

            setDeployState('polling');
            if (data.repoUrl) setDeployRepoUrl(data.repoUrl);

            // Poll for status
            let polls = 0;
            const maxPolls = 40; // 120 seconds
            pollRef.current = setInterval(async () => {
                polls++;
                try {
                    const statusRes = await fetch(
                        `${API_URL}/deploy/status?id=${encodeURIComponent(data.deploymentId)}&target=${pollTarget}`
                    );
                    const statusData = await statusRes.json();

                    if (statusData.status === 'READY') {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                        setDeployState('ready');
                        setDeployUrl(statusData.url);
                    } else if (statusData.status === 'ERROR') {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                        setDeployState('error');
                        setDeployError(statusData.error || 'Deployment failed');
                    } else if (polls >= maxPolls) {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                        // For GitHub, the site may still be building — show the URL anyway
                        if (pollTarget === 'github') {
                            setDeployState('ready');
                            setDeployUrl(statusData.url || data.url);
                        } else {
                            setDeployState('error');
                            setDeployError('Deployment timed out. Check Vercel dashboard.');
                        }
                    }
                } catch {
                    // Don't fail on individual poll errors
                }
            }, 3000);
        } catch (e) {
            setDeployState('error');
            setDeployError(e.message || 'Network error');
        }
    };

    const handleRetryDeploy = () => {
        if (deployTarget) handleDeploy(deployTarget);
    };

    const fileCount = Object.keys(files).length;
    const isDeploying = deployState === 'deploying' || deployState === 'polling';

    if (!hasFiles) return null;

    const fullscreenStyle = expanded ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        borderRadius: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
    } : undefined;

    return (
        <div className="sandpack-preview-container" style={fullscreenStyle}>
            {/* Header */}
            <div className="sandpack-header">
                <div className="sandpack-header-left">
                    <span className="sandpack-status-dot" />
                    <span className="sandpack-title">Live Preview</span>
                    <span className="sandpack-file-count">{fileCount} file{fileCount > 1 ? 's' : ''}</span>
                </div>
                <div className="sandpack-actions">
                    <button
                        className="sandpack-action-btn"
                        onClick={() => setActiveView(activeView === 'preview' ? 'code' : 'preview')}
                        title={activeView === 'preview' ? 'Show code' : 'Show preview'}
                    >
                        {activeView === 'preview' ? <Code size={14} /> : <Eye size={14} />}
                    </button>

                    {/* Responsive viewport toggles */}
                    <div className="sandpack-viewport-group">
                        {[
                            { w: '375px', icon: <Smartphone size={13} />, label: 'Mobile' },
                            { w: '768px', icon: <Tablet size={13} />, label: 'Tablet' },
                            { w: '100%', icon: <Monitor size={13} />, label: 'Desktop' },
                        ].map(v => (
                            <button
                                key={v.w}
                                className={`sandpack-action-btn ${viewportWidth === v.w ? 'active' : ''}`}
                                onClick={() => setViewportWidth(v.w)}
                                title={`${v.label} (${v.w})`}
                            >
                                {v.icon}
                            </button>
                        ))}
                    </div>

                    <button
                        className="sandpack-action-btn"
                        onClick={handleCopyAll}
                        title="Copy all code"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                        className="sandpack-action-btn"
                        onClick={handleDownload}
                        title="Download ZIP"
                    >
                        <Download size={14} />
                    </button>

                    {/* Deploy dropdown */}
                    <div style={{ position: 'relative' }} ref={deployMenuRef}>
                        <button
                            className="sandpack-action-btn"
                            onClick={() => setShowDeployMenu(!showDeployMenu)}
                            disabled={isDeploying}
                            title="Deploy"
                            style={{
                                opacity: isDeploying ? 0.5 : 1,
                                color: deployState === 'ready' ? 'var(--sandpack-success)' : undefined,
                            }}
                        >
                            <Rocket size={14} />
                        </button>

                        {showDeployMenu && (
                            <div className="deploy-menu">
                                <button
                                    className="deploy-menu-item"
                                    onClick={() => handleDeploy('vercel')}
                                >
                                    <span style={{ fontSize: '14px' }}>&#9652;</span>
                                    Deploy to Vercel
                                </button>
                                <button
                                    className="deploy-menu-item"
                                    onClick={() => handleDeploy('github')}
                                >
                                    <Github size={14} />
                                    Deploy to GitHub Pages
                                </button>
                                {sourceRepo && (
                                    <button
                                        className="deploy-menu-item"
                                        onClick={() => handleDeploy('github-update')}
                                        style={{ borderTop: '1px solid var(--sandpack-border)' }}
                                    >
                                        <RefreshCw size={14} />
                                        Update {sourceRepo.split('/').slice(-2).join('/')}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        className="sandpack-action-btn"
                        onClick={() => setExpanded(!expanded)}
                        title={expanded ? 'Exit fullscreen' : 'Fullscreen'}
                        style={expanded ? { color: 'var(--sandpack-accent)' } : undefined}
                    >
                        {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                </div>
            </div>

            {/* Deploy status bar */}
            {deployState !== 'idle' && (
                <div className={`sandpack-deploy-bar ${deployState === 'ready' ? 'ready' : deployState === 'error' ? 'error' : 'deploying'}`}>
                    {(deployState === 'deploying' || deployState === 'polling') && (
                        <>
                            <div className="deploy-spinner" />
                            <span>Deploying to {deployTarget === 'vercel' ? 'Vercel' : 'GitHub Pages'}...</span>
                        </>
                    )}
                    {deployState === 'ready' && (
                        <>
                            <Check size={14} />
                            <span>Live at</span>
                            <a href={deployUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                {deployUrl} <ExternalLink size={11} />
                            </a>
                            {deployRepoUrl && (
                                <a href={deployRepoUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '3px', opacity: 0.7 }}>
                                    <Github size={11} /> Repo
                                </a>
                            )}
                        </>
                    )}
                    {deployState === 'error' && (
                        <>
                            <span>{deployError || 'Deployment failed'}</span>
                            <button
                                onClick={handleRetryDeploy}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--sandpack-accent)', fontWeight: 600,
                                    fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '3px',
                                }}
                            >
                                <RefreshCw size={12} /> Retry
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Sandpack Renderer */}
            <div style={{
                height: expanded ? undefined : '500px',
                flex: expanded ? 1 : undefined,
                overflow: 'hidden',
                borderRadius: expanded ? 0 : '0 0 12px 12px',
                minHeight: 0,
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: viewportWidth !== '100%' ? '#e5e5e2' : undefined,
            }}>
            <div style={{
                width: viewportWidth,
                height: '100%',
                transition: 'width 0.3s ease',
                boxShadow: viewportWidth !== '100%' ? '0 0 20px rgba(0,0,0,0.1)' : 'none',
                backgroundColor: viewportWidth !== '100%' ? 'white' : undefined,
            }}>
                <Suspense fallback={
                    <div className="sandpack-loading">
                        <div className="sandpack-loading-spinner" />
                        <span>Loading preview engine...</span>
                    </div>
                }>
                    <SandpackLazy
                        template={template === 'vanilla' ? 'vanilla' : 'react'}
                        files={sandpackFiles}
                        theme="light"
                        customSetup={Object.keys(detectedDeps).length > 0 ? { dependencies: detectedDeps } : undefined}
                        options={{
                            externalResources: [
                                "https://cdn.jsdelivr.net/npm/daisyui@5/themes.css",
                                "https://cdn.jsdelivr.net/npm/daisyui@5/daisyui.css",
                                "https://cdn.tailwindcss.com",
                                "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700;800&display=swap",
                            ],
                            showNavigator: false,
                            showTabs: true,
                            showLineNumbers: true,
                            editorHeight: expanded ? window.innerHeight - 80 : 500,
                            activeFile: Object.keys(sandpackFiles)[0],
                            layout: activeView === 'code' ? 'console' : 'preview',
                        }}
                    />
                </Suspense>
            </div>
            {viewportWidth !== '100%' && (
                <div className="sandpack-viewport-label">{viewportWidth}</div>
            )}
            </div>
        </div>
    );
}
