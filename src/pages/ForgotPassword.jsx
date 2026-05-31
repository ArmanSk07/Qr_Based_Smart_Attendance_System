import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import emailjs from '@emailjs/browser';
import { Mail, ArrowLeft } from 'lucide-react';
import '../styles/Login.css';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(''); 

        try {
            // 1. Ask Django to generate the token and link
            const response = await axios.post('http://127.0.0.1:8080/api/request-reset/', { 
                identifier: identifier.trim() 
            });
            
            const { reset_link, user_email } = response.data;

            // 2. Send the email using EmailJS with your exact credentials
            const templateParams = {
                to_email: user_email,
                reset_link: reset_link,
            };

            await emailjs.send(
                'service_y4r49gf',     // Your Service ID
                'template_qkkkr0c',    // Your Template ID
                templateParams,
                'yrQmznPEVsn3CPCjq'    // Your Public Key
            );

            setMessage("Success! A reset link has been sent to your registered email.");
        } catch (error) {
            setMessage(error.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon"><Mail size={32} /></div>
                    <h1 className="login-title">Reset Password</h1>
                    <p className="login-subtitle">Enter your Username or Email</p>
                </div>
                
                <form onSubmit={handleSubmit} className="login-form">
                    <div style={{position: 'relative'}}>
                        <Mail size={20} style={{position:'absolute', top:16, left:16, color:'#9ca3af'}}/>
                        <input 
                            type="text" 
                            placeholder="Username or Email" 
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required 
                            className="login-input"
                            style={{paddingLeft: '45px'}}
                        />
                    </div>
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>

                {message && (
                    <p style={{
                        textAlign: 'center', 
                        marginTop: '15px', 
                        fontSize: '0.9rem',
                        color: message.toLowerCase().includes('success') ? '#10b981' : '#ef4444'
                    }}>
                        {message}
                    </p>
                )}

                <div className="login-footer-actions">
                    <button type="button" className="btn-secondary" onClick={() => navigate('/login')}>
                        <ArrowLeft size={16} /> Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;