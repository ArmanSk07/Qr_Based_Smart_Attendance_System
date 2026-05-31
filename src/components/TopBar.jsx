import React from 'react';
import { Search, ChevronLeft, ChevronRight, FileSpreadsheet, UserPlus, Trash2 } from 'lucide-react';

export default function TopBar({ 
  activeBranch, 
  searchQuery, setSearchQuery, 
  selectedDate, changeDate, setSelectedDate,
  onExport, onAddStudent, onDeleteBranch
}) {
  return (
    <div className="header">
      <div className="page-title">
        <h1>{activeBranch?.name}</h1>
        <p>Attendance Management</p>
      </div>
      
      <div className="header-controls">
        <div className="search-wrapper">
            <Search size={16} className="search-icon"/>
            <input 
              className="search-input" 
              placeholder="Search..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
        </div>

        <div className="date-nav">
            <button onClick={() => changeDate(-1)} className="btn-icon" style={{border:'none'}}>
              <ChevronLeft size={18}/>
            </button>
            <div className="date-input-wrapper">
               <input 
                 type="date" 
                 value={selectedDate} 
                 onChange={e => setSelectedDate(e.target.value)} 
                 className="date-input" 
               />
            </div>
            <button onClick={() => changeDate(1)} className="btn-icon" style={{border:'none'}}>
              <ChevronRight size={18}/>
            </button>
        </div>

        <button className="btn btn-success" onClick={onExport} title="Export CSV">
            <FileSpreadsheet size={18}/> <span className="btn-text">Report</span>
        </button>
        <button className="btn btn-primary" onClick={onAddStudent}>
            <UserPlus size={18}/> <span className="btn-text">Add</span>
        </button>
        
        {/* BUTTON ALWAYS VISIBLE NOW */}
        <button className="btn btn-danger" onClick={() => onDeleteBranch(activeBranch.id)}>
            <Trash2 size={18}/>
        </button>
      </div>
    </div>
  );
}