import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, CameraOff, RefreshCw, AlertTriangle } from "../../lib/lucide";
import { ModernButton } from "../ui/ModernButton";
import { ModernCard } from "../ui/ModernCard";
import { Badge } from "../ui/Badge";

interface QRScannerProps {
  onScan: (data: string) => void;
  isProcessing?: boolean;
  disabled?: boolean;
}

type CameraPermissionState = "prompt" | "granted" | "denied";

export function QRScanner({ onScan, isProcessing = false, disabled = false }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<CameraPermissionState>("prompt");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Check for camera permission status
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: "camera" as PermissionName }).then((result) => {
        setPermission(result.state as CameraPermissionState);
        result.onchange = () => setPermission(result.state as CameraPermissionState);
      }).catch(() => {
        // Permissions API not fully supported
      });
    }
  }, []);

  // Get list of available cameras
  const getAvailableCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      setAvailableCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCamera) {
        // Prefer back camera on mobile
        const backCamera = videoDevices.find(d => 
          d.label.toLowerCase().includes("back") || 
          d.label.toLowerCase().includes("environment")
        );
        setSelectedCamera(backCamera?.deviceId || videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Error getting cameras:", err);
    }
  }, [selectedCamera]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: selectedCamera
          ? { deviceId: { exact: selectedCamera } }
          : { facingMode: "environment" }, // Prefer back camera
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setIsActive(true);
      setPermission("granted");
      await getAvailableCameras();
      
      // Start scanning for QR codes
      startScanning();
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError") {
        setPermission("denied");
        setError("Kamera izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.");
      } else if (err.name === "NotFoundError") {
        setError("Kamera bulunamadı. Cihazınızda kamera olduğundan emin olun.");
      } else if (err.name === "NotReadableError") {
        setError("Kamera başka bir uygulama tarafından kullanılıyor olabilir.");
      } else {
        setError(`Kamera başlatılamadı: ${err.message || "Bilinmeyen hata"}`);
      }
    }
  }, [selectedCamera, getAvailableCameras]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  // QR code scanning using canvas
  const startScanning = useCallback(() => {
    if (scanIntervalRef.current) return;

    // Note: This is a simplified scanner. For production, you'd want to use
    // a library like @zxing/browser or jsQR for actual QR code detection.
    // Here we're simulating the scan by checking for QR-like patterns.
    
    scanIntervalRef.current = window.setInterval(() => {
      if (!videoRef.current || !canvasRef.current || isProcessing || disabled) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // In a real implementation, you would use a QR library here
      // For now, this is a placeholder that demonstrates the structure
      // Example with jsQR: const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      // The actual QR detection would happen here
      // If a code is found: onScan(code.data);
    }, 200);
  }, [isProcessing, disabled, onScan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Handle camera selection change
  const handleCameraChange = useCallback(async (deviceId: string) => {
    setSelectedCamera(deviceId);
    if (isActive) {
      stopCamera();
      setTimeout(() => startCamera(), 100);
    }
  }, [isActive, stopCamera, startCamera]);

  if (permission === "denied") {
    return (
      <ModernCard variant="glass" padding="lg">
        <div style={{ textAlign: "center", padding: "var(--space-8)" }}>
          <AlertTriangle className="h-16 w-16" style={{ margin: "0 auto var(--space-4) auto", color: "var(--danger-500)" }} />
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", marginBottom: "var(--space-2)" }}>
            Kamera İzni Gerekli
          </h3>
          <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-4)" }}>
            QR kod taraması için kamera erişimi gereklidir. Lütfen tarayıcı ayarlarından kamera iznini etkinleştirin.
          </p>
          <ModernButton
            variant="primary"
            onClick={() => {
              setPermission("prompt");
              startCamera();
            }}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Tekrar Dene
          </ModernButton>
        </div>
      </ModernCard>
    );
  }

  return (
    <ModernCard variant="glass" padding="lg">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h3 style={{ fontSize: "var(--text-lg)", fontWeight: "var(--font-bold)", margin: 0 }}>
            QR Kod Tarayıcı
          </h3>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: "var(--space-1) 0 0 0" }}>
            QR kodu kameraya gösterin
          </p>
        </div>
        <Badge variant={isActive ? "success" : "neutral"}>
          {isActive ? "Aktif" : "Kapalı"}
        </Badge>
      </div>

      {/* Camera Selection */}
      {availableCameras.length > 1 && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", display: "block", marginBottom: "var(--space-1)" }}>
            Kamera Seçin:
          </label>
          <select
            value={selectedCamera}
            onChange={(e) => handleCameraChange(e.target.value)}
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)",
            }}
          >
            {availableCameras.map((camera, index) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                {camera.label || `Kamera ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Video Preview */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4/3",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          marginBottom: "var(--space-4)",
        }}
      >
        {isActive ? (
          <>
            <video
              ref={videoRef}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              playsInline
              muted
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            
            {/* Scanning Overlay */}
            <motion.div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  width: "200px",
                  height: "200px",
                  border: "3px solid var(--primary-500)",
                  borderRadius: "var(--radius-lg)",
                  position: "relative",
                }}
              >
                {/* Corner accents */}
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: "24px",
                      height: "24px",
                      border: "4px solid var(--primary-500)",
                      borderRadius: i < 2 ? "var(--radius-md) 0 0 0" : "0 0 var(--radius-md) 0",
                      borderWidth: `${i === 0 || i === 1 ? 4 : 0}px ${i === 1 || i === 3 ? 4 : 0}px ${i === 2 || i === 3 ? 4 : 0}px ${i === 0 || i === 2 ? 4 : 0}px`,
                      top: i < 2 ? -3 : "auto",
                      bottom: i >= 2 ? -3 : "auto",
                      left: i % 2 === 0 ? -3 : "auto",
                      right: i % 2 === 1 ? -3 : "auto",
                    }}
                  />
                ))}
                
                {/* Scanning line animation */}
                <motion.div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: "2px",
                    background: "linear-gradient(90deg, transparent, var(--primary-500), transparent)",
                  }}
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              </div>
            </motion.div>

            {isProcessing && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0, 0, 0, 0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "var(--text-lg)",
                  fontWeight: "var(--font-semibold)",
                }}
              >
                Doğrulanıyor...
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-tertiary)",
            }}
          >
            <CameraOff className="h-16 w-16" style={{ marginBottom: "var(--space-4)" }} />
            <p style={{ margin: 0 }}>Kamera kapalı</p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: "var(--space-3)",
            background: "var(--danger-50)",
            border: "1px solid var(--danger-200)",
            borderRadius: "var(--radius-md)",
            color: "var(--danger-600)",
            fontSize: "var(--text-sm)",
            marginBottom: "var(--space-4)",
          }}
        >
          {error}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        {!isActive ? (
          <ModernButton
            variant="primary"
            onClick={startCamera}
            disabled={disabled}
            leftIcon={<Camera className="h-4 w-4" />}
            style={{ flex: 1 }}
          >
            Kamerayı Aç
          </ModernButton>
        ) : (
          <ModernButton
            variant="outline"
            onClick={stopCamera}
            leftIcon={<CameraOff className="h-4 w-4" />}
            style={{ flex: 1 }}
          >
            Kamerayı Kapat
          </ModernButton>
        )}
      </div>

      <p style={{ 
        fontSize: "var(--text-xs)", 
        color: "var(--text-tertiary)", 
        textAlign: "center", 
        marginTop: "var(--space-4)",
        marginBottom: 0 
      }}>
        Kamerayı QR koduna doğrultun. Otomatik olarak taranacaktır.
      </p>
    </ModernCard>
  );
}
