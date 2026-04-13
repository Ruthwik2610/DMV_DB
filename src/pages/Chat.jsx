import { useState, useRef, useEffect, useCallback } from 'react';
import ConnectorsDropdown from '../components/ConnectorsDropdown';
import ChatInput from '../components/ChatInput';
import MessageRenderer from '../components/MessageRenderer';
import {
    MessageSquarePlus, LogOut, ShieldCheck,
    Trash2, ChevronDown, Copy, Check, RefreshCw, Square,
    PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WELCOME_MESSAGE = {
    id: 1,
    role: 'assistant',
    content: "Hello! I'm your AI-powered assistant by LLM at Scale.AI. I can help you:\n\n- **Query databases** — BigQuery, Salesforce, or any connected data source\n- **Build websites** — Generate React + Tailwind sites from a text prompt or Figma design\n- **Deploy** — One-click deploy to Vercel or GitHub Pages\n- **Create MCP servers** — Auto-generate connectors for any database or API\n- **Import & edit** — Pull code from GitHub, edit, and redeploy\n\nConnect a data source via **Connectors**, or just ask me to build something!",
    timestamp: Date.now(),
};

// ─── Tiny helpers ────────────────────────────────────────────────────────────
function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };
    return (
        <button
            onClick={handleCopy}
            title="Copy message"
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: copied ? 'var(--success)' : 'var(--text-muted)',
                padding: '2px 4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                transition: 'color 0.2s',
                marginTop: '0.5rem',
            }}
        >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
}

