import React, { useState } from 'react';
import SandpackPreview from './SandpackPreview';
import { Copy, Check } from 'lucide-react';

// ── File block parser ────────────────────────────────────────────────────────
// Extracts <file name="...">code</file> blocks from LLM output
// More forgiving regex — handles whitespace, newlines, and single/double quotes
const FILE_BLOCK_REGEX = /<file\s+name=["']([^"']+)["']>\s*([\s\S]*?)\s*<\/file>/g;
const TEMPLATE_REGEX = /<template>(react|vanilla)<\/template>/i;

// ── Markdown code fence fallback parser ──────────────────────────────────────
// Detects ```lang \n // filename.ext \n code \n ``` blocks when <file> tags are missing.
// Handles: ```jsx\n// App.jsx\n...``` and ```jsx\n// components/Navbar.jsx\n...```
const FENCED_BLOCK_REGEX = /```[\w]*\s*\n\s*\/\/\s*([^\n]+\.(?:jsx?|tsx?|css|html|json))\s*\n([\s\S]*?)```/g;

// ── Generic fenced code block extractor ─────────────────────────────────────
// Extracts ALL ```lang\ncode\n``` blocks (not just file-comment ones)
const GENERIC_FENCE_REGEX = /```([\w-]*)\s*\n([\s\S]*?)```/g;

function extractCodeFences(content) {
    const blocks = [];
    let match;
    const regex = new RegExp(GENERIC_FENCE_REGEX.source, 'g');
    while ((match = regex.exec(content)) !== null) {
        blocks.push({ lang: match[1] || 'text', code: match[2].trimEnd() });
    }
    const remaining = content.replace(new RegExp(GENERIC_FENCE_REGEX.source, 'g'), '').trim();
    return { codeBlocks: blocks, textWithoutFences: remaining };
}

function parseMarkdownFences(content) {
    const files = {};
    let match;

    // First pass: fences with explicit filename comments (// App.jsx)
    const regex = new RegExp(FENCED_BLOCK_REGEX.source, 'g');
    while ((match = regex.exec(content)) !== null) {
        let filename = match[1].trim();
        const code = match[2].trim();
        filename = filename.replace(/^\/\/\s*/, '').replace(/^─+\s*/, '').trim();
        if (!filename) continue;
        const key = filename.startsWith('/') ? filename : `/${filename}`;
        files[key] = code;
    }

    // Second pass: if no files found yet, try to infer filenames from language + content
    // This catches ```jsx\nimport React...\ncode``` without a filename comment
    if (Object.keys(files).length === 0) {
        const allFences = /```([\w-]*)\s*\n([\s\S]*?)```/g;
        const LANG_TO_EXT = { jsx: '.jsx', tsx: '.tsx', javascript: '.js', js: '.js', css: '.css', html: '.html', json: '.json' };
        const FRONTEND_LANGS = ['jsx', 'tsx', 'javascript', 'js', 'css', 'html'];
        let fenceIdx = 0;
        let fenceMatch;
        const fenceBlocks = [];

        while ((fenceMatch = allFences.exec(content)) !== null) {
            fenceBlocks.push({ lang: fenceMatch[1] || '', code: fenceMatch[2].trim() });
        }

        // Only convert to Sandpack files if at least one block looks like frontend code
        const hasFrontend = fenceBlocks.some(b => FRONTEND_LANGS.includes(b.lang) || /\bimport\b.*\breact\b/i.test(b.code) || /\bexport\s+default\b/.test(b.code));
        if (hasFrontend && fenceBlocks.length > 0) {
            for (const block of fenceBlocks) {
                const ext = LANG_TO_EXT[block.lang] || '.js';
                // Try to detect filename from first-line import or export
                let filename;
                if (fenceIdx === 0 && (ext === '.jsx' || ext === '.js' || ext === '.tsx')) {
                    filename = `/App${ext}`;
                } else if (ext === '.css') {
                    filename = '/styles.css';
                } else {
                    filename = `/Component${fenceIdx}${ext}`;
                }
                files[filename] = block.code;
                fenceIdx++;
            }
        }
    }

    let remainingText = content.replace(new RegExp(FENCED_BLOCK_REGEX.source, 'g'), '').trim();
    remainingText = remainingText.replace(/```[\w]*\s*[\s\S]*?```/g, '').trim();

    return { files: Object.keys(files).length > 0 ? files : null, remainingText };
}

