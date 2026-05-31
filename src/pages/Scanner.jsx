import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import { useApp } from "../context/AppContext";
import { ArrowLeft, Camera, XCircle, CheckCircle, Info } from "lucide-react";
import "../styles/Scanner.css";

export default function Scanner({ onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isScanningRef = useRef(true);

  // 🟢 IMPORTED subBranches for branch-specific lookup
  const { students, subBranches, markAttendanceByQr, showToast, getDeviceLocation } = useApp();
  const navigate = useNavigate();

  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(true);

  const playBeep = () => {
    try {
      const audio = new Audio('/beep.mp3');
      audio.play().catch((err) => console.log("Audio play failed (interaction needed?):", err));
    } catch (e) {
      console.error("Audio error:", e);
    }
  };

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  const cleanupCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      streamRef.current = null;
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const vidStream = videoRef.current.srcObject;
      vidStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      videoRef.current.srcObject = null;
    }
  };

  const handleBack = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    isScanningRef.current = false;
    setIsScanning(false);
    cleanupCamera();

    if (onClose) {
        onClose();
    } else {
        navigate("/dashboard", { replace: true });
    }
  };

  useEffect(() => {
    const activeSubBranchId = localStorage.getItem("activeSubBranchId");
    if (!activeSubBranchId) {
      showToast("Please select a subject first", "error");
      if (onClose) onClose(); else navigate("/dashboard");
      return;
    }

    if (!videoRef.current) return;

    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    let animationFrameId;
    let mounted = true;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not supported in this browser (HTTPS required?)");
        }

        const constraints = { video: { facingMode: "environment" } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", true);
          await videoRef.current.play();
          requestAnimationFrame(tick);
        }
      } catch (err) {
        console.error("Camera Init Error:", err);
        if (mounted) {
          setError("Camera Error: " + (err.message || "Blocked"));
          showToast("Camera access failed", "error");
        }
      }
    };

    function tick() {
      if (!mounted) return;

      if (videoRef.current && videoRef.current.readyState >= 2) {
        if (canvasRef.current && ctx) {
            canvasRef.current.height = videoRef.current.videoHeight;
            canvasRef.current.width = videoRef.current.videoWidth;
            ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

            if (isScanningRef.current) {
                const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code && code.data) {
                    handleScan(code.data);
                }
            }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    }

    startCamera();

    return () => {
      mounted = false;
      cancelAnimationFrame(animationFrameId);
      cleanupCamera();
    };
  }, []);

  const handleScan = async (payload) => {
    isScanningRef.current = false;
    setIsScanning(false);

    const activeSubBranchId = localStorage.getItem("activeSubBranchId");
    const storedDate = localStorage.getItem("selectedDate"); 
    const dateToMark = storedDate || new Date().toISOString().split("T")[0];

    let cleanPayload = payload ? payload.toString().trim().replace(/^"|"$/g, "") : "";
    let scannedId = cleanPayload.startsWith("SECURE_APP_VER1:") ? cleanPayload.split(":")[1] : cleanPayload;

    // 🟢 FIX 2: Scope frontend student lookup strictly to the active branch
    const activeSubBranch = subBranches.find(sb => String(sb.id) === String(activeSubBranchId));
    const activeBranchId = activeSubBranch ? activeSubBranch.branchId : null;

    const localStudent = students.find(s => 
      String(s.branchId) === String(activeBranchId) && 
      (String(s.id) == String(scannedId) || String(s.rollNo) == String(scannedId) || String(s.qrPayload) == String(cleanPayload))
    );

    // 🟢 GEO: Fetch device location before marking attendance.
    // If location fails, the backend will reject if geo-fence is configured for this branch.
    // We still attempt the request — the backend is the authoritative validator.
    let geoLat = null;
    let geoLng = null;
    try {
      const coords = await getDeviceLocation();
      geoLat = coords.latitude;
      geoLng = coords.longitude;
    } catch (geoErr) {
      // Show a warning toast but do NOT block — backend will decide
      showToast(geoErr.message || "Unable to fetch location", "error");
      // Resume scanning so the user can try again
      setScanResult(null);
      setIsScanning(true);
      isScanningRef.current = true;
      return;
    }

    try {
      const res = await markAttendanceByQr(cleanPayload, activeSubBranchId, dateToMark, geoLat, geoLng);
      
      playBeep();

      const studentForUi = localStudent || {
          name: res.student || "Unknown",
          rollNo: "",
          photoDataUrl: "",
      };

      // 🟢 FIX 1: Show completely different UI if already marked
      if (res.status === "exists") {
         setScanResult({ status: "exists", student: studentForUi });
         showToast(`Already Marked (${dateToMark})`, "info");
      } else {
         setScanResult({ status: "success", student: studentForUi, isNew: true });
         showToast(`Marked Present (${dateToMark})`, "success"); 
      }
    } catch (err) {
      setScanResult({ status: "error" });
      const errorMsg = err.response?.data?.message || err.message || "Scan Failed";
      showToast(errorMsg, "error");
    }

    setTimeout(() => {
      setScanResult(null);
      setIsScanning(true);
      isScanningRef.current = true;
    }, 2500); 
  };

  return (
    <div className="scanner-page">
      <div className="scanner-header">
        <button type="button" onClick={handleBack} className="scanner-back-btn">
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ fontWeight: "600", color: isScanning ? "#10b981" : "#64748b", display: "flex", gap: "5px", alignItems: "center" }}>
          <Camera size={18} /> {isScanning ? "Scanning..." : "Processing"}
        </div>
      </div>

      <div className="scanner-viewport">
        {!error ? (
          <>
            <video ref={videoRef} muted className="scanner-video" style={{objectFit:'cover'}}></video>
            <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
            <div className="scan-laser"></div>
            <div className="scan-corner tl"></div>
            <div className="scan-corner tr"></div>
            <div className="scan-corner bl"></div>
            <div className="scan-corner br"></div>
          </>
        ) : (
          <div className="camera-error">
            <XCircle size={48} style={{ marginBottom: "10px" }} />
            <p>{error}</p>
            <button type="button" onClick={() => window.location.reload()} style={{ marginTop: "15px", padding: "8px 16px" }}>Retry</button>
          </div>
        )}

        {scanResult && (
          <div 
            className={`scan-result-overlay ${scanResult.status === "error" ? "error" : ""}`}
            style={scanResult.status === "exists" ? { backgroundColor: "#eab308" } : {}} 
          >
            {scanResult.status === "success" ? (
              <>
                {scanResult.student.photoDataUrl ? (
                  <img src={scanResult.student.photoDataUrl} className="result-photo" alt="Student" />
                ) : (
                  <div className="result-photo" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", color: "black", fontWeight: "bold", background: "#f3f4f6" }}>
                    {scanResult.student.name?.charAt(0)}
                  </div>
                )}
                <CheckCircle size={50} color="white" style={{ marginBottom: "10px" }} />
                <h2 style={{ margin: 0, fontSize: "1.8rem", fontWeight: "800" }}>PRESENT</h2>
                <p style={{ fontSize: "1.2rem", margin: "5px 0" }}>{scanResult.student.name}</p>
              </>
            ) : scanResult.status === "exists" ? (
              <>
                {scanResult.student.photoDataUrl ? (
                  <img src={scanResult.student.photoDataUrl} className="result-photo" alt="Student" />
                ) : (
                  <div className="result-photo" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", color: "black", fontWeight: "bold", background: "#f3f4f6" }}>
                    {scanResult.student.name?.charAt(0)}
                  </div>
                )}
                {/* 🟢 NEW UI FOR DUPLICATE SCANS */}
                <Info size={50} color="white" style={{ marginBottom: "10px" }} />
                <h2 style={{ margin: 0, fontSize: "1.8rem", fontWeight: "800" }}>ALREADY MARKED</h2>
                <p style={{ fontSize: "1.2rem", margin: "5px 0" }}>{scanResult.student.name}</p>
              </>
            ) : (
              <>
                <XCircle size={60} color="white" style={{ marginBottom: "15px" }} />
                <h2 style={{ margin: 0, fontSize: "1.8rem" }}>Failed</h2>
              </>
            )}
          </div>
        )}
      </div>

      <div className="scan-instruction">Hold the student QR code steady inside the box.</div>
    </div>
  );
}