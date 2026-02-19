const containerStyle: React.CSSProperties = {
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f8fafc",
  color: "#475569",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export function FullPageSpinner() {
  return (
    <div style={containerStyle}>
      <span>Loading…</span>
    </div>
  );
}