// ── Detect server-only files (no browser preview needed) ────────────────────
const FRONTEND_EXTS = ['.jsx', '.tsx', '.html', '.css', '.vue', '.svelte'];
function isServerOnlyFiles(files) {
    if (!files) return false;
    return Object.keys(files).every(name => !FRONTEND_EXTS.some(ext => name.endsWith(ext)));
}

function parseCodeBlocks(content) {
    const files = {};
    let match;
    const regex = new RegExp(FILE_BLOCK_REGEX.source, 'g');

    while ((match = regex.exec(content)) !== null) {
        const filename = match[1];
        const code = match[2].trim();
        const key = filename.startsWith('/') ? filename : `/${filename}`;
        files[key] = code;
    }

    // Handle truncated file blocks (LLM hit token limit before closing </file>)
    // Match <file name="...">code without a closing tag at the end of content
    const truncatedRegex = /<file\s+name=["']([^"']+)["']>\s*([\s\S]+)$/;
    const stripped = content.replace(new RegExp(FILE_BLOCK_REGEX.source, 'g'), '');
    const truncMatch = truncatedRegex.exec(stripped);
    if (truncMatch) {
        const filename = truncMatch[1];
        const code = truncMatch[2].trim();
        const key = filename.startsWith('/') ? filename : `/${filename}`;
        files[key] = code;
    }

    // Detect template type
    const templateMatch = TEMPLATE_REGEX.exec(content);
    const template = templateMatch ? templateMatch[1] : 'react';

    // Strip file blocks (complete and truncated) and template tag
    let remainingText = content
        .replace(new RegExp(FILE_BLOCK_REGEX.source, 'g'), '')
        .replace(TEMPLATE_REGEX, '');
    // Also strip truncated file blocks
    remainingText = remainingText.replace(/<file\s+name=["'][^"']+["']>[\s\S]*$/, '').trim();

    // If no <file> tags found, try markdown code fences as fallback
    if (Object.keys(files).length === 0) {
        const fenced = parseMarkdownFences(content);
        if (fenced.files) {
            return {
                files: fenced.files,
                template,
                remainingText: fenced.remainingText,
            };
        }
    }

    return {
        files: Object.keys(files).length > 0 ? files : null,
        template,
        remainingText,
    };
}

/**
 * MessageRenderer
 * Renders assistant/user messages as clean, conversational prose.
 * Supports: bold (**text**), bullet lists (- item), numbered lists (1. item),
 * paragraph breaks, tables, and embedded Sandpack code previews.
 */
