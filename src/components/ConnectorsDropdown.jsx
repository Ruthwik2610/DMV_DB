import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Server, Box, Link as LinkIcon, Terminal, Trash2, Edit2, X, Check, RefreshCw, AlertCircle } from 'lucide-react';

export default function ConnectorsDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [connectType, setConnectType] = useState('link'); // default to Link since BQ uses HTTP
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editUrl, setEditUrl] = useState('');
    const [addError, setAddError] = useState('');

    const [newConnectorName, setNewConnectorName] = useState('');
    const [newConnectorCommand, setNewConnectorCommand] = useState('');
    const [newConnectorArgs, setNewConnectorArgs] = useState('');
    const [newConnectorUrl, setNewConnectorUrl] = useState('');

    const [connectors, setConnectors] = useState([]);
    const [autoReconnecting, setAutoReconnecting] = useState(false);
    const API_URL = import.meta.env.VITE_API_URL || '/api';

    // ---------------------------------------------------------------
    // localStorage helpers – persist connector URLs across reloads
    // ---------------------------------------------------------------
    const STORAGE_KEY = 'llmatscale_saved_connectors';

    const getSavedConnectors = () => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch { return []; }
    };

    const saveConnectorToStorage = (name, url) => {
        const saved = getSavedConnectors();
        // Avoid duplicates by URL
        if (!saved.some(s => s.url === url)) {
            saved.push({ name, url });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        }
    };

    const removeConnectorFromStorage = (urlOrName) => {
        const saved = getSavedConnectors().filter(
            s => s.url !== urlOrName && s.name !== urlOrName
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    };

    const updateConnectorInStorage = (oldName, newName, newUrl) => {
        const saved = getSavedConnectors();
        const entry = saved.find(s => s.name === oldName);
        if (entry) {
            if (newName) entry.name = newName;
            if (newUrl) entry.url = newUrl;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        }
    };

    const fetchConnectors = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/connectors`);
            const data = await res.json();
            setConnectors(data);
        } catch (e) {
            console.error('Failed to fetch connectors:', e);
        }
    }, [API_URL]);

    // Auto-reconnect saved connectors on mount (handles Vercel cold starts & reloads)
    const autoReconnectSavedConnectors = async () => {
        const saved = getSavedConnectors();
        if (saved.length === 0) return;

        setAutoReconnecting(true);
        try {
            // Check which connectors are already active
            const res = await fetch(`${API_URL}/connectors`);
            const active = await res.json();
            const activeNames = active.map(c => c.name);

            for (const s of saved) {
                // Skip if already connected (by name match)
                if (activeNames.includes(s.name) || activeNames.includes(s.url)) continue;

                try {
                    console.log(`[AutoReconnect] Reconnecting to ${s.name || s.url}…`);
                    await fetch(`${API_URL}/connectors`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: s.name, url: s.url }),
                    });
                } catch (e) {
                    console.warn(`[AutoReconnect] Failed to reconnect ${s.name}:`, e.message);
                }
            }
        } catch (e) {
            console.warn('[AutoReconnect] Could not check active connectors:', e.message);
        } finally {
            setAutoReconnecting(false);
            fetchConnectors();
        }
    };

    useEffect(() => {
        autoReconnectSavedConnectors();
        const interval = setInterval(fetchConnectors, 5000);
        return () => clearInterval(interval);
    }, [fetchConnectors]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to remove this connector?')) {
            // Find the connector to remove from localStorage by name
            const toRemove = connectors.find(c => c.id === id);
            if (toRemove) removeConnectorFromStorage(toRemove.name);

            await fetch(`${API_URL}/connectors/${id}`, { method: 'DELETE' });
            await fetchConnectors();
        }
    };

    const handleEditSave = async (id) => {
        if (!editName.trim()) return;
        try {
            // Update localStorage so it survives reloads
            const connector = connectors.find(c => c.id === id);
            const urlChanged = editUrl.trim() && editUrl.trim() !== (connector?.url || '');
            if (connector) updateConnectorInStorage(connector.name, editName.trim(), urlChanged ? editUrl.trim() : null);

            const body = { name: editName };
            if (urlChanged) body.url = editUrl.trim();

            await fetch(`${API_URL}/connectors/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            setEditingId(null);
            setEditUrl('');
            await fetchConnectors();
        } catch (e) {
            console.error('Edit failed', e);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchConnectors();
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    const handleAddConnector = async (e) => {
        e.preventDefault();
        setAddError('');
        setIsConnecting(true);

        const payload = { name: newConnectorName.trim() };

        if (connectType === 'stdio') {
            if (!newConnectorCommand.trim()) {
                setAddError('Command is required.');
                setIsConnecting(false);
                return;
            }
            payload.command = newConnectorCommand;
            payload.args = newConnectorArgs ? newConnectorArgs.split(',').map(s => s.trim()) : [];
        } else {
            if (!newConnectorUrl.trim()) {
                setAddError('URL is required.');
                setIsConnecting(false);
                return;
            }
            payload.url = newConnectorUrl;
        }

        try {
            const resp = await fetch(`${API_URL}/connectors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const respData = await resp.json();

            // BUG FIX: Old code did NOT return on error — the form would close
            // even when the connection failed, hiding the problem from the user.
            if (!resp.ok) {
                setAddError(respData.error || 'Failed to connect. Check the server console.');
                setIsConnecting(false);
                return; // ← CRITICAL: stop here, don't close the form
            }

            // Save to localStorage for persistence across reloads
            if (connectType === 'link' && newConnectorUrl.trim()) {
                saveConnectorToStorage(
                    newConnectorName.trim() || newConnectorUrl.trim(),
                    newConnectorUrl.trim()
                );
            }

            // Only reset form on actual success
            setNewConnectorName('');
            setNewConnectorCommand('');
            setNewConnectorArgs('');
            setNewConnectorUrl('');
            setAddError('');
            setIsAddingMode(false);
            await fetchConnectors();
        } catch (e) {
            setAddError(`Network error: ${e.message}`);
        } finally {
            setIsConnecting(false);
        }
    };

    const activeCount = connectors.filter(c => c.status === 'connected').length;

    // Map status → dot color and label
    const statusConfig = {
        connected: { color: 'var(--success)', label: 'Connected' },
        connecting: { color: '#f59e0b', label: 'Connecting…' },
        error: { color: 'var(--error)', label: 'Connection Error' },
    };

    return (
        <div className="dropdown-container" ref={dropdownRef}>
            <button
                className="btn btn-secondary flex items-center gap-2"
                onClick={() => setIsOpen(!isOpen)}
                style={{ fontSize: '0.875rem', backgroundColor: 'white' }}
            >
                <Server size={16} style={{ color: 'var(--accent)' }} />
                <span>Connectors ({activeCount})</span>
                <ChevronDown
                    size={14}
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                />
            </button>

            {isOpen && (
                <div className="dropdown-menu">
                    <div className="dropdown-header">
                        <div className="flex items-center gap-2">
                            <span>MCP Servers</span>
                            <button
                                onClick={handleRefresh}
                                title="Refresh"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--accent)',
                                    padding: '2px',
                                    display: 'flex',
                                    transform: isRefreshing ? 'rotate(360deg)' : 'none',
                                    transition: isRefreshing ? 'transform 0.5s' : 'none',
                                }}
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                        {!isAddingMode && (
                            <button
                                className="btn btn-ghost btn-small flex items-center gap-2"
                                onClick={() => { setIsAddingMode(true); setAddError(''); }}
                            >
                                <Box size={14} /> Add New
                            </button>
                        )}
                    </div>

                    {isAddingMode && (
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                            {/* Type selector */}
                            <div className="flex gap-2" style={{ marginBottom: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setConnectType('link')}
                                    className={`btn flex-1 flex items-center justify-center gap-2 ${connectType === 'link' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                                >
                                    <LinkIcon size={14} /> Link (HTTP)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConnectType('stdio')}
                                    className={`btn flex-1 flex items-center justify-center gap-2 ${connectType === 'stdio' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ padding: '0.4rem', fontSize: '0.8rem' }}
                                >
                                    <Terminal size={14} /> Command
                                </button>
                            </div>

                            <form onSubmit={handleAddConnector} className="flex flex-col gap-2">
                                <input
                                    autoFocus
                                    type="text"
                                    value={newConnectorName}
                                    onChange={e => setNewConnectorName(e.target.value)}
                                    placeholder="Server Name (e.g. BigQuery)"
                                    className="input"
                                    style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                                />

                                {connectType === 'stdio' ? (
                                    <>
                                        <input
                                            required
                                            type="text"
                                            value={newConnectorCommand}
                                            onChange={e => setNewConnectorCommand(e.target.value)}
                                            placeholder="Command (e.g. node, python3)"
                                            className="input"
                                            style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                                        />
                                        <input
                                            type="text"
                                            value={newConnectorArgs}
                                            onChange={e => setNewConnectorArgs(e.target.value)}
                                            placeholder="Args (server.js, --port 80)"
                                            className="input"
                                            style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                                        />
                                    </>
                                ) : (
                                    <input
                                        required
                                        type="text"
                                        value={newConnectorUrl}
                                        onChange={e => setNewConnectorUrl(e.target.value)}
                                        placeholder="URL e.g. http://localhost:8000/mcp"
                                        className="input"
                                        style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                                    />
                                )}

                                {/* BUG FIX: Show the actual error message in the UI */}
                                {addError && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '0.4rem',
                                        color: 'var(--error)',
                                        fontSize: '0.8rem',
                                        padding: '0.5rem',
                                        background: 'rgba(239,68,68,0.08)',
                                        borderRadius: '6px',
                                    }}>
                                        <AlertCircle size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
                                        {addError}
                                    </div>
                                )}

                                <div className="flex justify-between" style={{ marginTop: '0.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setIsAddingMode(false); setAddError(''); }}
                                        className="btn btn-ghost btn-small"
                                        disabled={isConnecting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-small"
                                        disabled={isConnecting}
                                    >
                                        {isConnecting ? 'Connecting…' : 'Connect Server'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        {autoReconnecting && (
                            <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--accent)' }}>
                                Reconnecting saved servers…
                            </div>
                        )}
                        {connectors.length === 0 && !isAddingMode && !autoReconnecting && (
                            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                No servers connected.
                            </div>
                        )}

                        {connectors.map(connector => {
                            const sc = statusConfig[connector.status] || statusConfig.error;
                            return (
                                <div key={connector.id} className="connector-item">
                                    <div className="connector-info" style={{ flex: 1 }}>
                                        {editingId === connector.id ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    placeholder="Display name"
                                                    className="input p-1 text-xs"
                                                    style={{ fontSize: '0.8rem' }}
                                                />
                                                <input
                                                    type="text"
                                                    value={editUrl}
                                                    onChange={e => setEditUrl(e.target.value)}
                                                    placeholder="MCP URL (leave empty to keep current)"
                                                    className="input p-1 text-xs"
                                                    style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                                                    onKeyDown={e => e.key === 'Enter' && handleEditSave(connector.id)}
                                                />
                                                <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                                    <button onClick={() => handleEditSave(connector.id)} className="text-success" title="Save"><Check size={14} /></button>
                                                    <button onClick={() => { setEditingId(null); setEditUrl(''); }} className="text-secondary" title="Cancel"><X size={14} /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="connector-name">{connector.name}</span>
                                                <button
                                                    onClick={() => { setEditingId(connector.id); setEditName(connector.name); setEditUrl(''); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                            </div>
                                        )}

                                        {/* BUG FIX: Status dot now correctly reflects the actual status color */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                                            <span style={{
                                                width: '7px',
                                                height: '7px',
                                                borderRadius: '50%',
                                                backgroundColor: sc.color,
                                                display: 'inline-block',
                                                flexShrink: 0,
                                            }} />
                                            <span style={{ fontSize: '0.75rem', color: sc.color }}>{sc.label}</span>
                                        </div>

                                        {connector.status === 'connected' && connector.tools?.length > 0 && (
                                            <div className="connector-tools" style={{ marginTop: '4px' }}>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                                    {connector.tools.length} tool{connector.tools.length !== 1 ? 's' : ''}:
                                                </div>
                                                {connector.tools.map((tool, i) => {
                                                    const name = typeof tool === 'string' ? tool : tool.name;
                                                    const desc = typeof tool === 'object' ? tool.description : '';
                                                    return (
                                                        <div key={i} style={{ fontSize: '0.7rem', lineHeight: '1.4', padding: '1px 0' }} title={desc}>
                                                            <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{name}</span>
                                                            {desc && <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>— {desc.length > 60 ? desc.slice(0, 60) + '…' : desc}</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleDelete(connector.id)}
                                        className="btn btn-ghost btn-small"
                                        title="Remove connector"
                                        style={{ color: '#ef4444' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}