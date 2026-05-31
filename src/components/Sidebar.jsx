import React from 'react';
import { QrCode, Plus, Save, Upload, Moon, Sun, LogOut, Bell, X } from 'lucide-react';

export default function Sidebar({ 
  branches = [], 
  activeBranch, 
  sidebarOpen, 
  closeSidebar, 
  onSelectBranch, 
  onAddBranch, 
  onBackup, 
  onRestore, 
  onSendAlerts,
  onOpenScanner, // 🟢 NEW PROP
  theme, 
  toggleTheme, 
  logout, 
  navigate 
}) {

  // Safe wrapper for mobile clicks
  const handleMobileClick = (action) => {
    if (action) action();
    if (window.innerWidth <= 768 && closeSidebar) {
      closeSidebar();
    }
  };

  return (
    <>
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} 
        onClick={closeSidebar}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-area"><QrCode size={28} /> QR Admin</div>
          <button type="button" className="btn-icon mobile-close-btn" onClick={closeSidebar}>
            <X size={24} />
          </button>
        </div>
        
        <div className="nav-section">
          {/* 🟢 FIXED: Calls onOpenScanner prop instead of navigating */}
          <button 
            type="button"
            className="btn-scanner-launch" 
            onClick={(e) => { e.preventDefault(); handleMobileClick(onOpenScanner); }}
          >
             <QrCode size={22} /> OPEN SCANNER
          </button>
          
          <div className="nav-label">Branches</div>
          {branches.map(branch => (
            <button 
              key={branch.id} 
              type="button" 
              className={`nav-item ${activeBranch?.id === branch.id ? 'active' : ''}`} 
              onClick={(e) => { e.preventDefault(); handleMobileClick(() => onSelectBranch(branch.id)); }}
            >
              {branch.name}
            </button>
          ))}
          
          <button 
            type="button" 
            onClick={(e) => { e.preventDefault(); handleMobileClick(onAddBranch); }} 
            className="nav-item" 
            style={{color:'var(--primary)'}}
          >
            <Plus size={16}/> Add Branch
          </button>
          
          <div className="sidebar-system">
            <div className="nav-label">System</div>
            
            <button type="button" onClick={(e) => { e.preventDefault(); handleMobileClick(onSendAlerts); }} className="nav-item" style={{color:'#ef4444'}}>
              <Bell size={18}/> Send Alerts
            </button>

            <button type="button" onClick={(e) => { e.preventDefault(); handleMobileClick(onBackup); }} className="nav-item btn-backup">
              <Save size={18}/> Backup Data
            </button>
            
            <label className="nav-item btn-restore">
                <Upload size={18}/> Restore Data
                <input type="file" accept=".json" onChange={onRestore} className="hidden-input" />
            </label>
          </div>
        </div>

        <div className="sidebar-footer">
           <button type="button" onClick={(e) => { e.preventDefault(); toggleTheme(); }} className="nav-item">
             {theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>} 
             {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
           </button>
           <button type="button" onClick={(e) => { e.preventDefault(); logout(); }} className="nav-item" style={{color:'var(--danger)'}}>
             <LogOut size={18}/> Logout
           </button>
        </div>
      </aside>
    </>
  );
}