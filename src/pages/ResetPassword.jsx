import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, RefreshCw } from 'lucide-react';
import '../styles/Login.css';

const ResetPassword = () => {
    const { uid, token } = useParams();
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            // 🟢 CHANGED PORT TO 8080
            const response = await axios.post(import.meta.env.VITE_API_URL + '/api/request-reset/', {
                new_password: newPassword
            });
            alert("Password reset successful! Please login with your new password.");
            navigate('/login');
        } catch (error) {
            setMessage(error.response?.data?.message || "Invalid or expired reset link.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card"> 
                <div className="login-header">
                    <div className="login-icon">
                        <RefreshCw size={32} />
                    </div>
                    <h1 className="login-title">Set New Password</h1>
                    <p className="login-subtitle">Choose a strong password to secure your account</p>
                </div>

                <form onSubmit={handleReset} className="login-form">
                    <div style={{ position: 'relative' }}>
                        <Lock size={20} style={{ position: 'absolute', top: 16, left: 16, color: '#9ca3af' }} />
                        <input
                            type="password"
                            placeholder="Enter New Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            className="login-input"
                            style={{ paddingLeft: '45px' }}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="login-btn" 
                        disabled={loading}
                        style={{ opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? 'Updating...' : 'Update Password'}
                    </button>
                </form>

                {message && (
                    <p style={{ 
                        textAlign: 'center', 
                        marginTop: '15px', 
                        color: '#ef4444', 
                        fontSize: '0.9rem' 
                    }}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;