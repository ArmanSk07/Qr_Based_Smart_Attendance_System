import React, { useState, useEffect } from "react";
import ExcelJS from "exceljs";
import { useNavigate } from "react-router-dom";
import { useApp, API_URL } from "../context/AppContext";
import { Menu, Plus, Trash2, Edit2, AlertTriangle, FileText, CheckSquare, Square, Users } from "lucide-react";
import "../styles/Dashboard.css";

// 🟢 NEW IMPORT for API AND ALL LINKS SUPPORT FROM AppContext.jsx
import Scanner from "./Scanner";

import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import StudentCard from "../components/StudentCard";
import {
  AddStudentModal,
  AddBranchModal,
  IDCardModal,
} from "../components/modals/DashboardModals";

export default function Dashboard() {
  const {
    branches,
    subBranches,
    students,
    attendance,
    theme,
    addBranch,
    deleteBranch,
    addSubBranch,
    deleteSubBranch,
    addStudent,
    deleteStudent,
    markAttendance,
    logout,
    toggleTheme,
    sendAlerts,
    showToast,
    isSuperUser,
    userGroups,
    fetchData,
  } = useApp();

  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- LOCAL STATE ---
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [selectedSubBranchId, setSelectedSubBranchId] = useState(() => {
    const stored = localStorage.getItem("activeSubBranchId");
    return stored ? Number(stored) : null;
  });

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  
  // 🟢 FIX: Sync selected date to LocalStorage so Scanner knows about it
  useEffect(() => {
    localStorage.setItem("selectedDate", selectedDate);
  }, [selectedDate]);

  // 🟢 NEW STATE FOR SCANNER OVERLAY
  const [showScanner, setShowScanner] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // --- BULK SELECTION STATE ---
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // --- MODAL STATES ---
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showQRModal, setShowQRModal] = useState(null);

  // Custom Popup States
  const [confirmModal, setConfirmModal] = useState({ show: false, title: "", message: "", onConfirm: null, isDanger: true });
  const [promptModal, setPromptModal] = useState({ show: false, title: "", value: "", onConfirm: null });

  const [newStudentForm, setNewStudentForm] = useState({ name: "", rollNo: "", phone: "", photo: "" });
  const [newBranchName, setNewBranchName] = useState("");

  // Force Theme Sync
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Derived State
  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  // 🟢 PERMISSION CHECK: User can edit if SuperUser OR if their groups match "Branch: [Name]"
  const canEdit = isSuperUser || (activeBranch && userGroups.includes(`Branch: ${activeBranch.name}`));

  const handleSelectBranch = (branchId) => {
    setSelectedBranchId(branchId);
    setSelectedSubBranchId(null);
    localStorage.removeItem("activeSubBranchId");
  };

  const activeBranchSubBranches = subBranches.filter(
    (sb) => activeBranch && String(sb.branchId) === String(activeBranch.id)
  );

  // --- HELPER: Soft Refresh (NO RELOAD) ---
  const refreshData = async () => {
    if (fetchData) await fetchData();
  };

  // --- HELPER: Date Formatter ---
  const formatDate = (isoDate) => {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // --- HELPER: Check Current Month ---
  const isCurrentMonth = (isoDate) => {
    const target = new Date(isoDate);
    const today = new Date();
    return target.getMonth() === today.getMonth() && target.getFullYear() === today.getFullYear();
  };

  // --- ACTIONS ---

  // 1. ADD BRANCH
  const handleAddBranch = async (e) => {
    if (e) e.preventDefault(); // STOP PAGE REFRESH
    // Note: Usually only SuperUser adds branches, but we'll leave logic open if you want
    if (newBranchName.trim()) {
      await addBranch(newBranchName);
      setNewBranchName("");
      setShowAddBranch(false);
      await refreshData();
    }
  };

  // 2. LOGOUT
  const handleLogoutClick = () => {
    setConfirmModal({
      show: true,
      title: "Log Out?",
      message: "Are you sure you want to sign out?",
      onConfirm: () => {
        logout();
        navigate("/login");
        setConfirmModal({ ...confirmModal, show: false });
      }
    });
  };

  // 3. DELETE STUDENT — Confirm first, then 10s Undo Toast
  const handleDeleteStudentClick = (studentId) => {
    if (!canEdit) { showToast("Permission Denied: Read Only Mode", "error"); return; }
    const student = students.find((s) => String(s.id) === String(studentId));
    if (!student) return;
    setConfirmModal({
      show: true, isDanger: true,
      title: "Delete Student?",
      message: `"${student.name}" will be deleted. You can undo this for 10 seconds.`,
      onConfirm: () => {
        setConfirmModal(c => ({ ...c, show: false }));
        const result = deleteStudent(studentId, student.name, null, null);
        if (result === false) showToast("Permission Denied: Super Admin Only", "error");
      }
    });
  };

  // 3b. BULK DELETE STUDENTS
  const handleBulkDelete = () => {
    if (!canEdit) { showToast("Permission Denied: Read Only Mode", "error"); return; }
    if (selectedStudents.size === 0) return;
    const ids = Array.from(selectedStudents);
    const names = ids.map(id => students.find(s => String(s.id) === String(id))?.name).filter(Boolean);
    setConfirmModal({
      show: true, isDanger: true,
      title: `Delete ${ids.length} Student${ids.length > 1 ? 's' : ''}?`,
      message: `${names.join(", ")} will be deleted. You can undo for 10 seconds.`,
      onConfirm: () => {
        setConfirmModal(c => ({ ...c, show: false }));
        setSelectedStudents(new Set());
        setIsSelectMode(false);
        // Delete each — last one carries the undo toast (showUndoToast replaces any previous)
        ids.forEach(id => {
          const name = students.find(s => String(s.id) === String(id))?.name || "Student";
          deleteStudent(id, name, null, null);
        });
      }
    });
  };

  // 3c. TOGGLE STUDENT SELECTION
  const handleToggleSelect = (studentId) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  // 4. DELETE BRANCH — Confirm first, then 10s Undo Toast
  const handleDeleteBranchClick = () => {
    if (!activeBranch) return;
    setConfirmModal({
      show: true, isDanger: true,
      title: "Delete Branch?",
      message: `"${activeBranch.name}" and all its data will be deleted. You can undo for 10 seconds.`,
      onConfirm: () => {
        setConfirmModal(c => ({ ...c, show: false }));
        const result = deleteBranch(activeBranch.id, activeBranch.name, null, null);
        if (result === false) showToast("Permission Denied: Super Admin Only", "error");
        else setSelectedBranchId(null);
      }
    });
  };

  // 5. EDIT SUBJECT
  const handleEditSubBranchClick = (subId, currentName) => {
    if (!canEdit) { showToast("Permission Denied: Read Only Mode", "error"); return; }
    setPromptModal({
      show: true,
      title: "Rename Subject",
      value: currentName,
      onConfirm: (newName) => performEditSubBranch(subId, newName)
    });
  };

  const performEditSubBranch = async (subBranchId, newName) => {
    if (!newName || newName.trim() === "") return;
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(`${API_URL}/sub-branches/${subBranchId}/`, {
        method: "PATCH",
        headers: { "Authorization": `Token ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName })
      });
      if (response.ok) {
        showToast("Subject Renamed!", "success");
        setPromptModal({ ...promptModal, show: false });
        await refreshData();
      } else { showToast("Update Failed", "error"); }
    } catch { showToast("Connection Error", "error"); }
  };

  // 6. DELETE SUBJECT — Confirm first, then 10s Undo Toast
  const handleDeleteSubBranchClick = (subId) => {
    if (!canEdit) { showToast("Permission Denied: Read Only Mode", "error"); return; }
    const sub = activeBranchSubBranches.find((s) => s.id === subId);
    if (!sub) return;
    setConfirmModal({
      show: true, isDanger: true,
      title: "Delete Subject?",
      message: `"${sub.name}" and all its attendance data will be deleted. You can undo for 10 seconds.`,
      onConfirm: () => {
        setConfirmModal(c => ({ ...c, show: false }));
        const result = deleteSubBranch(subId, sub.name, null, null);
        if (result === false) showToast("Permission Denied: Super Admin Only", "error");
        else if (selectedSubBranchId === subId) {
          setSelectedSubBranchId(null);
          localStorage.removeItem("activeSubBranchId");
        }
      }
    });
  };

  // 7. ADD SUBJECT
  const handleAddSubjectClick = () => {
    // 🔒 Permission Check
    if (!canEdit) {
        showToast("Permission Denied: Read Only Mode", "error");
        return;
    }

    setPromptModal({
      show: true,
      title: "Add New Subject",
      value: "",
      onConfirm: async (name) => {
        if (!activeBranch) return;
        await addSubBranch(activeBranch.id, name.trim());
        setPromptModal({ ...promptModal, show: false });
        await refreshData();
      }
    });
  };

  // 8. CREATE STUDENT (🟢 UPDATED WITH VALIDATION)
  const handleCreateStudent = async (e) => {
    e.preventDefault(); // STOP PAGE REFRESH
    
    // 🔒 Permission Check
    if (!canEdit) {
        showToast("Permission Denied: Read Only Mode", "error");
        return;
    }
    
    if (!activeBranch) return;

    const phoneInput = newStudentForm.phone ? newStudentForm.phone.trim() : "";
    const cleanPhone = phoneInput.replace(/\s+|-/g, '').replace('+', '');
    let isValid = false;

    if (/^[6-9]\d{9}$/.test(cleanPhone)) {
        isValid = true;
    } 
    else if (/^91[6-9]\d{9}$/.test(cleanPhone)) {
        isValid = true;
    }

    if (!isValid) {
        showToast("❌ Invalid Phone: Must be a valid 10-digit Indian number.", "error");
        return; 
    }

    const file = document.getElementById("photoInput")?.files[0];
    await addStudent({
      name: newStudentForm.name,
      rollNo: newStudentForm.rollNo,
      phone: newStudentForm.phone,
      branchId: activeBranch.id,
      photoFile: file || null,
    });
    setShowAddStudent(false);
    setNewStudentForm({ name: "", rollNo: "", phone: "", photo: "" });
    await refreshData();
  };

  // 9. TOGGLE ATTENDANCE
  const toggleAttendance = (studentId) => {
    // 🔒 Permission Check
    if (!canEdit) {
        showToast("Permission Denied: Read Only Mode", "error");
        return;
    }

    if (!selectedSubBranchId) {
      showToast("Select a subject tab first", "info");
      return;
    }
    if (!isCurrentMonth(selectedDate)) {
      showToast("🚫 Attendance is locked for past/future months.", "error");
      return;
    }
    const isPresent = attendance.some(r => String(r.studentId) === String(studentId) && String(r.subBranchId) === String(selectedSubBranchId) && r.date === selectedDate);
    if (!isPresent) {
      markAttendance(studentId, selectedSubBranchId, selectedDate);
    } else {
      showToast("Already Marked", "info");
    }
  };

  // --- EXPORT & BACKUP FUNCTIONS ---

  // Helper: Count working days (Mon-Fri) in a given month up to a cutoff day
  const getWorkingDaysInMonth = (selectedIsoDate) => {
    const d = new Date(selectedIsoDate);
    const year = d.getFullYear();
    const month = d.getMonth();
    const now = new Date();
    const isThisMonth = month === now.getMonth() && year === now.getFullYear();
    const lastDay = isThisMonth ? now.getDate() : new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let day = 1; day <= lastDay; day++) {
      const weekday = new Date(year, month, day).getDay();
      if (weekday !== 0 && weekday !== 6) count++;
    }
    return count;
  };

  // ─── SHARED EXCEL STYLES ────────────────────────────────────────────────────
  const STYLE = {
    titleFill:  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3730A3' } }, // deep indigo
    headerFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }, // indigo-600
    rowEvenFill:{ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } }, // indigo-50
    rowOddFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }, // white
    safeFill:   { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, // green-100
    shortFill:  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }, // red-100
    centerAlign:{ horizontal: 'center', vertical: 'middle', wrapText: false },
    leftAlign:  { horizontal: 'left',   vertical: 'middle' },
    border: {
      top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
    },
  };

  /** Apply style to every cell in a row */
  const styleRow = (row, fill, fontOpts = {}, align = STYLE.centerAlign) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill      = fill;
      cell.alignment = align;
      cell.border    = STYLE.border;
      cell.font      = { name: 'Calibri', size: 11, color: { argb: 'FF111827' }, ...fontOpts };
    });
  };

  /** Add a merged info row (spans all cols), returns the row */
  const addInfoRow = (sheet, colCount, text, fontOpts = {}) => {
    const rowIdx = sheet.rowCount + 1;
    const row    = sheet.getRow(rowIdx);
    row.getCell(1).value = text;
    sheet.mergeCells(rowIdx, 1, rowIdx, colCount);
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = STYLE.centerAlign;
      cell.font      = { name: 'Calibri', color: { argb: 'FFFFFFFF' }, ...fontOpts };
    });
    return row;
  };

  /** Download a workbook as .xlsx */
  const downloadWorkbook = async (workbook, filename) => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob   = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ─── BRANCH REPORT ─────────────────────────────────────────────────────────
  const exportToCSV = async () => {
    if (!activeBranch) return;
    const reportDate  = new Date(selectedDate);
    const targetMonth = reportDate.getMonth();
    const targetYear  = reportDate.getFullYear();
    const monthLabel  = reportDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const workingDays = getWorkingDaysInMonth(selectedDate);
    const generatedOn = new Date().toLocaleString('en-IN');

    const COLS = 9; // Sr No, Roll No, Name, Phone, Present, Absent, Total, %, Status

    const wb   = new ExcelJS.Workbook();
    wb.creator = 'QR Attendance System';
    const ws   = wb.addWorksheet('Attendance Report', {
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' },
    });

    // ── Column widths
    ws.columns = [
      { width: 7  }, // Sr No
      { width: 9  }, // Roll No
      { width: 26 }, // Student Name
      { width: 16 }, // Phone
      { width: 14 }, // Days Present
      { width: 13 }, // Days Absent
      { width: 18 }, // Total Working Days
      { width: 14 }, // Attendance %
      { width: 18 }, // Status
    ];

    // ── Title row
    const titleRow = addInfoRow(ws, COLS,
      `${activeBranch.name.toUpperCase()} — MONTHLY ATTENDANCE REPORT`,
      { bold: true, size: 16 }
    );
    titleRow.height = 36;
    titleRow.eachCell({ includeEmpty: true }, c => { c.fill = STYLE.titleFill; });

    // ── Info rows
    const infoFont = { size: 11 };
    const infoFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    [
      `Month: ${monthLabel}`,
      `Total Working Days (Mon – Fri): ${workingDays}`,
      `Generated On: ${generatedOn}`,
    ].forEach(text => {
      const r = addInfoRow(ws, COLS, text, infoFont);
      r.eachCell({ includeEmpty: true }, c => { c.fill = infoFill; });
    });

    // ── Blank spacer
    ws.addRow([]);

    // ── Header row
    const headerRow = ws.addRow([
      'Sr No', 'Roll No', 'Student Name', 'Phone',
      'Days Present', 'Days Absent', 'Total Working Days',
      'Attendance %', 'Status',
    ]);
    headerRow.height = 22;
    styleRow(headerRow, STYLE.headerFill,
      { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    );

    // ── Data rows
    const branchStudents = students
      .filter(s => String(s.branchId) === String(activeBranch.id))
      .sort((a, b) => (parseInt(a.rollNo) || 0) - (parseInt(b.rollNo) || 0));

    branchStudents.forEach((student, idx) => {
      const presentCount = attendance.filter(r => {
        const d = new Date(r.date);
        return (
          String(r.studentId) === String(student.id) &&
          r.present === true &&
          d.getMonth() === targetMonth &&
          d.getFullYear() === targetYear
        );
      }).length;

      const absentCount  = Math.max(0, workingDays - presentCount);
      const percentage   = workingDays > 0 ? Math.round((presentCount / workingDays) * 100) : 0;
      const isSafe       = percentage >= 75;
      const phone        = student.phone ? String(student.phone) : 'N/A';

      const dataRow = ws.addRow([
        idx + 1,
        student.rollNo,
        student.name,
        { text: phone, type: 'string' },   // keep as text — prevents Excel auto-format
        presentCount,
        absentCount,
        workingDays,
        `${percentage}%`,
        isSafe ? 'Safe ✓' : 'Short Attendance',
      ]);
      dataRow.height = 19;

      const rowFill = idx % 2 === 0 ? STYLE.rowEvenFill : STYLE.rowOddFill;
      styleRow(dataRow, rowFill);

      // Student name — bold + left-aligned
      const nameCell    = dataRow.getCell(3);
      nameCell.font     = { name: 'Calibri', size: 11, bold: true };
      nameCell.alignment = STYLE.leftAlign;

      // Phone — left-aligned, stored as text
      const phoneCell    = dataRow.getCell(4);
      phoneCell.value    = phone;
      phoneCell.numFmt   = '@';            // force text format
      phoneCell.alignment = STYLE.leftAlign;

      // Status cell — colour-coded
      const statusCell  = dataRow.getCell(9);
      statusCell.fill   = isSafe ? STYLE.safeFill : STYLE.shortFill;
      statusCell.font   = { name: 'Calibri', size: 11, bold: true,
                             color: { argb: isSafe ? 'FF065F46' : 'FF991B1B' } };
    });

    // ── Summary row
    const totalPresent = branchStudents.reduce((acc, student) => {
      return acc + attendance.filter(r => {
        const d = new Date(r.date);
        return String(r.studentId) === String(student.id) && r.present === true &&
          d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      }).length;
    }, 0);
    const avgPct = branchStudents.length > 0
      ? Math.round(totalPresent / (branchStudents.length * workingDays || 1) * 100)
      : 0;

    ws.addRow([]); // spacer
    const sumRow = ws.addRow(['', '', `Total Students: ${branchStudents.length}`, '',
      totalPresent, '', '', `Avg: ${avgPct}%`, '']);
    sumRow.height = 20;
    styleRow(sumRow,
      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } },
      { bold: true, size: 11, color: { argb: 'FF3730A3' } }
    );

    await downloadWorkbook(wb, `${activeBranch.name}_MonthlyReport_${monthLabel.replace(' ', '_')}.xlsx`);
    showToast('Branch report downloaded!', 'success');
  };

  // ─── SUBJECT REPORT ─────────────────────────────────────────────────────────
  const exportSubjectCSV = async (subBranchId, subBranchName) => {
    if (!activeBranch) return;
    const reportDate  = new Date(selectedDate);
    const targetMonth = reportDate.getMonth();
    const targetYear  = reportDate.getFullYear();
    const monthLabel  = reportDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const workingDays = getWorkingDaysInMonth(selectedDate);
    const generatedOn = new Date().toLocaleString('en-IN');

    const COLS = 10; // Sr, Roll, Name, Phone, Subject, Present, Absent, Total, %, Status

    const wb   = new ExcelJS.Workbook();
    wb.creator = 'QR Attendance System';
    const ws   = wb.addWorksheet('Subject Report', {
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' },
    });

    // ── Column widths
    ws.columns = [
      { width: 7  }, // Sr No
      { width: 9  }, // Roll No
      { width: 26 }, // Student Name
      { width: 16 }, // Phone
      { width: 20 }, // Subject
      { width: 14 }, // Days Present
      { width: 13 }, // Days Absent
      { width: 18 }, // Total Working Days
      { width: 14 }, // Attendance %
      { width: 18 }, // Status
    ];

    // ── Title row
    const titleRow = addInfoRow(ws, COLS,
      `${activeBranch.name.toUpperCase()} — SUBJECT ATTENDANCE REPORT`,
      { bold: true, size: 16 }
    );
    titleRow.height = 36;
    titleRow.eachCell({ includeEmpty: true }, c => { c.fill = STYLE.titleFill; });

    // ── Info rows
    const infoFont = { size: 11 };
    const infoFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    [
      `Subject: ${subBranchName}`,
      `Month: ${monthLabel}`,
      `Total Working Days (Mon – Fri): ${workingDays}`,
      `Generated On: ${generatedOn}`,
    ].forEach(text => {
      const r = addInfoRow(ws, COLS, text, infoFont);
      r.eachCell({ includeEmpty: true }, c => { c.fill = infoFill; });
    });

    // ── Blank spacer
    ws.addRow([]);

    // ── Header row
    const headerRow = ws.addRow([
      'Sr No', 'Roll No', 'Student Name', 'Phone', 'Subject',
      'Days Present', 'Days Absent', 'Total Working Days',
      'Attendance %', 'Status',
    ]);
    headerRow.height = 22;
    styleRow(headerRow, STYLE.headerFill,
      { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    );

    // ── Data rows
    const branchStudents = students
      .filter(s => String(s.branchId) === String(activeBranch.id))
      .sort((a, b) => (parseInt(a.rollNo) || 0) - (parseInt(b.rollNo) || 0));

    branchStudents.forEach((student, idx) => {
      const presentCount = attendance.filter(r => {
        const d = new Date(r.date);
        return (
          String(r.studentId) === String(student.id) &&
          String(r.subBranchId) === String(subBranchId) &&
          r.present === true &&
          d.getMonth() === targetMonth &&
          d.getFullYear() === targetYear
        );
      }).length;

      const absentCount  = Math.max(0, workingDays - presentCount);
      const percentage   = workingDays > 0 ? Math.round((presentCount / workingDays) * 100) : 0;
      const isSafe       = percentage >= 75;
      const phone        = student.phone ? String(student.phone) : 'N/A';

      const dataRow = ws.addRow([
        idx + 1,
        student.rollNo,
        student.name,
        phone,
        subBranchName,
        presentCount,
        absentCount,
        workingDays,
        `${percentage}%`,
        isSafe ? 'Safe ✓' : 'Short Attendance',
      ]);
      dataRow.height = 19;

      const rowFill = idx % 2 === 0 ? STYLE.rowEvenFill : STYLE.rowOddFill;
      styleRow(dataRow, rowFill);

      // Student name — bold + left-aligned
      const nameCell     = dataRow.getCell(3);
      nameCell.font      = { name: 'Calibri', size: 11, bold: true };
      nameCell.alignment = STYLE.leftAlign;

      // Phone — left-aligned, text format
      const phoneCell    = dataRow.getCell(4);
      phoneCell.numFmt   = '@';
      phoneCell.alignment = STYLE.leftAlign;

      // Subject — centered italic
      dataRow.getCell(5).font = { name: 'Calibri', size: 11, italic: true };

      // Status — colour-coded
      const statusCell  = dataRow.getCell(10);
      statusCell.fill   = isSafe ? STYLE.safeFill : STYLE.shortFill;
      statusCell.font   = { name: 'Calibri', size: 11, bold: true,
                             color: { argb: isSafe ? 'FF065F46' : 'FF991B1B' } };
    });

    // ── Summary row
    const totalPresent = branchStudents.reduce((acc, student) => {
      return acc + attendance.filter(r => {
        const d = new Date(r.date);
        return String(r.studentId) === String(student.id) &&
          String(r.subBranchId) === String(subBranchId) &&
          r.present === true &&
          d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      }).length;
    }, 0);
    const avgPct = branchStudents.length > 0
      ? Math.round(totalPresent / (branchStudents.length * workingDays || 1) * 100)
      : 0;

    ws.addRow([]); // spacer
    const sumRow = ws.addRow(['', '', `Total Students: ${branchStudents.length}`, '', '',
      totalPresent, '', '', `Avg: ${avgPct}%`, '']);
    sumRow.height = 20;
    styleRow(sumRow,
      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } },
      { bold: true, size: 11, color: { argb: 'FF3730A3' } }
    );

    await downloadWorkbook(wb,
      `${subBranchName}_${activeBranch.name}_${monthLabel.replace(' ', '_')}_Report.xlsx`
    );
    showToast('Subject report downloaded!', 'success');
  };
  // 🟢🟢🟢 END REPORT FUNCTIONS 🟢🟢🟢

  const backupData = () => {
    const data = { branches, subBranches, students, attendance };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `QR_DB_Backup_${formatDate(new Date().toISOString())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const restoreData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isSuperUser) { showToast("Permission Denied: Super Admin only", "error"); return; }
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        // ✅ Custom modal instead of native confirm()
        setConfirmModal({
          show: true, isDanger: true,
          title: "⚠️ Restore Database?",
          message: "This will permanently replace ALL existing data with the backup file. This cannot be undone!",
          onConfirm: async () => {
            setConfirmModal(c => ({ ...c, show: false }));
            try {
              const token = localStorage.getItem("authToken");
              const res = await fetch(`${API_URL}/restore/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Token ${token}` },
                body: JSON.stringify(jsonData),
              });
              const response = await res.json();
              if (response.status === "success") { showToast("Restore Successful!", "success"); await refreshData(); }
              else showToast("Restore Failed", "error");
            } catch { showToast("Restore Error", "error"); }
          }
        });
      } catch { showToast("Invalid File", "error"); }
    };
    reader.readAsText(file);
  };

  // 🟢 FIX FOR WHITE SCREEN CRASH
  const filteredStudents = students.filter((s) => {
    const matchBranch = activeBranch && String(s.branchId) === String(activeBranch.id);
    const matchSub = selectedSubBranchId === null ? true : (s.subBranchIds || []).some((id) => String(id) === String(selectedSubBranchId));
    
    // 🟢 SAFE SEARCH: Convert to String before calling .toLowerCase()
    const studentName = String(s.name || "").toLowerCase();
    const studentRoll = String(s.rollNo || "").toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchSearch = studentName.includes(query) || studentRoll.includes(query);
    
    return matchBranch && matchSub && matchSearch;
  });

  const handleSendAlertsClick = async () => {
    if (!activeBranch) {
      showToast("Please select a branch first.", "error");
      return;
    }
    await sendAlerts(activeBranch.id); 
  };

  // --- RENDER ---
  if (branches.length === 0 && !showAddBranch) {
    return (
      <div className="empty-state">
        <h1>Welcome to QR Admin</h1>
        <button className="btn btn-primary" onClick={() => setShowAddBranch(true)}>+ Create First Branch</button>
        {showAddBranch && <AddBranchModal name={newBranchName} setName={setNewBranchName} onSubmit={handleAddBranch} onCancel={() => setShowAddBranch(false)} />}
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Mobile Menu Button - Z-Index Higher */}
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
        <Menu size={24} />
      </button>

      <Sidebar
        branches={branches}
        activeBranch={activeBranch}
        sidebarOpen={sidebarOpen}
        closeSidebar={() => setSidebarOpen(false)} // Pass close handler
        onSelectBranch={handleSelectBranch}
        onAddBranch={() => setShowAddBranch(true)}
        onBackup={backupData}
        onRestore={restoreData}
        onSendAlerts={handleSendAlertsClick}
        // 🟢 CONNECTED THE SCANNER OPENER with Permission Check
        onOpenScanner={() => {
            if (canEdit) setShowScanner(true);
            else showToast("Permission Denied: Read Only Mode", "error");
        }}
        theme={theme}
        toggleTheme={toggleTheme}
        logout={handleLogoutClick}
        navigate={navigate}
      />

      <main className="main-content">
        <TopBar
          activeBranch={activeBranch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          changeDate={(days) => { const d = new Date(selectedDate); d.setDate(d.getDate() + days); setSelectedDate(d.toISOString().split("T")[0]); }}
          onExport={exportToCSV}
          // 🟢 ADD STUDENT Permission Check
          onAddStudent={() => {
            if (canEdit) setShowAddStudent(true);
            else showToast("Permission Denied: Read Only Mode", "error");
          }}
          onDeleteBranch={handleDeleteBranchClick}
          canDelete={isSuperUser}
        />

        {activeBranch && (
          <div className="subtabs-wrapper">
            <div className="subtabs-list">
              <button onClick={() => { setSelectedSubBranchId(null); localStorage.removeItem("activeSubBranchId"); }} className={`subtab ${selectedSubBranchId === null ? "active" : ""}`}>All</button>
              {activeBranchSubBranches.map((sb) => (
                <button key={sb.id} onClick={() => { setSelectedSubBranchId(sb.id); localStorage.setItem("activeSubBranchId", String(sb.id)); }} className={`subtab ${String(selectedSubBranchId) === String(sb.id) ? "active" : ""}`}>
                  {sb.name}
                </button>
              ))}
            </div>

            <div className="subtabs-actions">
              {selectedSubBranchId && (
                <>
                  <button
                    className="btn-action-tab btn-action-report"
                    onClick={() => {
                      const sub = activeBranchSubBranches.find(s => s.id === selectedSubBranchId);
                      if (sub) exportSubjectCSV(selectedSubBranchId, sub.name);
                    }}
                    title="Download Report"
                  >
                    <FileText size={16} />
                  </button>

                  <button 
                    className="btn-action-tab btn-action-add" 
                    // 🟢 UI: Visual feedback for disabled state could be added here, currently handled by toast
                    style={{ opacity: canEdit ? 1 : 0.5, cursor: canEdit ? 'pointer' : 'not-allowed' }}
                    onClick={() => { 
                        const sub = activeBranchSubBranches.find(s => s.id === selectedSubBranchId); 
                        if (sub) handleEditSubBranchClick(selectedSubBranchId, sub.name); 
                    }} 
                    title="Rename Subject"
                  >
                    <Edit2 size={16} />
                  </button>

                  <button 
                    className="btn-action-tab btn-action-delete" 
                    style={{ opacity: canEdit ? 1 : 0.5, cursor: canEdit ? 'pointer' : 'not-allowed' }}
                    onClick={() => handleDeleteSubBranchClick(selectedSubBranchId)} 
                    title="Delete Subject"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
              <button 
                className="btn-action-tab btn-action-add" 
                style={{ opacity: canEdit ? 1 : 0.5, cursor: canEdit ? 'pointer' : 'not-allowed' }}
                onClick={handleAddSubjectClick}
              >
                <Plus size={16} /> <span className="hidden md:inline">Add</span>
              </button>
            </div>
          </div>
        )}

        {/* Bulk Selection Toolbar */}
        {canEdit && filteredStudents.length > 0 && (
          <div className="bulk-toolbar">
            <button
              className={`btn-select-mode ${isSelectMode ? 'active' : ''}`}
              onClick={() => { setIsSelectMode(p => !p); setSelectedStudents(new Set()); }}
            >
              {isSelectMode ? <CheckSquare size={16} /> : <Square size={16} />}
              {isSelectMode ? 'Cancel Selection' : 'Select Students'}
            </button>
            {isSelectMode && (
              <>
                <button
                  className="btn-select-all"
                  onClick={() => {
                    if (selectedStudents.size === filteredStudents.length)
                      setSelectedStudents(new Set());
                    else
                      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
                  }}
                >
                  {selectedStudents.size === filteredStudents.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedStudents.size > 0 && (
                  <button className="btn-bulk-delete" onClick={handleBulkDelete}>
                    <Trash2 size={16} />
                    Delete {selectedStudents.size} Selected
                  </button>
                )}
                {selectedStudents.size > 0 && (
                  <span className="bulk-count">{selectedStudents.size} of {filteredStudents.length} selected</span>
                )}
              </>
            )}
          </div>
        )}

        <div className="grid">
          {filteredStudents.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              attendance={attendance}
              selectedDate={selectedDate}
              theme={theme}
              onToggle={toggleAttendance}
              onShowQR={setShowQRModal}
              onDelete={handleDeleteStudentClick}
              currentSubBranchId={selectedSubBranchId}
              totalSubjectsCount={activeBranchSubBranches.length}
              isSelectMode={isSelectMode}
              isSelected={selectedStudents.has(student.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))}
        </div>

        {/* 🟢 NEW SCANNER OVERLAY - Renders on top, No Refresh */}
        {showScanner && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, background: '#000' }}>
                <Scanner onClose={() => { setShowScanner(false); refreshData(); }} />
            </div>
        )}

        {/* Modals */}
        {showAddStudent && <AddStudentModal form={newStudentForm} setForm={setNewStudentForm} onSubmit={handleCreateStudent} onCancel={() => setShowAddStudent(false)} />}
        {showAddBranch && <AddBranchModal name={newBranchName} setName={setNewBranchName} onSubmit={handleAddBranch} onCancel={() => setShowAddBranch(false)} />}
        {showQRModal && <IDCardModal student={showQRModal} branchName={activeBranch?.name} onClose={() => setShowQRModal(null)} />}

        {confirmModal.show && (
          <div className="overlay" style={{ zIndex: 10000 }}>
            <div className="modal confirm-modal">
              <div className="confirm-icon-wrap">
                <AlertTriangle size={32} />
              </div>
              <h3 className="confirm-title">{confirmModal.title}</h3>
              <p className="confirm-msg">{confirmModal.message}</p>
              <div className="modal-actions">
                <button className="btn btn-cancel-action" onClick={() => setConfirmModal(c => ({ ...c, show: false }))}>
                  Cancel
                </button>
                <button className="btn btn-confirm-danger" onClick={confirmModal.onConfirm}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {promptModal.show && (
          <div className="overlay" style={{ zIndex: 10000 }}>
            <div className="modal" style={{ maxWidth: '400px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px' }}>{promptModal.title}</h3>
              <input
                autoFocus
                type="text"
                defaultValue={promptModal.value}
                id="promptInput"
                onKeyDown={(e) => { if (e.key === 'Enter') { const val = e.target.value; if (val && val.trim()) promptModal.onConfirm(val); } }}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '1rem' }}
              />
              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button className="btn" style={{ flex: 1, background: 'var(--bg-main)', color: 'var(--text-primary)' }} onClick={() => setPromptModal({ ...promptModal, show: false })}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { const val = document.getElementById('promptInput').value; if (val) promptModal.onConfirm(val); }}>Save</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}