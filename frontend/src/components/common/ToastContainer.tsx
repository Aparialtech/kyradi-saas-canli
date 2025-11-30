interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: "info" | "success" | "error";
}

interface ToastContainerProps {
  messages: ToastMessage[];
}

const colors: Record<NonNullable<ToastMessage["type"]>, string> = {
  info: "#0369a1",
  success: "#15803d",
  error: "#dc2626",
};

export function ToastContainer({ messages }: ToastContainerProps) {
  if (messages.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "1.5rem",
        right: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        zIndex: 1000,
      }}
    >
      {messages.map((toast) => {
        const borderColor = colors[toast.type ?? "info"];
        return (
          <div
            key={toast.id}
            style={{
              minWidth: "220px",
              maxWidth: "320px",
              padding: "0.75rem 1rem",
              borderRadius: "10px",
              background: "#fff",
              boxShadow: "0 10px 20px rgba(15,23,42,0.12)",
              borderLeft: `4px solid ${borderColor}`,
            }}
          >
            <div style={{ fontWeight: 600, color: borderColor }}>{toast.title}</div>
            {toast.description && (
              <div style={{ marginTop: "0.3rem", color: "#475569", fontSize: "0.85rem" }}>
                {toast.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
