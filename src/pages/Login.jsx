import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LLMAtScaleLogo = ({ size = 140 }) => (
    <img src="/llmatscale-logo-circle.png" alt="LLM at Scale.AI" width={size} height={size} style={{ borderRadius: '50%', objectFit: 'contain' }} />
);

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        if (username === 'admin' && password === 'admin') {
            sessionStorage.setItem('llmatscale_logged_in', 'true');
            navigate('/chat');
        } else {
            setError('Sign in failed. Username or password is incorrect.');
        }
    };

    return (
        <div className="login-split">
            {/* Left side — background image with blue translucent overlay */}
            <div className="login-left">
                <div className="login-left-overlay" />
                <div className="login-left-content">
                    <LLMAtScaleLogo size={140} />
                    <p style={{
                        marginTop: '1.5rem',
                        fontSize: '1.05rem',
                        opacity: 0.85,
                        textAlign: 'center',
                        maxWidth: '380px',
                        lineHeight: 1.7,
                        color: 'white',
                    }}>
                        Build websites, query databases, convert Figma designs, and deploy — all from a single conversation.
                    </p>

                </div>
            </div>

            {/* Right side — login form */}
            <div className="login-right">
                <div className="login-box">
                    <div className="login-header">
                        <h2>Welcome Back</h2>
                        <p>Sign in to your account</p>
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                type="text"
                                className="input"
                                placeholder="Enter username"
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                                autoComplete="username"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full"
                            style={{ marginTop: '1rem', padding: '0.875rem', fontSize: '1rem', fontWeight: 600 }}
                        >
                            Sign In
                        </button>
                    </form>

                    <p style={{
                        textAlign: 'center',
                        marginTop: '1.5rem',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                    }}>
                        LLM at Scale.AI · AI Platform
                    </p>
                </div>
            </div>
        </div>
    );
}
