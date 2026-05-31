import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef } from "react";
import { CheckCircle, AlertCircle, Info, Undo2 } from "lucide-react";

const AppContext = createContext();

// 🟢 UPDATED: Port set to 8080 to match your Backend
export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8080/api";

export const AppProvider = ({ children }) => {
  // --- 1. AUTH STATE (SECURE) ---
  // We check for a 'token' instead of just 'isAdmin'
  const [token, setToken] = useState(() => localStorage.getItem("authToken"));
  
  // Derived state: If we have a token, we are logged in
  const isAuthenticated = !!token;

  const [isSuperUser, setIsSuperUser] = useState(
    () => localStorage.getItem("isSuperUser") === "true"
  );

  // 🟢 NEW: Store User Groups (e.g., ["Branch: Computer"])
  const [userGroups, setUserGroups] = useState(() => {
    try {
      const stored = localStorage.getItem("userGroups");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // --- DATA STATE ---
  const [branches, setBranches] = useState([]);
  const [subBranches, setSubBranches] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  
  // 🟢 FIX: Use useLayoutEffect to prevent Theme flickering
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const [toast, setToast] = useState(null);
  const [undoToasts, setUndoToasts] = useState([]); // Array of { id, msg, onUndo, timerId }
  const undoIdCounter = useRef(0);

  // ---------- GEO-LOCATION ----------
  // Lazily fetches device coordinates when requested by Scanner.
  // We do NOT auto-request on mount to respect privacy and avoid browser popups on login.
  const getDeviceLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            reject(new Error("Location permission denied. Please allow location access."));
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            reject(new Error("Unable to determine your location. Please check GPS."));
          } else {
            reject(new Error("Unable to fetch location. Please try again."));
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

  // Helper: Get Headers for API calls
  const getHeaders = (isJson = true) => {
    const headers = {
      "Authorization": `Token ${token}`, // 🔒 SEND THE TOKEN
    };
    if (isJson) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  };

  // ---------- FETCH DATA ----------
  const fetchData = async () => {
    if (!token) return; // Don't fetch if not logged in

    try {
      // We pass headers to every call now
      const opts = { headers: getHeaders() };

      const [bRes, sbRes, sRes, aRes] = await Promise.all([
        fetch(`${API_URL}/branches/`, opts),
        fetch(`${API_URL}/sub-branches/`, opts),
        fetch(`${API_URL}/students/`, opts),
        fetch(`${API_URL}/get-attendance/`, opts),
      ]);

      if (bRes.ok) setBranches(await bRes.json());

      if (sbRes.ok) {
        const sbData = await sbRes.json();
        const formatted = sbData.map((sb) => ({
          id: sb.id,
          name: sb.name,
          branchId: sb.branch,
          createdAt: sb.created_at,
        }));
        setSubBranches(formatted);
      }

      if (sRes.ok) {
        const sData = await sRes.json();
        const formattedStudents = sData.map((s) => ({
          id: s.id,
          name: s.name,
          branchId: s.branch,
          rollNo: s.roll_no,
          phone: s.phone,
          photoDataUrl: s.photo || "",
          qrPayload: s.qr_payload,
          createdAt: s.created_at,
          subBranchIds: s.sub_branches || [],
        }));
        // 🟢 NEW: Sort by Roll Number (Numerically: 1, 2, 10, etc.)
        formattedStudents.sort((a, b) => (parseInt(a.rollNo) || 0) - (parseInt(b.rollNo) || 0));

        setStudents(formattedStudents);
      }

      if (aRes.ok) {
        const aData = await aRes.json();
        setAttendance(Array.isArray(aData) ? aData : []);
      }
    } catch (err) {
      console.error("Connection Failed:", err);
      if (err.status === 401) logout(); // Logout if token expired
    }
  };

  // Sync when token changes
  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  // ---------- TOAST ----------
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ---------- UNDO TOAST (10 seconds, STACKED) ----------
  const showUndoToast = (msg, onDelete, onUndo = null) => {
    undoIdCounter.current += 1;
    const toastId = undoIdCounter.current;

    const timerId = setTimeout(async () => {
      // Remove this toast and execute the delete
      setUndoToasts((prev) => prev.filter((t) => t.id !== toastId));
      await onDelete();
    }, 10000);

    const entry = {
      id: toastId,
      msg,
      timerId,
      onUndo: () => {
        clearTimeout(timerId);
        setUndoToasts((prev) => prev.filter((t) => t.id !== toastId));
        if (onUndo) onUndo();
        showToast("Deletion cancelled ✓", "info");
      },
    };

    setUndoToasts((prev) => [...prev, entry]);
  };

  // Undo ALL pending deletes at once
  const undoAll = () => {
    undoToasts.forEach((t) => clearTimeout(t.timerId));
    setUndoToasts([]);
    showToast("All deletions cancelled ✓", "info");
  };

  // ---------- AUTH ACTIONS ----------
  const login = async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      
      if (data.status === "success") {
        // 🔒 SAVE TOKEN
        setToken(data.token);
        localStorage.setItem("authToken", data.token);

        // 🟢 SAVE GROUPS
        const groups = data.groups || [];
        setUserGroups(groups);
        localStorage.setItem("userGroups", JSON.stringify(groups));

        // Save Superuser status
        if (data.is_superuser) {
          setIsSuperUser(true);
          localStorage.setItem("isSuperUser", "true");
        } else {
          setIsSuperUser(false);
          localStorage.setItem("isSuperUser", "false");
        }

        showToast("Login successful!", "success");
        return true;
      } else {
        showToast("Invalid Credentials.", "error");
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      showToast("Network Error.", "error");
      return false;
    }
  };

  const logout = () => {
    // Note: Confirmation is now handled by Dashboard Modal
    setToken(null);
    setIsSuperUser(false);
    setUserGroups([]); // 🟢 Clear Groups
    localStorage.removeItem("authToken");
    localStorage.removeItem("isSuperUser");
    localStorage.removeItem("userGroups"); // 🟢 Clear Groups from Storage
    localStorage.removeItem("isAdmin"); // Cleanup old key
    showToast("Logged Out.", "info");
  };

const changePassword = async (u, o, n) => {
    try {
      const res = await fetch(`${API_URL}/change-password/`, {
        method: "POST",
        // 🟢 FIX: Do NOT use getHeaders() here, otherwise it sends "Token null" and crashes Django!
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({
          username: u,
          old_password: o,
          new_password: n,
        }),
      });
      
      const data = await res.json();
      
      if (data.status === "success") {
        showToast("Password Changed!", "success");
        return true;
      } else {
        // This will now properly show "Old Password Incorrect" instead of just "Failed"
        showToast(data.message || "Failed", "error");
        return false;
      }
    } catch (error) {
      console.error("Change Password Error:", error);
      showToast("Network Error.", "error");
      return false;
    }
  };

  // ---------- SYSTEM ACTIONS ----------
  const toggleTheme = () => {
    setTheme((prev) => {
      const nextTheme = prev === "light" ? "dark" : "light";
      return nextTheme;
    });
  };

  const sendAlerts = async (branchId) => {
    // Safety check
    if (!branchId) {
      showToast("Error: No branch selected for alerts.", "error");
      return;
    }

    try {
      showToast("Sending SMS to active branch...", "info");
      const res = await fetch(`${API_URL}/send-alerts/`, { 
          method: "POST",
          headers: getHeaders(), // 🔒
          body: JSON.stringify({ branchId: branchId }) // Send branch ID to backend
      });
      const data = await res.json();
      if (data.status === "success") {
        showToast(`Sent SMS to ${data.sent_count} parents!`, "success");
      } else {
        showToast(data.message || "Failed to send alerts.", "error");
      }
    } catch (error) {
      showToast("Network Error", "error");
    }
  };

  // ---------- DATA MUTATIONS ----------
  const addBranch = async (name) => {
    try {
      const res = await fetch(`${API_URL}/branches/`, {
        method: "POST",
        headers: getHeaders(), // 🔒
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        await fetchData();
        showToast("Branch Saved", "success");
      } else {
        showToast("Failed to save Branch", "error");
      }
    } catch (error) {
      showToast("Network Error", "error");
    }
  };

  // UPDATED: Uses Undo Toast — actual delete is deferred 6 seconds
  const deleteBranch = (id, branchName, onOptimisticRemove, onOptimisticRestore) => {
    if (!isSuperUser) return false;

    // Optimistic UI: remove immediately from local view
    if (onOptimisticRemove) onOptimisticRemove();

    showUndoToast(
      `Branch "${branchName}" deleted`,
      async () => {
        try {
          const res = await fetch(`${API_URL}/branches/${id}/`, {
            method: "DELETE",
            headers: getHeaders(),
          });
          if (res.ok) {
            await fetchData();
          } else {
            showToast("Failed to delete branch.", "error");
            if (onOptimisticRestore) onOptimisticRestore();
            await fetchData();
          }
        } catch {
          showToast("Network Error", "error");
          if (onOptimisticRestore) onOptimisticRestore();
          await fetchData();
        }
      },
      onOptimisticRestore
    );
    return true;
  };

  const addSubBranch = async (branchId, name) => {
    try {
      const res = await fetch(`${API_URL}/sub-branches/`, {
        method: "POST",
        headers: getHeaders(), // 🔒
        body: JSON.stringify({ name, branch: branchId }),
      });
      if (res.ok) {
        await fetchData();
        showToast("Sub-branch Saved", "success");
      } else {
        showToast("Failed", "error");
      }
    } catch (error) {
      showToast("Network Error", "error");
    }
  };

  // UPDATED: Uses Undo Toast — actual delete is deferred 6 seconds
  const deleteSubBranch = (id, subName, onOptimisticRemove, onOptimisticRestore) => {
    if (!isSuperUser) return false;

    if (onOptimisticRemove) onOptimisticRemove();

    showUndoToast(
      `Subject "${subName}" deleted`,
      async () => {
        try {
          const res = await fetch(`${API_URL}/sub-branches/${id}/`, {
            method: "DELETE",
            headers: getHeaders(),
          });
          if (res.ok) {
            await fetchData();
          } else {
            showToast("Failed to delete subject.", "error");
            if (onOptimisticRestore) onOptimisticRestore();
            await fetchData();
          }
        } catch {
          showToast("Network Error", "error");
          if (onOptimisticRestore) onOptimisticRestore();
          await fetchData();
        }
      },
      onOptimisticRestore
    );
    return true;
  };

  const addStudent = async (studentData) => {
    const formData = new FormData();
    formData.append("name", studentData.name);
    formData.append("roll_no", studentData.rollNo);
    formData.append("branch", studentData.branchId);
    formData.append("phone", studentData.phone);
    if (studentData.photoFile) {
      formData.append("photo", studentData.photoFile);
    }

    try {
      const res = await fetch(`${API_URL}/students/`, {
        method: "POST",
        headers: { "Authorization": `Token ${token}` }, // 🔒
        body: formData,
      });

      if (res.ok) {
        await fetchData();
        showToast("Student Saved", "success");
      } else {
        showToast("Error Saving Student", "error");
      }
    } catch (error) {
      showToast("Network Error", "error");
    }
  };

  // UPDATED: Uses Undo Toast — actual delete is deferred 6 seconds
  const deleteStudent = (id, studentName, onOptimisticRemove, onOptimisticRestore) => {
    if (!isSuperUser) return false;

    if (onOptimisticRemove) onOptimisticRemove();

    showUndoToast(
      `Student "${studentName}" deleted`,
      async () => {
        try {
          const res = await fetch(`${API_URL}/students/${id}/`, {
            method: "DELETE",
            headers: getHeaders(),
          });
          if (res.ok) {
            await fetchData();
          } else {
            showToast("Failed to delete student.", "error");
            if (onOptimisticRestore) onOptimisticRestore();
            await fetchData();
          }
        } catch {
          showToast("Network Error", "error");
          if (onOptimisticRestore) onOptimisticRestore();
          await fetchData();
        }
      },
      onOptimisticRestore
    );
    return true;
  };

  // ---------- ATTENDANCE ----------
  const markAttendance = async (studentId, subBranchId, dateString, latitude = null, longitude = null) => {
    try {
      const body = { studentId, subBranchId, date: dateString };
      // 🟢 Forward geo-coordinates to backend if provided
      if (latitude !== null && longitude !== null) {
        body.latitude = latitude;
        body.longitude = longitude;
      }
      const res = await fetch(`${API_URL}/mark-attendance/`, {
        method: "POST",
        headers: getHeaders(), // 🔒
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      // 🟢 CHECK RESPONSE STATUS
      if (res.ok && data.status === "success") {
        await fetchData(); // Refresh data immediately
        showToast("Attendance Saved", "success");
        return true;
      } else if (data.status === "exists") {
        showToast("Already Marked", "info");
        return false;
      } else {
        // 🟢 CATCH ERROR FROM BACKEND (WEEKEND ERROR / GEO ERROR)
        showToast(data.message || "Failed to mark attendance", "error");
        return false;
      }
    } catch (error) {
      console.error("Mark Attendance Error:", error);
      showToast("Network Error", "error");
      return false;
    }
  };

const markAttendanceByQr = async (qrPayload, subBranchId, dateString, latitude = null, longitude = null) => {
    try {
      const body = { qrPayload, subBranchId };
      if (dateString) body.date = dateString;
      // 🟢 Forward geo-coordinates to backend if provided
      if (latitude !== null && longitude !== null) {
        body.latitude = latitude;
        body.longitude = longitude;
      }

      const res = await fetch(`${API_URL}/mark-attendance-qr/`, {
        method: "POST",
        headers: getHeaders(), // 🔒
        body: JSON.stringify(body),
      });
      const data = await res.json();

      // 🟢 FIX 1: Accept "exists" status without throwing an error
      if (!res.ok || (data.status !== "success" && data.status !== "exists")) {
        throw new Error(data.message || "Failed");
      }

      await fetchData();
      return data;
    } catch (error) {
      throw error;
    }
  };

  const getStudentStats = () => ({}); 

  return (
    <AppContext.Provider
      value={{
        branches,
        subBranches,
        students,
        attendance,
        isAuthenticated,
        isSuperUser,
        userGroups, // 🟢 EXPORTED HERE
        theme,
        login,
        logout,
        toggleTheme,
        addBranch,
        deleteBranch,
        addSubBranch,
        deleteSubBranch,
        addStudent,
        deleteStudent,
        markAttendance,
        markAttendanceByQr,
        getStudentStats,
        showToast,
        showUndoToast,
        changePassword,
        sendAlerts,
        fetchData, // ✅ EXPORTED: Allows Dashboard to refresh data
        getDeviceLocation, // 🟢 GEO: Exported for Scanner use
      }}
    >
      {children}

      {/* --- Regular Toast --- */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === "success" && <CheckCircle size={20} color="#10b981" />}
            {toast.type === "error" && <AlertCircle size={20} color="#ef4444" />}
            {toast.type === "info" && <Info size={20} color="#3b82f6" />}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* --- Stacked Undo Toasts (10-second countdown each) --- */}
      {undoToasts.length > 0 && (
        <div className="undo-toast-container">
          {undoToasts.map((t) => (
            <div key={t.id} className="undo-toast-item">
              <div className="undo-toast">
                <AlertCircle size={18} color="#f59e0b" />
                <span className="undo-toast-msg">{t.msg}</span>
                <button className="undo-btn" onClick={t.onUndo}>
                  <Undo2 size={14} />
                  Undo
                </button>
              </div>
              <div className="undo-progress-bar"></div>
            </div>
          ))}
          {undoToasts.length > 1 && (
            <button className="undo-all-btn" onClick={undoAll}>
              <Undo2 size={14} /> Undo All ({undoToasts.length})
            </button>
          )}
        </div>
      )}
    </AppContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(AppContext);