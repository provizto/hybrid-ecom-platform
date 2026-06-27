{/* NAVBAR HEADER */}
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e1e8ed", paddingBottom: "20px", marginBottom: "30px" }}>
  <div>
    <h1 style={{ margin: 0, fontSize: "24px", color: "#0f1419" }}>🏪 {storeName ? String(storeName) : "Web3 Digital Core"}</h1>
    <p style={{ margin: "5px 0 0 0", fontSize: "13px", color: "#657786" }}>Enterprise Hybrid B2B Whitelabel Gateway</p>
  </div>
  
  <div>
    {isConnected ? (
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "13px", background: "#e8f5e9", color: "#2e7d32", padding: "6px 12px", borderRadius: "20px", fontWeight: "bold" }}>
          Connected: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
        </span>
        <button onClick={() => disconnect()} style={{ background: "#ff4d4d", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>Sign Out</button>
      </div>
    ) : (
      /* 🔌 HANYA SATU TOMBOL INI YANG BOLEH ADA DI NAVBAR */
      <button 
        onClick={() => setIsWalletModalOpen(true)} 
        style={{ background: "#0070f3", color: "white", border: "none", padding: "10px 18px", borderRadius: "25px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", boxShadow: "0 4px 6px rgba(0,112,243,0.2)" }}
      >
        🔌 Connect Wallet
      </button>
    )}
  </div>
</div>