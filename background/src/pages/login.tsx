import React, { useState } from 'react';
import { FiUser, FiLock } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import './login.scss';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAccount(e.target.value);
        setError('');
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
        setError('');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!account.trim() || !password) {
            setError('请输入账号和密码');
            return;
        }

        setLoading(true);
        try {
            await login({
                username: account,
                password: password,
            });
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || '登录失败，请检查账号和密码');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                {/* 左侧插画区域 */}
                <div className="illustration-section">
                    <div className="illustration-content">
                        {/* 显示器 */}
                        <div className="monitor">
                            <div className="monitor-screen">
                                <div className="screen-content">
                                    <div className="screen-icon">
                                        <FiUser />
                                    </div>
                                    <div className="screen-field"></div>
                                    <div className="screen-field"></div>
                                </div>
                            </div>
                        </div>

                        {/* 左侧人物 */}
                        <div className="figure figure-left">
                            <div className="figure-head"></div>
                            <div className="figure-body figure-orange"></div>
                        </div>

                        {/* 右侧人物 */}
                        <div className="figure figure-right">
                            <div className="figure-head"></div>
                            <div className="figure-body figure-blue"></div>
                        </div>

                        {/* 钥匙 */}
                        <div className="key"></div>

                        {/* 锁 */}
                        <div className="lock"></div>

                        {/* 植物装饰 */}
                        <div className="plant plant-1"></div>
                        <div className="plant plant-2"></div>
                        <div className="plant plant-3"></div>
                    </div>
                </div>

                {/* 右侧登录表单区域 */}
                <div className="form-section">
                    <div className="form-content">
                        <h1 className="welcome-title">管理后台登录</h1>
                        <p className="welcome-text">
                            请使用您的账号和密码登录系统
                        </p>

                        <form onSubmit={handleLogin} className="login-form">
                            {/* 错误提示 */}
                            {error && (
                                <div className="error-message" style={{ 
                                    color: '#ef4444', 
                                    marginBottom: '16px', 
                                    fontSize: '14px',
                                    textAlign: 'center'
                                }}>
                                    {error}
                                </div>
                            )}

                            {/* 账号输入框 */}
                            <div className="form-group">
                                <label className="form-label">账号</label>
                                <div className="input-wrapper email-wrapper">
                                    <FiUser className="input-icon email-icon" />
                                    <input
                                        type="text"
                                        className="form-input email-input"
                                        placeholder="请输入账号"
                                        value={account}
                                        onChange={handleAccountChange}
                                        disabled={loading}
                                        autoComplete="username"
                                    />
                                </div>
                            </div>

                            {/* 密码输入框 */}
                            <div className="form-group">
                                <label className="form-label">密码</label>
                                <div className="input-wrapper password-wrapper">
                                    <FiLock className="input-icon lock-icon-input" />
                                    <input
                                        type="password"
                                        className="form-input password-input"
                                        placeholder="请输入密码"
                                        value={password}
                                        onChange={handlePasswordChange}
                                        disabled={loading}
                                        autoComplete="current-password"
                                    />
                                </div>
                            </div>

                            {/* 登录按钮 */}
                            <div className="form-actions">
                                <button type="submit" className="btn btn-login" disabled={loading || !account.trim() || !password}>
                                    {loading ? '登录中...' : '登录'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