function TypingIndicator() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}>
            {[0, 1, 2].map(i => (
                <span key={i} style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--text-muted)',
                    display: 'inline-block',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
            ))}
            <style>{`
                @keyframes bounce {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30% { transform: translateY(-5px); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

// ─── Thinking status — cycles through what the AI is doing ───────────────────
const THINKING_STEPS = [
    'Understanding your request...',
    'Analyzing context...',
    'Generating response...',
    'Processing with AI...',
];

function ThinkingStatus() {
    const [stepIdx, setStepIdx] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setStepIdx(prev => (prev + 1) % THINKING_STEPS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
                width: '12px', height: '12px', borderRadius: '50%',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ transition: 'opacity 0.3s', fontSize: '0.82rem' }}>
                {THINKING_STEPS[stepIdx]}
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ─── Empty state shown for brand-new threads (no messages yet) ───────────────
function EmptyState() {
    const capabilities = [
        { title: 'Build Websites', desc: 'Generate React + Tailwind sites from a text prompt, then preview and deploy' },
        { title: 'Figma to Code', desc: 'Paste a Figma URL to convert designs into working React components' },
        { title: 'Query Databases', desc: 'Connect BigQuery, Salesforce, or any MCP data source and query in plain English' },
        { title: 'Create MCP Servers', desc: 'Auto-generate MCP servers for PostgreSQL, REST APIs, or any data source' },
        { title: 'Deploy Anywhere', desc: 'One-click deploy to Vercel or GitHub Pages, or update an existing repo' },
        { title: 'Import & Edit', desc: 'Pull code from any GitHub repo, make changes via chat, and redeploy' },
        { title: 'Image to UI', desc: 'Upload a screenshot or mockup and LLM at Scale.AI will build matching code' },
        { title: 'Connect Services', desc: 'Add MCP connectors for BigQuery, Salesforce, Figma, and more' },
    ];

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2.5rem 1.5rem',
            gap: '1.5rem',
            overflowY: 'auto',
        }}>
            <div style={{ textAlign: 'center' }}>
                <img
                    src="/llmatscale-logo-circle.png"
                    alt="LLM at Scale.AI"
                    width="72"
                    height="72"
                    style={{ borderRadius: '50%', objectFit: 'contain', margin: '0 auto 0.75rem' }}
                />
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    What can LLM at Scale.AI do?
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px' }}>
                    Type a message below to get started, or explore what's possible.
                </p>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.6rem',
                maxWidth: '560px',
                width: '100%',
            }}>
                {capabilities.map((cap, i) => (
                    <div
                        key={i}
                        style={{
                            padding: '0.75rem 0.85rem',
                            borderRadius: '10px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--bg-secondary)',
                            display: 'flex',
                            gap: '0.6rem',
                            alignItems: 'flex-start',
                        }}
                    >
                        <div style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            backgroundColor: 'var(--accent)', flexShrink: 0, marginTop: '6px',
                        }} />
                        <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                                {cap.title}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                {cap.desc}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main Chat component ─────────────────────────────────────────────────────
export default function Chat() {
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);

    const THREADS_KEY = 'llmatscale_chat_threads';
    const loadSavedThreads = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(THREADS_KEY));
            if (saved && saved.length > 0) return saved;
        } catch { /* ignore */ }
        return [{ id: Date.now(), title: 'New Session', messages: [WELCOME_MESSAGE] }];
    };

    const [threads, setThreads] = useState(loadSavedThreads);
    const [activeThreadId, setActiveThreadId] = useState(() => {
        const saved = loadSavedThreads();
        return saved[0]?.id || Date.now();
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [failedMessageId, setFailedMessageId] = useState(null);
    const abortRef = useRef(null);
    const [lastUserPayload, setLastUserPayload] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Save threads to localStorage — strip large data (base64 previews) to avoid quota
    useEffect(() => {
        try {
            const stripped = threads.map(t => ({
                ...t,
                messages: t.messages.map(m => {
                    if (m.attachmentPreviews?.length > 0) {
                        const { attachmentPreviews, ...rest } = m;
                        return rest;
                    }
                    return m;
                }),
            }));
            localStorage.setItem(THREADS_KEY, JSON.stringify(stripped));
        } catch {
            // Quota exceeded — trim older threads and retry
            try {
                const trimmed = threads.slice(0, 10).map(t => ({
                    ...t,
                    messages: t.messages.slice(-50).map(m => {
                        const { attachmentPreviews, ...rest } = m;
                        return rest;
                    }),
                }));
                localStorage.setItem(THREADS_KEY, JSON.stringify(trimmed));
            } catch { /* truly full */ }
        }
    }, [threads]);

    const activeThread = threads.find(t => t.id === activeThreadId) || threads[0];
    const activeThreadRef = useRef(activeThread);
    activeThreadRef.current = activeThread;

    // Scroll to bottom
    const scrollToBottom = useCallback((behavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [activeThread.messages, isLoading, scrollToBottom]);

    // Show/hide scroll-to-bottom button
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const onScroll = () => {
            const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            setShowScrollBtn(distFromBottom > 200);
        };
        container.addEventListener('scroll', onScroll, { passive: true });
        return () => container.removeEventListener('scroll', onScroll);
    }, []);

    // Core send logic, extracted so retry can reuse it
    const sendMessage = useCallback(async ({ text, attachments }) => {
        if (!text?.trim() && !attachments?.length) return;

        const thread = activeThreadRef.current;
        const now = Date.now();

        // Build file names list for display
        const fileNames = attachments?.map(a => a.name) || [];

        const userMessage = {
            id: now,
            role: 'user',
            content: text || '(image attached)',
            displayContent: text || '(image attached)',
            files: fileNames.length > 0 ? fileNames : undefined,
            attachmentPreviews: attachments?.filter(a => a.preview).map(a => a.preview) || [],
            timestamp: now,
        };

        const previousMessages = thread.messages;
        const isFirstUserMessage = previousMessages.filter(m => m.role === 'user').length === 0;
        const newTitle = isFirstUserMessage && text
            ? text.slice(0, 40) + (text.length > 40 ? '…' : '')
            : thread.title;

        setLastUserPayload({ text, attachments });
        setFailedMessageId(null);

        setThreads(prev => prev.map(t =>
            t.id === activeThreadId
                ? { ...t, title: newTitle, messages: [...t.messages, userMessage] }
                : t
        ));
        setIsLoading(true);

        try {
            const API_URL = import.meta.env.VITE_API_URL || '/api';
            const contextToSend = [...previousMessages, userMessage].map(m => ({
                role: m.role,
                content: m.content,
            }));

            // Include codeSnapshot for context compression on code-editing follow-ups
            const requestBody = { messages: contextToSend };
            if (thread.codeSnapshot && Object.keys(thread.codeSnapshot).length > 0) {
                requestBody.codeSnapshot = thread.codeSnapshot;
            }

            // Include image attachments for multimodal LLM
            if (attachments?.length > 0) {
                requestBody.images = attachments
                    .filter(a => a.type?.startsWith('image/'))
                    .map(a => {
                        if (a.serverUrl) {
                            // Server-hosted image (Cloud Run /tmp) — send URL, backend will fetch
                            return { url: a.serverUrl, mimeType: a.type };
                        }
                        // Fallback: base64 (Vercel or upload failed)
                        return { data: a.dataUrl.split(',')[1], mimeType: a.type };
                    });
            }

            const controller = new AbortController();
            abortRef.current = controller;

            const response = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const assistantMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: data.content || "I received a response but couldn't read it. Please try again.",
                timestamp: Date.now() + 1,
            };

            // Auto-save connector if MCP server was auto-deployed
            if (data.autoConnector?.url && data.autoConnector?.name) {
                try {
                    const saved = JSON.parse(localStorage.getItem('llmatscale_saved_connectors') || '[]');
                    if (!saved.some(c => c.url === data.autoConnector.url)) {
                        saved.push({ name: data.autoConnector.name, url: data.autoConnector.url });
                        localStorage.setItem('llmatscale_saved_connectors', JSON.stringify(saved));
                    }
                } catch { /* ignore localStorage errors */ }
            }

            setThreads(prev => prev.map(t =>
                t.id === activeThreadId
                    ? { ...t, messages: [...t.messages, assistantMessage] }
                    : t
            ));
        } catch (error) {
            // If user clicked stop, don't show error
            if (error.name === 'AbortError') {
                console.log('[Chat] Request aborted by user');
                return;
            }
            console.error('Chat error:', error);
            const errId = Date.now() + 2;
            setFailedMessageId(errId);
            setThreads(prev => prev.map(t =>
                t.id === activeThreadId
                    ? {
                        ...t,
                        messages: [...t.messages, {
                            id: errId,
                            role: 'assistant',
                            content: "I'm having trouble connecting to the backend. Please make sure the server is running and try again.",
                            isError: true,
                            timestamp: Date.now() + 2,
                        }],
                    }
                    : t
            ));
        } finally {
            abortRef.current = null;
            setIsLoading(false);
        }
    }, [activeThreadId]);

    const handleSendMessage = (payload) => sendMessage(payload);

    const handleStop = () => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setIsLoading(false);
    };

    const handleRetry = () => {
        if (!lastUserPayload) return;
        // Remove the last error message before retrying
        setThreads(prev => prev.map(t =>
            t.id === activeThreadId
                ? { ...t, messages: t.messages.filter(m => m.id !== failedMessageId) }
                : t
        ));
        setFailedMessageId(null);
        sendMessage(lastUserPayload);
    };

    // Quick prompt removed — EmptyState now shows capabilities list

    // Store parsed code files in thread state for context preservation
    const handleCodeParsed = useCallback((files, template, sourceMessage) => {
        if (!files) return;
        // Extract GitHub repo URL if this came from an import
        let sourceRepo = undefined;
        if (sourceMessage) {
            const repoMatch = sourceMessage.match(/\[([^\]]+)\]\((https:\/\/github\.com\/[^)]+)\)/);
            if (repoMatch) sourceRepo = repoMatch[2];
        }
        setThreads(prev => prev.map(t => {
            if (t.id !== activeThreadId) return t;
            return {
                ...t,
                codeSnapshot: {
                    ...files,
                    _template: template,
                    _sourceRepo: sourceRepo || t.codeSnapshot?._sourceRepo,
                    _updatedAt: Date.now(),
                },
            };
        }));
    }, [activeThreadId]);

    const handleNewChat = () => {
        const newThread = {
            id: Date.now(),
            title: 'New Session',
            messages: [{ ...WELCOME_MESSAGE, id: Date.now() }],
        };
        setThreads(prev => [newThread, ...prev]);
        setActiveThreadId(newThread.id);
        setFailedMessageId(null);
    };

    const handleDeleteThread = (threadId, e) => {
        e.stopPropagation();
        setThreads(prev => {
            const filtered = prev.filter(t => t.id !== threadId);
            if (filtered.length === 0) {
                const fresh = { id: Date.now(), title: 'New Session', messages: [{ ...WELCOME_MESSAGE, id: Date.now() }] };
                setActiveThreadId(fresh.id);
                return [fresh];
            }
            if (threadId === activeThreadId) {
                setActiveThreadId(filtered[0].id);
            }
            return filtered;
        });
    };

    // Only show quick prompts on a truly fresh thread (just welcome msg)
    const showEmptyState = activeThread.messages.length === 1 &&
        activeThread.messages[0].role === 'assistant';

    return (
        <div className="chat-layout">
            {/* ── Sidebar ── */}
            <div className={`sidebar${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
                <div className="sidebar-header">
                    <div className="flex items-center gap-2" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src="/llmatscale-logo-circle.png" alt="LLM at Scale.AI" width="42" height="42" style={{ borderRadius: '50%', objectFit: 'contain' }} />
                        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            LLM at Scale<span style={{ color: 'var(--accent)' }}>.AI</span>
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-2">
                    <button className="new-chat-btn" onClick={handleNewChat}>
                        <span>New Conversation</span>
                        <MessageSquarePlus size={18} />
                    </button>

                    <div style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginBottom: '0.5rem',
                        marginTop: '1.5rem',
                    }}>
                        Recent
                    </div>

                    <div className="flex flex-col gap-1">
                        {threads.map(thread => (
                            <div
                                key={thread.id}
                                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                            >
                                <button
                                    onClick={() => setActiveThreadId(thread.id)}
                                    style={{
                                        flex: 1,
                                        textAlign: 'left',
                                        padding: '0.5rem 2rem 0.5rem 0.75rem',
                                        fontSize: '0.875rem',
                                        fontWeight: thread.id === activeThreadId ? 600 : 400,
                                        backgroundColor: thread.id === activeThreadId ? 'var(--bg-primary)' : 'transparent',
                                        border: thread.id === activeThreadId ? '1px solid var(--border)' : '1px solid transparent',
                                        borderRadius: 'var(--radius-md)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        color: thread.id === activeThreadId ? 'var(--accent)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        background: thread.id === activeThreadId ? 'var(--bg-primary)' : 'transparent',
                                        width: '100%',
                                    }}
                                >
                                    {thread.title}
                                </button>
                                {/* Delete button — only shows on hover via CSS trick */}
                                <button
                                    onClick={(e) => handleDeleteThread(thread.id, e)}
                                    title="Delete conversation"
                                    style={{
                                        position: 'absolute',
                                        right: '6px',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        padding: '3px',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        opacity: thread.id === activeThreadId ? 1 : 0,
                                        transition: 'opacity 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.opacity = '1'; }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.color = 'var(--text-muted)';
                                        e.currentTarget.style.opacity = thread.id === activeThreadId ? '1' : '0';
                                    }}
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                        className="btn btn-ghost w-full justify-start gap-2"
                        style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                        onClick={() => { sessionStorage.removeItem('llmatscale_logged_in'); navigate('/login'); }}
                    >
                        <LogOut size={16} /> Log out
                    </button>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="main-content">
                <div className="chat-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                        <button
                            onClick={() => setSidebarOpen(prev => !prev)}
                            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                padding: '4px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                flexShrink: 0,
                            }}
                        >
                            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>
                        <span style={{
                            fontWeight: 600,
                            fontSize: '1rem',
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '400px',
                        }}>
                            {activeThread.title}
                        </span>
                    </div>
                    <ConnectorsDropdown />
                </div>

                {/* Messages or empty state */}
                {showEmptyState ? (
                    <EmptyState />
                ) : (
                    <div
                        ref={messagesContainerRef}
                        className="messages-container"
                        style={{ position: 'relative' }}
                    >
                        {activeThread.messages.map((msg) => (
                            <div key={msg.id} className="message">
                                <div className={`message-avatar ${msg.role}`}>
                                    {msg.role === 'assistant'
                                        ? <ShieldCheck size={18} />
                                        : <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>U</span>
                                    }
                                </div>
                                <div className="message-content">
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.6rem',
                                        marginBottom: '0.4rem',
                                    }}>
                                        <span style={{
                                            fontSize: '0.875rem',
                                            color: 'var(--text-secondary)',
                                            fontWeight: 600,
                                        }}>
                                            {msg.role === 'assistant' ? 'LLM at Scale.AI' : 'You'}
                                        </span>
                                        {msg.timestamp && (
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                {formatTime(msg.timestamp)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Error banner */}
                                    {msg.isError && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem 0.75rem',
                                            backgroundColor: 'rgba(239,68,68,0.08)',
                                            border: '1px solid rgba(239,68,68,0.2)',
                                            borderRadius: '8px',
                                            marginBottom: '0.5rem',
                                        }}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--error)' }}>
                                                Connection error.
                                            </span>
                                            <button
                                                onClick={handleRetry}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '3px',
                                                    fontSize: '0.8rem', color: 'var(--accent)',
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                <RefreshCw size={12} /> Retry
                                            </button>
                                        </div>
                                    )}

                                    {/* Image previews in user messages */}
                                    {msg.attachmentPreviews?.length > 0 && (
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                            {msg.attachmentPreviews.map((src, i) => (
                                                <img
                                                    key={i}
                                                    src={src}
                                                    alt="Attached"
                                                    style={{
                                                        maxWidth: '200px',
                                                        maxHeight: '150px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border)',
                                                        objectFit: 'cover',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    <MessageRenderer
                                        content={msg.role === 'assistant' ? msg.content : (msg.displayContent || msg.content)}
                                        role={msg.role}
                                        onCodeParsed={msg.role === 'assistant' ? handleCodeParsed : undefined}
                                        sourceRepo={activeThread.codeSnapshot?._sourceRepo}
                                    />

                                    {/* File chips */}
                                    {msg.files && msg.files.length > 0 && (
                                        <div style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {msg.files.map((file, i) => (
                                                <span key={i} style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                    backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
                                                    padding: '0.2rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)',
                                                }}>
                                                    📎 {file}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Copy button on assistant messages */}
                                    {msg.role === 'assistant' && !msg.isError && (
                                        <CopyButton text={msg.displayContent || msg.content} />
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="message">
                                <div className="message-avatar assistant">
                                    <ShieldCheck size={18} />
                                </div>
                                <div className="message-content">
                                    <div style={{
                                        fontSize: '0.82rem', color: 'var(--text-secondary)',
                                        fontWeight: 500, marginBottom: '0.5rem',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    }}>
                                        <ThinkingStatus />
                                        <button
                                            onClick={handleStop}
                                            title="Stop generating"
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                padding: '2px 8px', borderRadius: '4px',
                                                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                                cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                                                color: 'var(--text-secondary)', transition: 'all 0.15s',
                                                marginLeft: 'auto',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--error)'; e.currentTarget.style.color = 'var(--error)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                        >
                                            <Square size={10} fill="currentColor" /> Stop
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}

                {/* Scroll-to-bottom floating button */}
                {showScrollBtn && (
                    <button
                        onClick={() => scrollToBottom()}
                        style={{
                            position: 'absolute',
                            bottom: '130px',
                            right: '2rem',
                            width: '36px', height: '36px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-md)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            zIndex: 20,
                            transition: 'box-shadow 0.2s',
                        }}
                        title="Scroll to bottom"
                    >
                        <ChevronDown size={18} />
                    </button>
                )}

                <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
            </div>
        </div>
    );
}