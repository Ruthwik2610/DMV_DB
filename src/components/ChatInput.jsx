import { useState, useRef } from 'react';
import { ArrowUp, Paperclip, X } from 'lucide-react';

export default function ChatInput({ onSendMessage, disabled = false }) {
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState([]); // { name, type, dataUrl, preview }
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    const handleInput = (e) => {
        setMessage(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = '56px';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
                alert(`File "${file.name}" is too large (max 10MB)`);
                continue;
            }

            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1];

                // Try uploading to /api/upload (works on Cloud Run with /tmp)
                let serverUrl = null;
                try {
                    const API_URL = import.meta.env.VITE_API_URL || '/api';
                    const uploadRes = await fetch(`${API_URL}/upload`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: base64, mimeType: file.type, filename: file.name }),
                    });
                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        serverUrl = uploadData.url;
                    }
                } catch { /* fallback to base64 */ }

                setAttachments(prev => [...prev, {
                    name: file.name,
                    type: file.type,
                    dataUrl: serverUrl || dataUrl,
                    serverUrl,
                    preview: file.type.startsWith('image/') ? (serverUrl || dataUrl) : null,
                }]);
            };
            reader.readAsDataURL(file);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = () => {
        if (disabled) return;
        if (message.trim() || attachments.length > 0) {
            onSendMessage({
                text: message,
                attachments: attachments.length > 0 ? attachments : undefined,
            });
            setMessage('');
            setAttachments([]);
            if (textareaRef.current) {
                textareaRef.current.style.height = '56px';
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                const reader = new FileReader();
                reader.onload = async () => {
                    const dataUrl = reader.result;
                    const base64 = dataUrl.split(',')[1];
                    let serverUrl = null;
                    try {
                        const API_URL = import.meta.env.VITE_API_URL || '/api';
                        const uploadRes = await fetch(`${API_URL}/upload`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ image: base64, mimeType: file.type, filename: `pasted-image.${file.type.split('/')[1]}` }),
                        });
                        if (uploadRes.ok) {
                            const uploadData = await uploadRes.json();
                            serverUrl = uploadData.url;
                        }
                    } catch { /* fallback to base64 */ }

                    setAttachments(prev => [...prev, {
                        name: `pasted-image.${file.type.split('/')[1]}`,
                        type: file.type,
                        dataUrl: serverUrl || dataUrl,
                        serverUrl,
                        preview: reader.result,
                    }]);
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const canSend = !disabled && (message.trim().length > 0 || attachments.length > 0);

    return (
        <div className="input-area">
            <div className="input-container" style={{
                opacity: disabled ? 0.7 : 1,
                transition: 'opacity 0.2s'
            }}>
                {/* Attachment previews */}
                {attachments.length > 0 && (
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        padding: '0.75rem 1rem 0',
                        flexWrap: 'wrap',
                    }}>
                        {attachments.map((att, i) => (
                            <div key={i} style={{
                                position: 'relative',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                overflow: 'hidden',
                                backgroundColor: 'var(--bg-primary)',
                            }}>
                                {att.preview ? (
                                    <img
                                        src={att.preview}
                                        alt={att.name}
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            objectFit: 'cover',
                                            display: 'block',
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.7rem',
                                        color: 'var(--text-secondary)',
                                        padding: '0.25rem',
                                        textAlign: 'center',
                                        wordBreak: 'break-all',
                                    }}>
                                        {att.name}
                                    </div>
                                )}
                                <button
                                    onClick={() => removeAttachment(i)}
                                    style={{
                                        position: 'absolute',
                                        top: '2px',
                                        right: '2px',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                        color: 'white',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                    }}
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <textarea
                    ref={textareaRef}
                    className="chat-textarea"
                    placeholder={disabled ? 'LLM at Scale.AI is thinking...' : 'Message LLM at Scale.AI...'}
                    value={message}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    rows={1}
                    disabled={disabled}
                    style={{ cursor: disabled ? 'not-allowed' : 'text' }}
                />

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />

                <div className="input-actions">
                    <button
                        className="action-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled}
                        title="Attach file"
                        style={{ opacity: disabled ? 0.5 : 1 }}
                    >
                        <Paperclip size={18} />
                    </button>
                    <button
                        className="action-btn send-btn"
                        disabled={!canSend}
                        onClick={handleSend}
                    >
                        <ArrowUp size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
