import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { QrCode, Lock, User, RefreshCw, Mail, ArrowLeft } from 'lucide-react';
import '../styles/Login.css';

export default function Login() {
  const { login, changePassword } = useApp();
  const navigate = useNavigate();
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (isLoginMode) {
        const success = await login(username, password);
        if (success) navigate('/dashboard');
    } else {
        const success = await changePassword(username, password, newPassword);
        if (success) {
            setIsLoginMode(true); 
            setPassword('');
            setNewPassword('');
        }
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <QrCode size={32} />
          </div>
          <h1 className="login-title">
            {isLoginMode ? 'Admin Portal' : 'Change Password'}
          </h1>
          <p className="login-subtitle">
            {isLoginMode ? 'Secure Attendance System' : 'Update your credentials'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div style={{position: 'relative'}}>
            <User size={20} style={{position:'absolute', top:16, left:16, color:'#9ca3af'}}/>
            <input 
              type="text" 
              placeholder="Username" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required
              className="login-input"
              style={{paddingLeft: '45px'}}
            />
          </div>
          
          <div style={{position: 'relative'}}>
            <Lock size={20} style={{position:'absolute', top:16, left:16, color:'#9ca3af'}}/>
            <input 
              type="password" 
              placeholder={isLoginMode ? "Password" : "Old Password"} 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
              className="login-input"
              style={{paddingLeft: '45px'}}
            />
          </div>

          {!isLoginMode && (
             <div style={{position: 'relative', animation: 'fadeIn 0.5s'}}>
                <RefreshCw size={20} style={{position:'absolute', top:16, left:16, color:'#9ca3af'}}/>
                <input 
                  type="password" 
                  placeholder="New Password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  required
                  className="login-input"
                  style={{paddingLeft: '45px'}}
                />
             </div>
          )}

          <button type="submit" className="login-btn" disabled={loading} style={{opacity: loading ? 0.7 : 1}}>
            {loading ? 'Processing...' : (isLoginMode ? 'Login Dashboard' : 'Update Password')}
          </button>
        </form>

        {/* 🟢 NEW UI: Professional Secondary Buttons */}
        <div className="login-footer-actions">
          {isLoginMode ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => navigate('/forgot-password')}>
                <Mail size={16} /> Forgot Password
              </button>
              <button type="button" className="btn-secondary" onClick={() => {
                  setIsLoginMode(false);
                  setPassword('');
              }}>
                <RefreshCw size={16} /> Change Password
              </button>
            </>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => {
                setIsLoginMode(true);
                setPassword('');
                setNewPassword('');
            }}>
              <ArrowLeft size={16} /> Back to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}