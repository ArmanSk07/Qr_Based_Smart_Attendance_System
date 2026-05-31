import React from 'react';
import { QRCodeCanvas } from 'qrcode.react'; // npm install qrcode.react
import html2canvas from 'html2canvas';       // npm install html2canvas
import { Download, X } from 'lucide-react';
import { API_URL } from '../../context/AppContext'; // 🟢 CHANGE 1: Added Import

// --- 1. ADD STUDENT MODAL ---
export const AddStudentModal = ({ form, setForm, onSubmit, onCancel }) => (
  <div className="overlay">
    <form onSubmit={onSubmit} className="modal">
      <h2 style={{marginTop:0}}>Add Student</h2>
      
      <div className="modal-form-group">
          <label className="modal-label">Full Name</label>
          <input 
            required 
            className="modal-input" 
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})} 
            placeholder="Enter full name"
          />
      </div>

      <div className="modal-form-group">
          <label className="modal-label">Roll Number</label>
          <input 
            required 
            className="modal-input" 
            value={form.rollNo} 
            onChange={e => setForm({...form, rollNo: e.target.value})} 
            placeholder="e.g. 101"
          />
      </div>

      <div className="modal-form-group">
          <label className="modal-label">Parent Phone (+91...)</label>
          <input 
            required 
            className="modal-input" 
            placeholder="+919876543210" 
            value={form.phone} 
            onChange={e => setForm({...form, phone: e.target.value})} 
          />
      </div>

      <div className="modal-form-group">
          <label className="modal-label">Photo (Optional)</label>
          <input 
            type="file" 
            id="photoInput" 
            accept="image/*" 
            className="modal-input" 
          />
      </div>

      <div className="modal-actions">
        <button type="button" onClick={onCancel} className="btn btn-cancel">Cancel</button>
        <button type="submit" className="btn btn-primary btn-submit">Create Student</button>
      </div>
    </form>
  </div>
);

// --- 2. ADD BRANCH MODAL ---
export const AddBranchModal = ({ name, setName, onSubmit, onCancel }) => (
  <div className="overlay">
    <form onSubmit={onSubmit} className="modal">
      <h2 style={{marginTop:0}}>New Branch</h2>
      
      <div className="modal-form-group">
        <label className="modal-label">Branch Name</label>
        <input 
          autoFocus 
          required 
          className="modal-input" 
          placeholder="e.g. Computer Science" 
          value={name} 
          onChange={e => setName(e.target.value)} 
        />
      </div>

      <div className="modal-actions">
        <button type="button" onClick={onCancel} className="btn btn-cancel">Cancel</button>
        <button type="submit" className="btn btn-primary btn-submit">Create Branch</button>
      </div>
    </form>
  </div>
);

// --- 3. ID CARD MODAL (Rectangular, CSS Class-Based) ---
export const IDCardModal = ({ student, branchName, onClose }) => {
  const securePayload = `SECURE_APP_VER1:${student.id}`;

  // 🟢 CHANGE 2: Added Helper Function to fix Corrupted URLs
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "";
    
    // Fix for the specific error you saw (double URLs)
    if (imagePath.includes("/http")) {
        return imagePath.substring(imagePath.indexOf("http"));
    }

    if (imagePath.startsWith("http")) return imagePath;
    
    // Dynamic Base URL
    const BASE_URL = API_URL.replace("/api", ""); 
    return `${BASE_URL}${imagePath}`;
  };

  const downloadCard = async () => {
    const cardElement = document.getElementById("IDCardToPrint");
    if (!cardElement) return;

    try {
      const canvas = await html2canvas(cardElement, {
        scale: 3, 
        backgroundColor: null,
        useCORS: true, // 🟢 CRITICAL: Allows saving external images
        allowTaint: true,
      });
      const image = canvas.toDataURL("image/png", 1.0);
      const link = document.createElement("a");
      link.href = image;
      link.download = `${student.name.replace(/\s+/g, '_')}_ID_Card.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to generate ID card image", error);
      alert("Error generating ID Card image");
    }
  };

  return (
    <div className="overlay" onClick={onClose} style={{zIndex: 10000}}>
        <div 
          className="modal" 
          style={{ background: 'transparent', boxShadow: 'none', padding: 0, border: 'none' }} 
          onClick={e => e.stopPropagation()}
        >
            
            <div className="id-card-wrapper">
                
                <div id="IDCardToPrint" className="id-card-container">
                    
                    <div className="id-card-header">
                        <h2 className="id-card-title">
                          {branchName || 'COLLEGE ID'}
                        </h2>
                        <span className="id-card-subtitle">
                          OFFICIAL STUDENT CARD
                        </span>
                    </div>

                    <div className="id-card-body">
                        
                        <div className="id-card-photo-wrapper">
                            {student.photoDataUrl ? (
                              <img 
                                // 🟢 CHANGE 3: Used Helper Function & Added CrossOrigin
                                src={getImageUrl(student.photoDataUrl)} 
                                alt="Profile" 
                                className="id-card-photo" 
                                crossOrigin="anonymous" 
                              />
                            ) : (
                              <div className="id-card-initials">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                        </div>

                        <div className="id-card-text-group">
                            <div className="id-card-name">
                              {student.name}
                            </div>
                            <div className="id-card-roll">
                              ROLL NO: {student.rollNo}
                            </div>
                        </div>

                        <div className="id-card-qr-box">
                            <QRCodeCanvas 
                              value={securePayload} 
                              size={130} 
                              level="H" 
                              fgColor="#000000"
                              bgColor="#ffffff"
                            />
                        </div>
                    </div>

                    <div className="id-card-footer">
                        ACADEMIC YEAR 2024-2025 • NON-TRANSFERABLE
                    </div>
                </div>

                <div className="id-card-actions">
                    <button 
                      onClick={downloadCard} 
                      className="btn btn-primary" 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Download size={18}/> Download HD
                    </button>
                    <button 
                      onClick={onClose} 
                      className="btn btn-close" 
                      style={{ display: 'flex', alignItems: 'center', gap:'8px' }}
                    >
                        <X size={18}/> Close
                    </button>
                </div>
            </div>

        </div>
    </div>
  );
};