export default function MessageRenderer({ content, role, onCodeParsed, sourceRepo }) {
    // Memoize parsing so we don't create new object refs every render
    const parsed = React.useMemo(() => parseCodeBlocks(content || ''), [content]);
    const { files, template, remainingText } = parsed;

    // Notify parent of parsed code (for codeSnapshot tracking)
    React.useEffect(() => {
        if (files && onCodeParsed) {
            onCodeParsed(files, template, content);
        }
    }, [files, onCodeParsed, template, content]);

    if (!content) return null;

    // Extract generic fenced code blocks from remaining text
    const { codeBlocks, textWithoutFences } = extractCodeFences(remainingText);

    // Keep inline backticks as-is (rendered as <code> in InlineText)
    const sanitised = textWithoutFences.trim();

    const lines = sanitised.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Skip blank lines but add paragraph spacing
        if (line.trim() === '') {
            i++;
            continue;
        }

        // Numbered list block
        if (/^\d+\.\s/.test(line.trim())) {
            const listItems = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                listItems.push(lines[i].trim().replace(/^\d+\.\s/, ''));
                i++;
            }
            elements.push(
                <ol key={`ol-${i}`} style={{
                    paddingLeft: '1.5rem',
                    margin: '0.5rem 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem'
                }}>
                    {listItems.map((item, idx) => (
                        <li key={idx} style={{ lineHeight: '1.6' }}>
                            <InlineText text={item} />
                        </li>
                    ))}
                </ol>
            );
            continue;
        }

        // Bullet list block (-, •, *)
        if (/^[-•*]\s/.test(line.trim())) {
            const listItems = [];
            while (i < lines.length && /^[-•*]\s/.test(lines[i].trim())) {
                listItems.push(lines[i].trim().replace(/^[-•*]\s/, ''));
                i++;
            }
            elements.push(
                <ul key={`ul-${i}`} style={{
                    paddingLeft: '1.25rem',
                    margin: '0.5rem 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                    listStyleType: 'disc'
                }}>
                    {listItems.map((item, idx) => (
                        <li key={idx} style={{ lineHeight: '1.6', color: 'var(--text-primary)' }}>
                            <InlineText text={item} />
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        // Table-like lines (contains multiple | separators)
        if (line.includes('|') && (line.match(/\|/g) || []).length >= 2) {
            const tableLines = [];
            while (i < lines.length && lines[i].includes('|')) {
                if (!/^[\s|:-]+$/.test(lines[i])) { // skip separator rows like |---|---|
                    tableLines.push(lines[i]);
                }
                i++;
            }

            if (tableLines.length > 0) {
                const rows = tableLines.map(l =>
                    l.split('|').map(cell => cell.trim()).filter(Boolean)
                );
                const headers = rows[0];
                const bodyRows = rows.slice(1);

                elements.push(
                    <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '0.75rem 0' }}>
                        <table style={{
                            borderCollapse: 'collapse',
                            width: '100%',
                            fontSize: '0.9rem'
                        }}>
                            <thead>
                                <tr>
                                    {headers.map((h, idx) => (
                                        <th key={idx} style={{
                                            padding: '0.5rem 0.75rem',
                                            textAlign: 'left',
                                            borderBottom: '2px solid var(--border)',
                                            fontWeight: '600',
                                            color: 'var(--text-secondary)',
                                            whiteSpace: 'nowrap',
                                            backgroundColor: 'var(--bg-secondary)'
                                        }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {bodyRows.map((row, rIdx) => (
                                    <tr key={rIdx} style={{
                                        borderBottom: '1px solid var(--border)',
                                        backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'
                                    }}>
                                        {row.map((cell, cIdx) => (
                                            <td key={cIdx} style={{
                                                padding: '0.5rem 0.75rem',
                                                color: 'var(--text-primary)'
                                            }}>
                                                <InlineText text={cell} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            continue;
        }

        // Regular paragraph line
        elements.push(
            <p key={`p-${i}`} style={{
                margin: '0.35rem 0',
                lineHeight: '1.7',
                color: 'var(--text-primary)'
            }}>
                <InlineText text={line} />
            </p>
        );
        i++;
    }

    const serverOnly = isServerOnlyFiles(files);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {elements}
            {codeBlocks.length > 0 && codeBlocks.map((block, idx) => (
                <CodeBlock key={`cb-${idx}`} lang={block.lang} code={block.code} />
            ))}
            {files && serverOnly && (
                <ServerCodeView files={files} />
            )}
            {files && !serverOnly && (
                <SandpackPreview files={files} template={template} sourceRepo={sourceRepo} />
            )}
        </div>
    );
}

/**
 * Renders inline text with **bold**, *italic*, and `code` support.
 */
function InlineText({ text }) {
    if (!text) return null;

    const parts = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`\n]+`)/g;
    let last = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > last) {
            parts.push({ type: 'text', value: text.slice(last, match.index) });
        }
        const raw = match[0];
        if (raw.startsWith('**')) {
            parts.push({ type: 'bold', value: raw.slice(2, -2) });
        } else if (raw.startsWith('`')) {
            parts.push({ type: 'code', value: raw.slice(1, -1) });
        } else {
            parts.push({ type: 'italic', value: raw.slice(1, -1) });
        }
        last = match.index + raw.length;
    }

    if (last < text.length) {
        parts.push({ type: 'text', value: text.slice(last) });
    }

    if (parts.length === 0) return <>{text}</>;

    return (
        <>
            {parts.map((part, idx) => {
                if (part.type === 'bold') return <strong key={idx}>{part.value}</strong>;
                if (part.type === 'italic') return <em key={idx}>{part.value}</em>;
                if (part.type === 'code') return (
                    <code key={idx} style={{
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '0.15em 0.4em',
                        borderRadius: '4px',
                        fontSize: '0.88em',
                        fontFamily: 'monospace',
                        border: '1px solid var(--border)',
                    }}>{part.value}</code>
                );
                return <span key={idx}>{part.value}</span>;
            })}
        </>
    );
}

/**
 * Renders a fenced code block with language label and copy button.
 */
function CodeBlock({ lang, code }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            margin: '0.5rem 0',
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.4rem 0.75rem',
                backgroundColor: '#1e1e1e',
                color: '#a0a0a0',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
            }}>
                <span>{lang}</span>
                <button
                    onClick={handleCopy}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#a0a0a0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                    }}
                >
                    {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
            </div>
            <pre style={{
                margin: 0,
                padding: '1rem',
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                overflowX: 'auto',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            }}>
                <code>{code}</code>
            </pre>
        </div>
    );
}

/**
 * Renders server-side code files (MCP servers, etc.) as styled code blocks
 * with filename tabs instead of a browser preview.
 */
function ServerCodeView({ files }) {
    const [activeFile, setActiveFile] = useState(Object.keys(files)[0]);
    const [copied, setCopied] = useState(false);
    const filenames = Object.keys(files);

    const handleCopy = () => {
        navigator.clipboard.writeText(files[activeFile]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getExtLang = (name) => {
        if (name.endsWith('.py')) return 'python';
        if (name.endsWith('.ts')) return 'typescript';
        if (name.endsWith('.js')) return 'javascript';
        if (name.endsWith('.json')) return 'json';
        if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'yaml';
        if (name.endsWith('.toml')) return 'toml';
        if (name.endsWith('.md')) return 'markdown';
        return 'text';
    };

    return (
        <div style={{
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            margin: '0.75rem 0',
        }}>
            {/* File tabs */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                backgroundColor: '#252526',
                borderBottom: '1px solid #3c3c3c',
                overflowX: 'auto',
            }}>
                {filenames.map(name => (
                    <button
                        key={name}
                        onClick={() => { setActiveFile(name); setCopied(false); }}
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.78rem',
                            fontFamily: 'monospace',
                            background: name === activeFile ? '#1e1e1e' : 'transparent',
                            color: name === activeFile ? '#d4d4d4' : '#808080',
                            border: 'none',
                            borderBottom: name === activeFile ? '2px solid var(--accent)' : '2px solid transparent',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {name.replace(/^\//, '')}
                    </button>
                ))}
                <div style={{ flex: 1 }} />
                <button
                    onClick={handleCopy}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#a0a0a0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                        padding: '0.5rem 0.75rem',
                    }}
                >
                    {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
            </div>
            {/* Code */}
            <pre style={{
                margin: 0,
                padding: '1rem',
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                overflowX: 'auto',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                maxHeight: '500px',
                overflowY: 'auto',
            }}>
                <code>{files[activeFile]}</code>
            </pre>
        </div>
    );
}
