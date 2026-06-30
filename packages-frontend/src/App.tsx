import { useEffect, useState } from "react";
import { WagmiProvider, useConnect, useAccount, useDisconnect, useReadContract, useWriteContract, useWatchContractEvent } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseEther } from "viem";
import { config } from "./config";
import * as kontrakData from "./abis/DigitalGoodsStoreABI.json";
import { WHITELABEL_PRODUCTS, type Product } from "./products";

const queryClient = new QueryClient();

interface DbLog {
  buyer: string;
  tokenId: string;
  productId: string;
  timestamp: string;
  txHash: string;
  currencyMethod: string;
}

const cardThemes: Record<number, { bg: string; border: string }> = {
  1: { bg: "#eff6ff", border: "#bfdbfe" }, 
  2: { bg: "#f5f3ff", border: "#ddd6fe" }, 
  3: { bg: "#ecfdf5", border: "#a7f3d0" }  
};

function MainApp() {
  const [parsedAbi, setParsedAbi] = useState<any>(null);

  const [adminProductId, setAdminProductId] = useState<string>("1");
  const [adminPrice, setAdminPrice] = useState<string>("0.05");

  // State untuk Rig Pembayaran Fiat Global
  const [fiatProductId, setFiatProductId] = useState<string>("3");
  const [fiatPaymentStatus, setFiatPaymentStatus] = useState<string>("IDLE");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD"); 

  const [dbLogs, setDbLogs] = useState<DbLog[]>([]);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  
  // 🏪 State Mengontrol Pop-up Barcode QRIS Indonesia
  const [showQrisModal, setShowQrisModal] = useState<boolean>(false);
  
  // 🔗 STATE BARU: Menampung URL QRIS Asli yang Dikirim dari Backend Server Lu
  const [dynamicQrisUrl, setDynamicQrisUrl] = useState<string>("");
  const [isFetchingQris, setIsFetchingQris] = useState<boolean>(false);

  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();

  const { writeContract, isPending: isTxPending, error: txError, data: txHash } = useWriteContract();
  const currentContractAddress = import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined;

  const ETH_TO_USD_RATE = 3500;
  const ETH_TO_IDR_RATE = 54000000;

  const fallbackQrisUrl = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=WhitelabelGatewaySettlementSimulation";

  useEffect(() => {
    let finalAbi: any = null;
    if (kontrakData && (kontrakData as any).abi) {
      finalAbi = (kontrakData as any).abi;
    } else if (kontrakData && (kontrakData as any).default && (kontrakData as any).default.abi) {
      finalAbi = (kontrakData as any).default.abi;
    }
    if (finalAbi) setParsedAbi(finalAbi);
  }, []);

  const { data: storeName } = useReadContract({
    address: currentContractAddress,
    abi: parsedAbi || [],
    functionName: "name",
    query: { enabled: !!parsedAbi && !!currentContractAddress }
  });

  useWatchContractEvent({
    address: currentContractAddress,
    abi: parsedAbi || [],
    eventName: "NFTOwnershipMinted",
    onLogs(logs: any[]) {
      if (!logs || !Array.isArray(logs)) return;
      logs.forEach((log) => {
        const args = log.args;
        if (args) {
          const buyerAddr = args.buyer ? String(args.buyer) : "Unknown Wallet";
          const tokenNum = args.tokenId ? String(args.tokenId) : "0";
          const productNum = args.productId ? String(args.productId) : "0";
          
          const newLog: DbLog = {
            buyer: buyerAddr,
            tokenId: tokenNum,
            productId: productNum,
            timestamp: new Date().toLocaleTimeString(),
            txHash: log.transactionHash || "0x...",
            currencyMethod: selectedCurrency === "USD" ? "USD Credit Card (Stripe)" : "IDR QRIS / e-Wallet"
          };
          setDbLogs((prev) => [newLog, ...prev]);
        }
      });
    },
  });

  // 🔌 ENGINE KONEKSI WALLET MUTAKHIR DENGAN DEEP LINK OTOMATIS UNTUK HP
  const handleConnectWallet = async (connector: any) => {
    if (!connector) return;
    const cName = connector.name ? connector.name.toLowerCase() : "";
    const cId = connector.id ? connector.id.toLowerCase() : "";
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    try {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        connect({ connector });
        return;
      }

      // 🔥 AUTO DEEP-LINK REDIRECT JIKA DIBUKA DI CHROME/SAFARI HP BIASA
      if (isMobile) {
        const cleanUrl = window.location.href.replace(/^https?:\/\//, "");

        if (cName.includes("metamask") || cId.includes("metamask")) {
          window.location.href = `https://metamask.app.link/dapp/${cleanUrl}`;
          return;
        }
        if (cName.includes("phantom") || cId.includes("phantom")) {
          window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`;
          return;
        }
      }

      connect({ connector });
    } catch (err: any) {
      alert("Gagal memicu operasi koneksi wallet: " + err.message);
    }
  };

  const downloadQris = async () => {
    const targetUrl = dynamicQrisUrl || fallbackQrisUrl;
    try {
      const response = await fetch(targetUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `QRIS-Whitelabel-Gateway-SKU0${fiatProductId}.png`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.open(targetUrl, "_blank");
    }
  };

  const handleSetPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAbi || !currentContractAddress) {
      alert("❌ Gagal: ABI Kontrak atau Alamat Kontrak Pintar belum dimuat di Panel Manajemen.");
      return;
    }
    writeContract({
      address: currentContractAddress,
      abi: parsedAbi,
      functionName: "setProductPrice",
      args: [BigInt(adminProductId), parseEther(adminPrice)],
    });
  };

  // 🔥 UPDATE INTEGRASI: Menembak buyDigitalGood dengan argumen dan nominal ETH yang pas
  const handleDirectBuy = (id: any, priceEth: any) => {
    if (!isConnected || !address) {
      setIsWalletModalOpen(true);
      return;
    }

    if (!parsedAbi || !currentContractAddress) {
      alert(`❌ EKSEKUSI WEB3 DIBLOKIR!\n\nDetail Kerusakan Sistem:\n- ABI Kontrak Data: ${parsedAbi ? "🟢 OK (Terbaca)" : "🔴 ERROR (Kosong/Gagal Load)"}\n- Alamat Kontrak Pintar: ${currentContractAddress ? "🟢 OK (Terbaca)" : "🔴 ERROR (Kosong/Undefined)"}\n\nSolusi Bosku:\nPeriksa file .env lokal Anda atau masukkan 'VITE_CONTRACT_ADDRESS' di dashboard Environment Variables Vercel lalu redeploy!`);
      return;
    }

    const dummyAwsTokenUri = `https://aws-s3-digital-goods-store.com/metadata/product-${id}.json`;
    
    writeContract({
      address: currentContractAddress,
      abi: parsedAbi,
      functionName: "buyDigitalGood",
      args: [BigInt(id), dummyAwsTokenUri],
      value: parseEther(String(priceEth)),
    });
  };

  const executeOnChainRelayMint = () => {
    let targetDeliveryAddress = address ? address : "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5";

    if (!parsedAbi || !currentContractAddress) {
      alert("Peringatan: Konfigurasi ABI kontrak pintar belum siap dimuat di latar belakang!");
      setShowQrisModal(false); 
      return;
    }

    setShowQrisModal(false);
    setFiatPaymentStatus("PROCESSING");

    setTimeout(() => {
      setFiatPaymentStatus("SUCCESS");
      const dummyAwsTokenUri = `https://aws-s3-digital-goods-store.com/metadata/fiat-global-${fiatProductId}.json`;

      writeContract({
        address: currentContractAddress,
        abi: parsedAbi,
        functionName: "mintForFiatBuyer",
        args: [targetDeliveryAddress as `0x${string}`, dummyAwsTokenUri, BigInt(fiatProductId)],
      });
    }, 1500);
  };

  const handleFiatSimulationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedProductData = (WHITELABEL_PRODUCTS || []).find(p => p.id === Number(fiatProductId));
    const productPriceEth = selectedProductData ? Number(selectedProductData.defaultPriceEth) : 0.05;
    const priceInIdr = Math.round(productPriceEth * ETH_TO_IDR_RATE);

    if (selectedCurrency === "IDR") {
      setIsFetchingQris(true);
      try {
        const response = await fetch("/api/charge-qris", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: fiatProductId,
            amountIdr: priceInIdr
          })
        });
        
        const data = await response.json();
        
        if (data && data.success && data.qrUrl) {
          setDynamicQrisUrl(data.qrUrl); 
          console.log("🎯 Sukses! QRIS Midtrans Berhasil Masuk:", data.qrUrl);
        } else {
          setDynamicQrisUrl(fallbackQrisUrl);
          alert("❌ Vercel Serverless merespon tapi Midtrans menolak!\nPesan: " + JSON.stringify(data));
        }
      } catch (err: any) {
        console.warn("Koneksi tersumbat sebelum sampai ke API Vercel...", err);
        setDynamicQrisUrl(fallbackQrisUrl);
        alert("⚠️ KONEKSI VERCEL API GAGAL!\nDetail: " + err.message);
      } finally {
        setIsFetchingQris(false);
        setShowQrisModal(true); 
      }
      return; 
    }

    executeOnChainRelayMint();
  };

  const selectedProductData = (WHITELABEL_PRODUCTS || []).find(p => p.id === Number(fiatProductId));
  const productPriceEth = selectedProductData ? Number(selectedProductData.defaultPriceEth) : 0.05;
  const convertedFiatPrice = selectedCurrency === "USD" 
    ? `$${(productPriceEth * ETH_TO_USD_RATE).toFixed(2)} USD`
    : `Rp ${(productPriceEth * ETH_TO_IDR_RATE).toLocaleString("id-ID")}`;

  const walletAddressStr = address ? String(address) : "";

  return (
    <div style={{ 
      backgroundColor: "#fafafa", 
      color: "#111827", 
      minHeight: "100vh", 
      width: "100%", 
      padding: "50px 20px", 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
      maxWidth: "1100px", 
      margin: "0 auto",
      boxSizing: "border-box" 
    }}>
      
      {/* NAVBAR HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "24px", marginBottom: "35px", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: "#111827" }}>🏪 {storeName ? String(storeName) : "Web3 Digital Core"}</h1>
          <p style={{ margin: "6px 0 0 0", fontSize: "14px", color: "#6b7280" }}>Enterprise Hybrid B2B Whitelabel Gateway</p>
        </div>
        
        <div>
          {isConnected && walletAddressStr ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "13px", background: "#111827", color: "#ffffff", padding: "8px 14px", borderRadius: "30px", fontWeight: 600 }}>
                • Wallet Connected: {`${walletAddressStr.slice(0, 6)}...${walletAddressStr.slice(-4)}`}
              </span>
              <button onClick={() => disconnect()} style={{ background: "#ef4444", color: "white", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Sign Out</button>
            </div>
          ) : (
            <button 
              onClick={() => setIsWalletModalOpen(true)} 
              style={{ background: "#2563eb", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", boxShadow: "0 4px 10px rgba(37,99,235,0.2)" }}
            >
              🔌 Connect Provider Wallet
            </button>
          )}
        </div>
      </div>

      {/* 📥 FLOATING OVERLAY MODAL */}
      {isWalletModalOpen && !isConnected && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "35px", borderRadius: "20px", width: "100%", maxWidth: "340px", textAlign: "center", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <span style={{ fontWeight: 700, fontSize: "16px", color: "#111827" }}>🔌 Select Web3 Wallet</span>
              <button type="button" onClick={() => setIsWalletModalOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "22px", lineHeight: 1.4 }}>Pilih salah satu penyedia enkripsi di bawah untuk mengaktifkan tanda tangan kriptografi.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {(connectors || []).map((connector) => {
                let displayWalletName = connector.name || "Injected Node";
                if (displayWalletName.toLowerCase() === "injected") displayWalletName = "Browser Default Extension";
                
                return (
                  <button 
                    key={connector.uid} 
                    onClick={() => {
                      handleConnectWallet(connector);
                      setIsWalletModalOpen(false);
                    }} 
                    style={{ 
                      background: "#f9fafb", 
                      color: "#111827", 
                      border: "1px solid #e5e7eb", 
                      padding: "14px", 
                      borderRadius: "12px", 
                      cursor: "pointer", 
                      fontWeight: 700, 
                      fontSize: "14px",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}
                  >
                    <span>🚀 {displayWalletName}</span>
                    <span style={{ fontSize: "11px", color: "#2563eb", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>Launch</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 📥 DYNAMIC POP-UP MODAL QRIS INDONESIA */}
      {showQrisModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 99999 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "35px", borderRadius: "20px", width: "100%", maxWidth: "380px", textAlign: "center", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <span style={{ fontWeight: 700, color: "#e04f1a", fontSize: "15px", letterSpacing: "0.03em" }}>GPN / QRIS STANDAR NASIONAL</span>
              <button type="button" onClick={() => setShowQrisModal(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            
            <p style={{ fontSize: "13px", color: "#4b5563", margin: "0 0 20px 0", lineHeight: 1.5 }}>Pindai kode QR di bawah menggunakan GoPay, OVO, Dana, ShopeePay, atau Mobile Banking untuk melunasi lisensi digital B2B.</p>
            
            <div style={{ background: "#ffffff", padding: "16px", borderRadius: "14px", display: "inline-block", border: "1px solid #e5e7eb" }}>
              <img src={dynamicQrisUrl || fallbackQrisUrl} alt="QRIS Core Engine" width="190" height="190" />
            </div>

            <div style={{ marginTop: "12px" }}>
              <button type="button" onClick={downloadQris} style={{ background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>
                💾 Unduh Kode QRIS
              </button>
            </div>

            <div style={{ background: "#fef3c7", color: "#92400e", padding: "12px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, margin: "20px 0" }}>
              Total Tagihan: {convertedFiatPrice}
            </div>

            <button type="button" onClick={executeOnChainRelayMint} style={{ width: "100%", background: "#10b981", color: "#ffffff", border: "none", padding: "14px", borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "14px" }}>
              Konfirmasi Pembayaran Sukses (Simulasi)
            </button>
          </div>
        </div>
      )}

      {/* TRANSACTIONS BROADCAST MONITOR */}
      {(isTxPending || txHash || txError || connectError || fiatPaymentStatus === "PROCESSING") && (
        <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", marginBottom: "35px", border: "1px solid #e5e7eb" }}>
          <h4 style={{ marginTop: 0, marginBottom: "8px", fontWeight: 700, fontSize: "14px", textTransform: "uppercase", color: "#4b5563" }}>⚡ System Broadcast Monitor:</h4>
          {fiatPaymentStatus === "PROCESSING" && <p style={{ color: "#2563eb", margin: 0, fontSize: "14px", fontWeight: 500 }}>⏳ Awaiting confirmation...</p>}
          {isTxPending && <p style={{ color: "#d97706", margin: 0, fontSize: "14px", fontWeight: 500 }}>⏳ Processing node signature approval...</p>}
          {txHash && <p style={{ color: "#059669", margin: 0, fontSize: "14px", fontWeight: 600, wordBreak: "break-all" }}>✅ Settled! Tx Hash: <code>{txHash}</code></p>}
          {connectError && <p style={{ color: "#dc2626", margin: 0, fontSize: "14px", fontWeight: 500 }}>❌ Connection Error: {connectError.message}</p>}
          {txError && (
  <p style={{ color: "#dc2626", margin: 0, fontSize: "14px", fontWeight: 500 }}>
    ❌ Smart Contract Error: {
      txError.message.includes("Approval Denied") || txError.message.includes("User rejected")
        ? "Transaksi dibatalkan oleh pengguna (Approval Denied)."
        : txError.message.split("\n")[0] // Kalau eror kode lain, ambil baris pertamanya saja biar pendek
    }
  </p>
)}
        </div>
      )}

      {/* 👑 SOLUTIONS MARKETPLACE */}
      <div style={{ marginBottom: "50px" }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: 700, color: "#111827" }}>🛒 B2B Digital Solutions Catalog</h3>
        <p style={{ margin: "0 0 25px 0", fontSize: "14px", color: "#6b7280" }}>Direct on-chain procurement infrastructure for enterprise infrastructure items.</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
          {(WHITELABEL_PRODUCTS || []).map((prod: Product) => {
            const priceEth = prod.defaultPriceEth || "0.05";
            const priceUsd = (Number(priceEth) * ETH_TO_USD_RATE).toFixed(0);
            const priceIdr = (Number(priceEth) * ETH_TO_IDR_RATE).toLocaleString("id-ID");
            const cardTheme = cardThemes[prod.id] || { bg: "#ffffff", border: "#e5e7eb" };

            return (
              <div 
                key={prod.id} 
                style={{
                  background: cardTheme.bg,
                  border: `1px solid ${cardTheme.border}`,
                  borderRadius: "16px",
                  padding: "26px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxSizing: "border-box"
                }}
              >
                <div>
                  {/* SKU ID Badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ background: "#ffffff", color: "#1f2937", padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, border: `1px solid ${cardTheme.border}` }}>
                      SKU-0{prod.id}
                    </span>
                    <span style={{ color: isConnected ? "#10b981" : "#ef4444", fontSize: "12px", fontWeight: 600 }}>
                      ● {isConnected ? "Network Live" : "Secure Blocked"}
                    </span>
                  </div>

                  <h4 style={{ margin: "18px 0 8px 0", fontSize: "18px", fontWeight: 700, color: "#111827", lineHeight: 1.4 }}>
                    {prod.name}
                  </h4>

                  <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#4b5563", lineHeight: 1.5 }}>
                    {prod.description || "Enterprise whitelabel licensing block module complete with decentralized metadata distribution."}
                  </p>
                </div>

                <div>
                  {/* 🛡️ GUARD INTEGRITAS DATA BLOCKCHAIN */}
                  <div style={{ 
                    background: isConnected ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.06)", 
                    border: `1px solid ${isConnected ? "#a7f3d0" : "#fca5a5"}`, 
                    borderRadius: "10px", 
                    padding: "10px 12px", 
                    marginBottom: "15px", 
                    fontSize: "12px" 
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600, color: "#4b5563" }}>Address Integrity:</span>
                      <span style={{ fontWeight: 700, color: isConnected ? "#047857" : "#b91c1c" }}>
                        {isConnected ? "🟢 VERIFIED" : "🔴 UNVERIFIED"}
                      </span>
                    </div>
                    <div style={{ color: "#4b5563", fontSize: "11px", fontFamily: "monospace", lineHeight: 1.4 }}>
                      {isConnected && walletAddressStr ? (
                        <>
                          <strong>Node:</strong> {`${walletAddressStr.slice(0, 10)}...${walletAddressStr.slice(-10)}`}<br />
                          <strong>Format:</strong> ECDSA Compliant Hex ✓
                        </>
                      ) : (
                        "Warning: No valid Web3 node wallet detected. Route locked."
                      )}
                    </div>
                  </div>

                  {/* Elegant Dynamic Pricing Grid */}
                  <div style={{ borderTop: `1px solid ${cardTheme.border}`, paddingTop: "16px", marginBottom: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 800, color: "#111827" }}>{priceEth} ETH</span>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>${priceUsd} USD</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 500 }}>
                      Equiv. value: Rp {priceIdr} IDR
                    </div>
                  </div>

                  {/* 🎮 BUTTON REAKTIF DEEP LINK WALLET */}
                  <button
                    type="button"
                    disabled={isTxPending}
                    onClick={() => {
                      if (!isConnected) {
                        setIsWalletModalOpen(true);
                      } else {
                        handleDirectBuy(prod.id, priceEth);
                      }
                    }}
                    style={{
                      width: "100%",
                      background: !isConnected ? "#111827" : isTxPending ? "#6b7280" : "#2563eb",
                      color: "#ffffff",
                      border: "none",
                      padding: "13px 0",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {!isConnected ? "🔌 Connect Wallet to Buy" : isTxPending ? "⏳ Authorizing Ledger..." : "⚡ Purchase via Web3 Node"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: "25px", flexWrap: "wrap", marginBottom: "40px" }}>
        
        {/* 📊 KOTAK GLOBAL DATABASE ORDER LOGS */}
        <div style={{ background: "#f0f7ff", padding: "25px", borderRadius: "14px", border: "1px solid #3b82f6", flex: "1", minWidth: "300px" }}>
          <h3 style={{ marginTop: 0, color: "#1d4ed8", fontSize: "17px", fontWeight: 700 }}>📊 Global Database Order Logs</h3>
          <p style={{ fontSize: "13px", color: "#2563eb", marginTop: "-4px" }}>Unified dashboard recording incoming cross-border settlement event emissions.</p>
          
          <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
            {dbLogs.length === 0 ? (
              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "8px", textAlign: "center", color: "#9ca3af", border: "1px dashed #bfdbfe", fontSize: "13px" }}>
                📭 No dynamic billing data synchronized yet.
              </div>
            ) : (
              (dbLogs || []).map((log: DbLog, index: number) => (
                <div key={index} style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #bfdbfe", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 700, color: "#059669" }}>📩 Token ID: #{log.tokenId} Settled</span>
                    <span style={{ color: "#9ca3af" }}>{log.timestamp}</span>
                  </div>
                  <p style={{ margin: "3px 0" }}><strong>SKU Linked:</strong> Solutions SKU-0{log.productId}</p>
                  <p style={{ margin: "3px 0" }}><strong>Gateway Route:</strong> <span style={{ background: "#e5e7eb", color: "#1f2937", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 600 }}>{log.currencyMethod}</span></p>
                  <p style={{ margin: "3px 0", wordBreak: "break-all", color: "#4b5563" }}><strong>Holder Asset Address:</strong> <code>{log.buyer}</code></p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 💳 KOTAK HYBRID INTERNATIONAL FIAT SETTLEMENT ENGINE */}
        <div style={{ background: "#fff7ed", padding: "25px", borderRadius: "14px", border: "1px solid #f97316", flex: "1", minWidth: "300px" }}>
          <h3 style={{ marginTop: 0, color: "#c2410c", fontSize: "17px", fontWeight: 700 }}>💳 Hybrid International Fiat Settlement Engine</h3>
          <p style={{ fontSize: "13px", color: "#ea580c", marginTop: "-4px" }}>Simulates Stripe Credit Card (USD) or localized QRIS (IDR) triggering automated relay mints.</p>
          
          <form onSubmit={handleFiatSimulationSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "15px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "6px", color: "#4b5563" }}>1. Choose Target Currency Option:</label>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "#111827" }}>
                  <input type="radio" name="currency" value="USD" checked={selectedCurrency === "USD"} onChange={() => setSelectedCurrency("USD")} style={{ marginRight: "6px" }} />
                  🇺🇸 United States Dollar (USD)
                </label>
                <label style={{ fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "#111827" }}>
                  <input type="radio" name="currency" value="IDR" checked={selectedCurrency === "IDR"} onChange={() => setSelectedCurrency("IDR")} style={{ marginRight: "6px" }} />
                  🇮🇩 Indonesian Rupiah (IDR)
                </label>
              </div>
            </div>

            {selectedCurrency === "IDR" ? (
              <div style={{ marginTop: "4px", padding: "12px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #fed7aa", fontSize: "12px", color: "#c2410c", fontWeight: 600 }}>
                🎯 <strong>Lokal QRIS Aktif:</strong> Klik tombol simulasi di bawah untuk langsung memunculkan Barcode Pembayaran Nasional Instan.
              </div>
            ) : (
              <div style={{ marginTop: "4px", backgroundColor: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #fed7aa" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "6px", color: "#111827" }}>💳 MoonPay / Stripe Secured Credit Card Inputs:</label>
                <input type="text" placeholder="Card Number" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px", marginBottom: "8px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <input type="text" placeholder="MM / YY" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
                  <input type="password" placeholder="CVC" maxLength={3} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px", color: "#4b5563" }}>3. Select Solutions Product:</label>
              <select value={fiatProductId} onChange={(e) => setFiatProductId(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }}>
                {(WHITELABEL_PRODUCTS || []).map((p: Product) => (
                  <option key={p.id} value={p.id} style={{ backgroundColor: "#ffffff", color: "#111827" }}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #fed7aa", fontSize: "13px", margin: "4px 0", color: "#111827" }}>
              <strong>Calculated Billing Value:</strong> <span style={{ color: "#c2410c", fontWeight: 700 }}>{convertedFiatPrice}</span>
            </div>

            <button type="submit" disabled={fiatPaymentStatus === "PROCESSING" || isFetchingQris} style={{ width: "100%", background: "#f97316", color: "white", border: "none", padding: "12px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>
              {isFetchingQris ? "Membuka Gerbang API Midtrans..." : `Simulate Successful Checkout via ${selectedCurrency}`}
            </button>
          </form>
        </div>

      </div>

      {/* INTERNAL MANAGEMENT CONTROL */}
      <div style={{ background: "#fdf4ff", padding: "25px", borderRadius: "14px", border: "1px solid #d946ef" }}>
        <h3 style={{ marginTop: 0, color: "#a21caf", fontSize: "16px", fontWeight: 700 }}>🛠️ Internal Management Panel (Operator Only)</h3>
        <form onSubmit={handleSetPrice} style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "end" }}>
          <div style={{ flex: "1", minWidth: "150px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "#4b5563" }}>Product Target ID:</label>
            <input type="number" value={adminProductId} onChange={(e) => setAdminProductId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
          </div>
          <div style={{ flex: "1", minWidth: "150px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "#4b5563" }}>New Ledger Rate (ETH):</label>
            <input type="text" value={adminPrice} onChange={(e) => setAdminPrice(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
          </div>
          <button type="submit" disabled={!isConnected || isTxPending} style={{ background: "#d946ef", color: "white", border: "none", padding: "11px 22px", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
            Override Price Rate
          </button>
        </form>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MainApp />
      </QueryClientProvider>
    </WagmiProvider>
  );
}