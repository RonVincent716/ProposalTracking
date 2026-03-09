const sidebarStyle = {
  width: 220,
  background: "#1976D2",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const sidebarBtn = (active) => ({
  padding: 10,
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  background: active ? "#1565C0" : "transparent",
  color: "#fff",
  textAlign: "left",
});

export default function Sidebar({ activeTab, setActiveTab, onLogout }) {
  return (
    <div style={sidebarStyle}>
      <h2 style={{ color: "#fff" }}>Admin</h2>

      <button style={sidebarBtn(activeTab === "home")} onClick={() => setActiveTab("home")}>
        Dashboard
      </button>

      <button style={sidebarBtn(activeTab === "proposals")} onClick={() => setActiveTab("proposals")}>
        Proposals
      </button>

      <button style={sidebarBtn(activeTab === "upload")} onClick={() => setActiveTab("upload")}>
        Upload Proposal
      </button>

      <button style={sidebarBtn(activeTab === "views")} onClick={() => setActiveTab("views")}>
        Live Views
      </button>

      <button
        onClick={onLogout}
        style={{
          marginTop: "auto",
          padding: 10,
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          background: "#e53935",
          color: "#fff",
        }}
      >
        Logout
      </button>
    </div>
  );
}