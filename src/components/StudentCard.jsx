import React from "react";
import { Trash2, QrCode, CheckSquare, Square } from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";
import { API_URL } from "../context/AppContext";

export default function StudentCard({
  student,
  attendance,
  selectedDate,
  theme,
  onToggle,
  onShowQR,
  onDelete,
  currentSubBranchId,
  totalSubjectsCount = 1,
  // Bulk selection props
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
}) {
  const safeAttendance = Array.isArray(attendance) ? attendance : [];

  // 🟢 Helper to handle Clean & Corrupted URLs
  const getImageUrl = (imagePath) => {
    if (!imagePath) return "";
    if (imagePath.includes("/http")) {
      return imagePath.substring(imagePath.indexOf("http"));
    }
    if (imagePath.startsWith("http")) {
      return imagePath;
    }
    const BASE_URL = API_URL.replace("/api", "");
    return `${BASE_URL}${imagePath}`;
  };

  // 🟢 HELPER: Counts only Working Days (Mon-Fri)
  const getWorkingDaysCount = (targetDate) => {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const dayLimit = targetDate.getDate();
    let count = 0;
    for (let d = 1; d <= dayLimit; d++) {
      const currentDay = new Date(year, month, d).getDay();
      if (currentDay !== 0 && currentDay !== 6) count++;
    }
    return count;
  };

  // 🟢 MAIN CALCULATION FUNCTION
  const getStats = () => {
    const reportDate = selectedDate ? new Date(selectedDate) : new Date();
    const reportMonth = reportDate.getMonth();
    const reportYear = reportDate.getFullYear();
    const now = new Date();

    let calcDate;
    if (reportMonth === now.getMonth() && reportYear === now.getFullYear()) {
      calcDate = now;
    } else {
      calcDate = new Date(reportYear, reportMonth + 1, 0);
    }

    const totalWorkingDaysPassed = getWorkingDaysCount(calcDate);
    let effectiveTotalClasses = totalWorkingDaysPassed;

    if (!currentSubBranchId && totalSubjectsCount > 0) {
      effectiveTotalClasses = totalWorkingDaysPassed * totalSubjectsCount;
    }
    if (effectiveTotalClasses === 0) effectiveTotalClasses = 1;

    const presentCount = safeAttendance.filter((r) => {
      const rDate = new Date(r.date);
      const sameStudent = String(r.studentId) === String(student.id);
      const sameMonth = rDate.getMonth() === reportMonth && rDate.getFullYear() === reportYear;
      const sameSubject = !currentSubBranchId || String(r.subBranchId) === String(currentSubBranchId);
      return sameStudent && sameMonth && sameSubject && r.present === true;
    }).length;

    let percentage = 0;
    if (effectiveTotalClasses > 0) {
      percentage = Math.round((presentCount / effectiveTotalClasses) * 100);
    }
    if (percentage > 100) percentage = 100;

    const isSafe = percentage >= 75;
    const mainColor = isSafe ? "#10b981" : "#ef4444";
    const emptyColor = theme === "dark" ? "#334155" : "#e2e8f0";

    return {
      data: [
        { value: percentage, color: mainColor },
        { value: 100 - percentage, color: emptyColor },
      ],
      percent: percentage,
      color: mainColor,
      statusClass: isSafe ? "text-success" : "text-danger",
    };
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const isPresent = safeAttendance.some((r) => {
    const sameStudent = String(r.studentId) === String(student.id);
    const sameDate = r.date === selectedDate;
    const sameSubject = !currentSubBranchId || String(r.subBranchId) === String(currentSubBranchId);
    return sameStudent && sameDate && sameSubject;
  });

  const stats = getStats();

  return (
    <div
      className={`card ${isPresent ? "present" : ""} ${isSelected ? "card-selected" : ""}`}
      onClick={isSelectMode ? () => onToggleSelect(student.id) : undefined}
      style={{ cursor: isSelectMode ? "pointer" : "default" }}
    >
      {/* Selection checkbox overlay */}
      {isSelectMode && (
        <div className="card-select-checkbox" onClick={(e) => { e.stopPropagation(); onToggleSelect(student.id); }}>
          {isSelected
            ? <CheckSquare size={22} color="#4f46e5" />
            : <Square size={22} color="#94a3b8" />
          }
        </div>
      )}

      <div className="card-header">
        {student.photoDataUrl ? (
          <img
            src={getImageUrl(student.photoDataUrl)}
            alt={student.name}
            className="avatar"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : (
          <div className="avatar-placeholder">{getInitials(student.name)}</div>
        )}

        <div className="avatar-placeholder" style={{ display: "none" }}>
          {getInitials(student.name)}
        </div>

        <div className="chart-wrapper">
          <PieChart width={70} height={70}>
            <Pie
              data={stats.data}
              cx="50%"
              cy="50%"
              innerRadius={24}
              outerRadius={32}
              dataKey="value"
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {stats.data.map((e, i) => (
                <Cell key={i} fill={e.color} />
              ))}
            </Pie>
          </PieChart>
          <div className={`chart-label ${stats.statusClass}`}>
            {stats.percent}%
          </div>
        </div>
      </div>

      <div className="card-info">
        <strong className="student-name">{student.name}</strong>
        <span className="student-roll">#{student.rollNo}</span>
      </div>

      {/* Hide actions in select mode */}
      {!isSelectMode && (
        <div className="card-actions">
          <button
            onClick={() => onToggle(student.id)}
            className={`status-badge ${isPresent ? "is-present" : "is-absent"}`}
            style={{ flex: 1 }}
          >
            {isPresent ? "Present" : "Mark"}
          </button>

          <button onClick={() => onShowQR(student)} className="btn-icon">
            <QrCode size={18} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onDelete(student.id); }}
            className="btn-icon"
            style={{ color: "var(--danger)", borderColor: "var(--danger-light)" }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}
    </div>
  );
}