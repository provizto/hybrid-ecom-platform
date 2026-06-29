import { useEffect, useState } from "react";
import { WagmiProvider, useConnect, useAccount, useDisconnect, useReadContract, useWriteContract, useWatchContractEvent } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseEther } from "viem";
import { config } from "./config";
import * as kontrakData from "./abis/DigitalGoodsStoreABI.json";
import { WHITELABEL_PRODUCTS, type Product } from "./products";
import { ProductCard } from "./ProductCard";

const queryClient = new QueryClient();

interface DbLog {
  buyer: string;
  tokenId: string;
  productId: string;
  timestamp: string;
  txHash: string;
  currencyMethod: string;
}

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

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const { writeContract, isPending: isTxPending, error: txError, data: txHash } = useWriteContract();
  const currentContractAddress = import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined;

  const ETH_TO_USD_RATE = 3500;
  const ETH_TO_IDR_RATE = 54000000;

  const qrisImageUrl = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=WhitelabelGatewaySettlementSimulation";

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

  // 🛡️ STRATEGI UPGRADE: Eksekutor Pelindung Tombol Injected Universal & Dompet Konflik
  const handleConnectWallet = async (connector: any) => {
    const cName = connector.name.toLowerCase();
    const cId = connector.id.toLowerCase();

    try {
      // 🔌 JALUR INTERSEPTOR TOTAL TOMBOL INJECTED & UNIVERSAL
      if (cName.includes("injected") || cId.includes("injected") || cId.includes("browser")) {
        if (typeof window !== "undefined" && (window as any).ethereum) {
          await (window as any).ethereum.request({ method: "eth_requestAccounts" });
          connect({ connector });
          return;
        }
      }

      // Jalur Interseptor Khusus Ekstensi Phantom
      if (cName.includes("phantom") || cId.includes("phantom")) {
        if (typeof window !== "undefined" && (window as any).phantom?.ethereum) {
          const phantomProvider = (window as any).phantom.ethereum;
          await phantomProvider.request({ method: "eth_requestAccounts" });
          connect({ connector });
          return;
        }
      }

      // Jalur Deteksi Array Multi-Provider (Jika banyak wallet terinstal berdampingan)
      if (typeof window !== "undefined" && (window as any).ethereum?.providers?.length) {
        const providers = (window as any).ethereum.providers;
        let matchedProvider = null;

        if (cName.includes("phantom")) matchedProvider = providers.find((p: any) => p.isPhantom);
        else if (cName.includes("metamask")) matchedProvider = providers.find((p: any) => p.isMetaMask);
        else if (cName.includes("backpack")) matchedProvider = providers.find((p: any) => p.isBackpack);

        if (matchedProvider) {
          await matchedProvider.request({ method: "eth_requestAccounts" });
          connect({ connector });
          return;
        }
      }

      connect({ connector });
    } catch (err) {
      console.warn("Wagmi connection split triggered...", err);
      if (typeof window !== "undefined" && (window as any).ethereum) {
        try {
          await (window as any).ethereum.request({ method: "eth_requestAccounts" });
          connect({ connector });
        } catch (fallbackErr) {
          alert("Gagal memanggil dompet eksternal. Silakan buka dari dApp Browser internal dompet HP Anda!");
        }
      }
    }
  };

  const downloadQris = async () => {
    try {
      const response = await fetch(qrisImageUrl);
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
      window.open(qrisImageUrl, "_blank");
    }
  };

  const handleSetPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAbi || !currentContractAddress) return;
    writeContract({
      address: currentContractAddress,
      abi: parsedAbi,
      functionName: "setProductPrice",
      args: [BigInt(adminProductId), parseEther(adminPrice)],
    });
  };

  const handleDirectBuy = (id: any, _priceEth: any) => {
    if (!isConnected || !address) {
      setIsWalletModalOpen(true);
      return;
    }
    if (!parsedAbi || !currentContractAddress) return;
    const dummyAwsTokenUri = `https://aws-s3-digital-goods-store.com/metadata/product-${id}.json`;
    writeContract({
      address: currentContractAddress,
      abi: parsedAbi,
      functionName: "mintForFiatBuyer",
      args: [address, dummyAwsTokenUri, BigInt(id)],
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

  const handleFiatSimulationSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCurrency === "IDR") {
      setShowQrisModal(true);
      return; 
    }

    executeOnChainRelayMint();
  };

  const selectedProductData = WHITELABEL_PRODUCTS.find(p => p.id === Number(fiatProductId));
  const productPriceEth = selectedProductData ? Number(selectedProductData.defaultPriceEth) : 0.05;
  const convertedFiatPrice = selectedCurrency === "USD" 
    ? `$${(productPriceEth * ETH_TO_USD_RATE).toFixed(2)} USD`
    : `Rp ${(productPriceEth * ETH_TO_IDR_RATE).toLocaleString("id-ID")}`;

  return (
    <div style={{ 
      backgroundColor: "#fff9f1", 
      color: "#1c1e21", 
      minHeight: "100vh", 
      width: "100%", 
      padding: "40px 20px", 
      fontFamily: "sans-serif", 
      maxWidth: "1000px", 
      margin: "0 auto",
      boxSizing: "border-box" 
    }}>
      
      {/* NAVBAR HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e1e8ed", paddingBottom: "20px", marginBottom: "30px", flexWrap: "wrap", gap: "15px" }}>
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
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {connectors.map((connector) => (
                <button 
                  key={connector.uid} 
                  onClick={() => handleConnectWallet(connector)} 
                  style={{ 
                    background: "#0070f3", 
                    color: "white", 
                    border: "none", 
                    padding: "10px 16px", 
                    borderRadius: "8px", 
                    cursor: "pointer", 
                    fontWeight: "bold", 
                    fontSize: "13px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                >
                  Connect {connector.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 📥 DYNAMIC POP-UP MODAL QRIS INDONESIA */}
      {showQrisModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 99999 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "30px", borderRadius: "16px", width: "100%", maxWidth: "360px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <span style={{ fontWeight: "bold", color: "#d9480f", fontSize: "16px" }}>GPN / QRIS STANDAR NASIONAL</span>
              <button type="button" onClick={() => setShowQrisModal(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#888" }}>✕</button>
            </div>
            
            <p style={{ fontSize: "13px", color: "#495057", margin: "0 0 15px 0" }}>Pindai kode QR di bawah menggunakan GoPay, OVO, Dana, ShopeePay, atau Mobile Banking untuk melunasi lisensi digital B2B.</p>
            
            <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "10px", display: "inline-block", border: "2px solid #e9ecef" }}>
              <img src={qrisImageUrl} alt="QRIS Core Engine" width="180" height="180" />
            </div>

            <div style={{ marginTop: "10px" }}>
              <button 
                type="button" 
                onClick={downloadQris} 
                style={{ 
                  background: "#3b82f6", 
                  color: "#ffffff", 
                  border: "none", 
                  padding: "6px 14px", 
                  borderRadius: "6px", 
                  cursor: "pointer", 
                  fontWeight: "bold", 
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px"
                }}
              >
                💾 Unduh Kode QRIS
              </button>
            </div>

            <div style={{ background: "#fff3cd", color: "#856404", padding: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: "bold", margin: "15px 0" }}>
              Total Tagihan: {convertedFiatPrice}
            </div>

            <button type="button" onClick={executeOnChainRelayMint} style={{ width: "100%", background: "#10b981", color: "#ffffff", border: "none", padding: "12px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" }}>
              Konfirmasi Pembayaran Sukses (Simulasi)
            </button>
          </div>
        </div>
      )}

      {/* BANNER PERINGATAN KONEKSI DOMPET MOBIL */}
      {isWalletModalOpen && !isConnected && (
        <div style={{ background: "#fff3cd", padding: "12px", borderRadius: "8px", marginBottom: "20px", fontSize: "13px", color: "#856404", border: "1px solid #ffeeba" }}>
          💡 <strong>Petunjuk Koneksi:</strong> Ketuk salah satu tombol dompet di bar navigasi atas. Jika menggunakan HP, pastikan tautan ini dibuka di dalam menu browser internal aplikasi MetaMask/Backpack/Phantom Anda.
        </div>
      )}

      {/* TRANSACTIONS BROADCAST MONITOR */}
      {(isTxPending || txHash || txError || fiatPaymentStatus === "PROCESSING") && (
        <div style={{ background: "#ffffff", padding: "15px", borderRadius: "8px", marginBottom: "30px", border: "1px solid #dee2e6" }}>
          <h4 style={{ marginTop: 0, marginBottom: "5px" }}>⚡ System Broadcast Monitor:</h4>
          {fiatPaymentStatus === "PROCESSING" && (
            <p style={{ color: "#1a73e8", margin: 0, fontSize: "14px" }}>
              ⏳ [{selectedCurrency} Gateway] Awaiting remote secure {selectedCurrency} checkout ledger settlement confirmation...
            </p>
          )}
          {isTxPending && <p style={{ color: "orange", margin: 0, fontSize: "14px" }}>⏳ Processing cryptographic node signature approval...</p>}
          {txHash && <p style={{ color: "green", margin: 0, fontSize: "14px", wordBreak: "break-all" }}>✅ Settled! Transaction Hash: <code>{txHash}</code></p>}
          {txError && <p style={{ color: "red", margin: 0, fontSize: "14px" }}>❌ Failed: {txError.message.split("\n")[0]}</p>}
        </div>
      )}

      {/* WEB3 SOLUTIONS MARKETPLACE */}
      <div style={{ marginBottom: "40px" }}>
        <h3 style={{ margin: "0 0 20px 0", fontSize: "20px", color: "#0f1419" }}>🛒 Global Solutions Marketplace (Multi-Chain/Web3 Buy)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "25px" }}>
          {WHITELABEL_PRODUCTS.map((prod: Product) => (
            <ProductCard 
              key={prod.id} 
              product={prod} 
              contractAddress={currentContractAddress} 
              abi={parsedAbi} 
              onBuy={handleDirectBuy}
              isTxPending={isTxPending}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "25px", flexWrap: "wrap", marginBottom: "40px" }}>
        
        {/* OFF-CHAIN CENTRAL DATABASE LEDGER */}
        <div style={{ background: "#e8f0fe", padding: "25px", borderRadius: "12px", border: "1px solid #1a73e8", flex: "1", minWidth: "300px" }}>
          <h3 style={{ marginTop: 0, color: "#1a73e8", fontSize: "17px" }}>📊 Global Database Order Logs</h3>
          <p style={{ fontSize: "12px", color: "#5f6368", marginTop: "-5px" }}>Unified dashboard recording incoming cross-border settlement event emissions.</p>
          
          <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
            {dbLogs.length === 0 ? (
              <div style={{ background: "#ffffff", padding: "15px", borderRadius: "6px", textAlign: "center", color: "#70757a", border: "1px dashed #adceda", fontSize: "13px" }}>
                📭 No dynamic billing data synchronized yet.
              </div>
            ) : (
              dbLogs.map((log: DbLog, index: number) => (
                <div key={index} style={{ background: "#ffffff", padding: "12px", borderRadius: "6px", border: "1px solid #c2e7ff", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ fontWeight: "bold", color: "#188038" }}>📩 Token ID: #{log.tokenId} Settled</span>
                    <span style={{ color: "#70757a" }}>{log.timestamp}</span>
                  </div>
                  <p style={{ margin: "2px 0" }}><strong>SKU Linked:</strong> Solutions SKU-0{log.productId}</p>
                  <p style={{ margin: "2px 0" }}><strong>Gateway Route:</strong> <span style={{ background: "#f1f3f4", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>{log.currencyMethod}</span></p>
                  <p style={{ margin: "2px 0", wordBreak: "break-all" }}><strong>Holder Asset Address:</strong> <code>{log.buyer}</code></p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* REKAYASA GLOBAL FIAT GATEWAY DENGAN SELECTOR USD/IDR */}
        <div style={{ background: "#fff4e6", padding: "25px", borderRadius: "12px", border: "1px solid #fcc419", flex: "1", minWidth: "300px" }}>
          <h3 style={{ marginTop: 0, color: "#e67e22", fontSize: "17px" }}>💳 Hybrid International Fiat Settlement Engine</h3>
          <p style={{ fontSize: "12px", color: "#5f6368", marginTop: "-5px" }}>Simulates Stripe Credit Card (USD) or localized QRIS (IDR) triggering automated relay mints.</p>
          
          <form onSubmit={handleFiatSimulationSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "5px" }}>1. Choose Target Currency Settlement Option:</label>
              <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                <label style={{ fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}>
                  <input type="radio" name="currency" value="USD" checked={selectedCurrency === "USD"} onChange={() => setSelectedCurrency("USD")} style={{ marginRight: "5px" }} />
                  🇺🇸 United States Dollar (USD)
                </label>
                <label style={{ fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}>
                  <input type="radio" name="currency" value="IDR" checked={selectedCurrency === "IDR"} onChange={() => setSelectedCurrency("IDR")} style={{ marginRight: "5px" }} />
                  🇮🇩 Indonesian Rupiah (IDR)
                </label>
              </div>
            </div>

            {selectedCurrency === "IDR" ? (
              <div style={{ marginTop: "5px", padding: "10px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #ffe8cc", fontSize: "12px", color: "#495057" }}>
                🎯 <strong>Lokal QRIS Aktif:</strong> Klik tombol simulasi di bawah untuk langsung memunculkan Barcode Pembayaran Nasional Instan.
              </div>
            ) : (
              /* 💳 INTERFACE UPGRADE: MENGGUNAKAN STABLE CSS GRID UNTUK DISTRIBUSI LAYOUT KARTU KREDIT DI LAYAR HP */
              <div style={{ marginTop: "5px", backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #ffe8cc" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "6px", color: "#d9480f" }}>💳 MoonPay / Stripe Secured Credit Card Inputs:</label>
                <input type="text" placeholder="Card Number (4111 2222 3333 4444)" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "12px", marginBottom: "8px", boxSizing: "border-box" }} required />
                
                {/* 🔒 KUNCI UTAMA: Menggunakan CSS Grid 1fr 1fr agar membagi 50% rata simetris tanpa meleset di HP! */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "4px" }}>
                  <input type="text" placeholder="MM / YY" style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "12px", boxSizing: "border-box" }} required />
                  <input type="password" placeholder="CVC / CVV" maxLength={3} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "12px", boxSizing: "border-box" }} required />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "3px" }}>3. Select Solutions Product:</label>
              <select value={fiatProductId} onChange={(e) => setFiatProductId(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "12px", boxSizing: "border-box" }}>
                {WHITELABEL_PRODUCTS.map((p: Product) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ background: "#fff", padding: "10px", borderRadius: "6px", border: "1px solid #ffe8cc", fontSize: "13px", margin: "5px 0" }}>
              <strong>Calculated Billing Value:</strong> <span style={{ color: "#d9480f", fontWeight: "bold" }}>{convertedFiatPrice}</span> 
              <span style={{ fontSize: "11px", color: "#868e96", marginLeft: "5px" }}>({selectedProductData?.defaultPriceEth} ETH Equiv)</span>
            </div>

            <button type="submit" disabled={fiatPaymentStatus === "PROCESSING"} style={{ width: "100%", background: "#e67e22", color: "white", border: "none", padding: "11px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>
              {fiatPaymentStatus === "PROCESSING" 
                ? `Authorizing Secure ${selectedCurrency} Gateway Flow...` 
                : `Simulate Successful Checkout via ${selectedCurrency}`}
            </button>
          </form>
        </div>

      </div>

      {/* INTERNAL MANAGEMENT CONTROL */}
      <div style={{ background: "#f8f0fc", padding: "25px", borderRadius: "12px", border: "1px solid #da77f2" }}>
        <h3 style={{ marginTop: 0, color: "#ae3ec9", fontSize: "17px" }}>🛠️ Internal Management Panel (Operator Only)</h3>
        <form onSubmit={handleSetPrice} style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "end" }}>
          <div style={{ flex: "1", minWidth: "150px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "5px" }}>Product Target ID:</label>
            <input type="number" value={adminProductId} onChange={(e) => setAdminProductId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }} required />
          </div>
          <div style={{ flex: "1", minWidth: "150px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "5px" }}>New Ledger Rate (ETH):</label>
            <input type="text" value={adminPrice} onChange={(e) => setAdminPrice(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box" }} required />
          </div>
          <button type="submit" disabled={!isConnected || isTxPending} style={{ background: "#ae3ec9", color: "white", border: "none", padding: "11px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>
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