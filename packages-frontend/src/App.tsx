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

const cardThemes: Record<number, { bg: string; border: string; accent: string; shadow: string }> = {
  1: { bg: "#ffffff", border: "#2563eb", accent: "#eff6ff", shadow: "0 10px 25px -5px rgba(37, 99, 235, 0.15)" }, 
  2: { bg: "#ffffff", border: "#7c3aed", accent: "#f5f3ff", shadow: "0 10px 25px -5px rgba(124, 58, 237, 0.15)" }, 
  3: { bg: "#ffffff", border: "#059669", accent: "#ecfdf5", shadow: "0 10px 25px -5px rgba(5, 150, 105, 0.15)" }  
};

function MainApp() {
  const [parsedAbi, setParsedAbi] = useState<any>(null);
  const [adminProductId, setAdminProductId] = useState<string>("1");
  const [adminPrice, setAdminPrice] = useState<string>("0.05");

  // RUNTIME HOSTNAME DOMAIN DETECTOR LOGIC
  const [fiatProductId, setFiatProductId] = useState<string>("3");
  const [fiatPaymentStatus, setFiatPaymentStatus] = useState<string>("IDLE");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD"); 
  const [fiatDeliveryAddress, setFiatDeliveryAddress] = useState<string>("");

  const [onboardingStrategy, setOnboardingStrategy] = useState<string>("STRATEGY_2"); 
  const [userEmailSimulation, setUserEmailSimulation] = useState<string>("");

  const [dbLogs, setDbLogs] = useState<DbLog[]>([]);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [showQrisModal, setShowQrisModal] = useState<boolean>(false);
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(true);

  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [mockOtpInput, setMockOtpInput] = useState<string>("");
  const [dynamicQrisUrl, setDynamicQrisUrl] = useState<string>("");
  const [isFetchingQris, setIsFetchingQris] = useState<boolean>(false);

  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();

  const { writeContract, isPending: isTxPending, error: txError, data: txHash } = useWriteContract();
  
  // 🟢 FIXED: Safe strict type fallback fallback code block to avoid 'undefined' type clash inside Wagmi hooks
  const currentContractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

  const ETH_TO_USD_RATE = 3500;
  const ETH_TO_IDR_RATE = 54000000;
  const fallbackQrisUrl = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=WhitelabelGatewaySettlementSimulation";

  // 🌐 LOGIC SNIFFER: AUTO-DETECT VERCEL INCOMING SUBDOMAIN URL FOR ALL 3 SKUS
  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes("starter")) {
      setFiatProductId("1");
    } else if (hostname.includes("enterprise")) {
      setFiatProductId("2");
    } else if (hostname.includes("institutional")) {
      setFiatProductId("3");
    } else {
      setFiatProductId("3"); // Default Fallback to SKU-03
    }
  }, []);

  useEffect(() => {
    let finalAbi: any = null;
    if (kontrakData && (kontrakData as any).abi) {
      finalAbi = (kontrakData as any).abi;
    } else if (kontrakData && (kontrakData as any).default && (kontrakData as any).default.abi) {
      finalAbi = (kontrakData as any).default.abi;
    }
    if (finalAbi) setParsedAbi(finalAbi);
  }, []);

  useEffect(() => {
    if (isConnected && address) {
      setFiatDeliveryAddress(String(address));
    } else {
      setFiatDeliveryAddress("");
    }
  }, [isConnected, address]);

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
          
          setDbLogs((prev) => {
            const isExist = prev.some((l) => l.txHash === log.transactionHash);
            if (isExist) {
              return prev.map((l) => 
                l.txHash === log.transactionHash || l.tokenId === "Minting..." || l.tokenId === "Relay-Mint"
                  ? { ...l, tokenId: `#${tokenNum}` }
                  : l
              );
            }
            const newLog: DbLog = {
              buyer: buyerAddr,
              tokenId: `#${tokenNum}`,
              productId: productNum,
              timestamp: new Date().toLocaleTimeString(),
              txHash: log.transactionHash || "0x...",
              currencyMethod: selectedCurrency === "USD" ? "USD Credit Card (Stripe)" : "IDR QRIS / e-Wallet"
            };
            return [newLog, ...prev];
          });
        }
      });
    },
  });

  useEffect(() => {
    if (txHash && dbLogs.length > 0) {
      const hasPendingLog = dbLogs.some(log => log.tokenId === "Minting..." || log.tokenId === "Relay-Mint");
      if (hasPendingLog) {
        const calculatedIndex = `#${dbLogs.length - 1}`;
        const truncatedHash = `${txHash.slice(0, 8)}...${txHash.slice(-6)}`;
        setDbLogs((prev) =>
          prev.map((log) =>
            log.tokenId === "Minting..." || log.tokenId === "Relay-Mint" || log.txHash.includes("Broadcasting") || log.txHash.includes("Relay")
              ? { ...log, tokenId: calculatedIndex, txHash: truncatedHash }
              : log
          )
        );
      }
    }
  }, [txHash]);

  const handleConnectWallet = async (connector: any) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const cleanUrl = window.location.href.replace(/^https?:\/\//, "");
    const encodedUrl = encodeURIComponent(window.location.href);
    const isInAppWalletBrowser = typeof window !== "undefined" && (!!(window as any).ethereum || !!(window as any).phantom);

    if (isInAppWalletBrowser) {
      if (typeof connector === "string") {
        const matchingConnector = connectors.find(c => c.name.toLowerCase().includes(connector) || c.id.toLowerCase().includes(connector));
        if (matchingConnector) connect({ connector: matchingConnector });
        return;
      }
      connect({ connector });
      return;
    }

    if (typeof connector === "string") {
      if (connector === "phantom") window.location.href = `phantom://browse/${encodedUrl}`;
      else if (connector === "backpack") window.location.href = `backpack://dapp?url=${encodedUrl}`;
      return;
    }

    try {
      if (isMobile) {
        if ((connector.name || "").toLowerCase().includes("metamask")) { window.location.href = `metamask://dapp/${cleanUrl}`; return; }
        if ((connector.name || "").toLowerCase().includes("phantom")) { window.location.href = `phantom://browse/${encodedUrl}`; return; }
      }
      connect({ connector });
    } catch (err: any) {
      alert("Failed to prompt provider bridge: " + err.message);
    }
  };

  const executeOnChainRelayMint = () => {
    let targetDeliveryAddress = "";
    if (onboardingStrategy === "STRATEGY_2") {
      targetDeliveryAddress = fiatDeliveryAddress.trim() || (address ? String(address) : "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5");
    } else {
      targetDeliveryAddress = "0xE74D76735eCcB986BF5f91A25B3dCe5dfDb2669e"; 
    }

    if (!targetDeliveryAddress.startsWith("0x") || targetDeliveryAddress.length !== 42) {
      alert("❌ Invalid Wallet Address!");
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

      const newLog: DbLog = {
        buyer: onboardingStrategy === "STRATEGY_1" ? `📧 ${userEmailSimulation} (Privy Generated: 0xE74D...)` : targetDeliveryAddress,
        tokenId: "Relay-Mint",
        productId: String(fiatProductId),
        timestamp: new Date().toLocaleTimeString(),
        txHash: "Relay Settlement Completed",
        currencyMethod: selectedCurrency === "USD" ? "USD Credit Card (Stripe)" : "IDR QRIS / e-Wallet"
      };
      setDbLogs((prev) => [newLog, ...prev]);
    }, 1500);
  };

  const handleVerifyMockOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mockOtpInput.trim().length < 4) {
      alert("❌ Institutional Verification Error: Invalid Secure OTP digits!");
      return;
    }
    setShowOtpModal(false);
    setMockOtpInput("");
    executeOnChainRelayMint();
  };

  const handleFiatSimulationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onboardingStrategy === "STRATEGY_2" && (!fiatDeliveryAddress.trim().startsWith("0x") || fiatDeliveryAddress.trim().length !== 42)) {
      alert("❌ Please fill in the NFT Recipient Wallet Address correctly!");
      return;
    }
    if (onboardingStrategy === "STRATEGY_1" && !userEmailSimulation.includes("@")) {
      alert("❌ Please enter a valid buyer Email address!");
      return;
    }

    if (selectedCurrency === "IDR") {
      setIsFetchingQris(true);
      try {
        setShowQrisModal(true);
      } catch (err) {
        setDynamicQrisUrl(fallbackQrisUrl);
      } finally {
        setIsFetchingQris(false);
      }
      return; 
    }
    setShowOtpModal(true);
  };

  // 🟢 FIXED: Re-inserted missing handleDirectBuy logic handler loop to support immediate Web3 clearing route
  const handleDirectBuy = (id: any, priceEth: any) => {
    if (!isConnected || !address) {
      setIsWalletModalOpen(true);
      return;
    }

    if (!parsedAbi || !currentContractAddress) {
      alert(`❌ WEB3 EXECUTION BLOCKED!\n\nSystem Error Details:\n- Smart Contract Target is Null`);
      return;
    }

    try {
      const dummyAwsTokenUri = `https://aws-s3-digital-goods-store.com/metadata/product-${id}.json`;
      writeContract({
        address: currentContractAddress,
        abi: parsedAbi,
        functionName: "buyDigitalGood",
        args: [BigInt(id), dummyAwsTokenUri],
        value: parseEther(String(priceEth)),
      });

      const newLog: DbLog = {
        buyer: String(address),
        tokenId: "Minting...", 
        productId: String(id),
        timestamp: new Date().toLocaleTimeString(),
        txHash: "Broadcasting to Sepolia Node...",
        currencyMethod: "Direct Web3 Node (SepETH)"
      };
      setDbLogs((prev) => [newLog, ...prev]);
    } catch (err: any) {
      console.error("Provider Gas Error Intercepted:", err);
      alert("⚠️ Transaction Intercepted: Please verify that your EVM wallet contains sufficient Sepolia ETH balance to clear the SKU purchase rate and gas network fees, bosku!");
    }
  };

  const handleSetPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedAbi || !currentContractAddress) {
      alert("❌ Failed: Contract ABI or Smart Contract Address has not been loaded.");
      return;
    }
    writeContract({
      address: currentContractAddress,
      abi: parsedAbi,
      functionName: "setProductPrice",
      args: [BigInt(adminProductId), parseEther(adminPrice)],
    });
  };

  const handleWithdrawFunds = () => {
    if (!parsedAbi || !currentContractAddress) {
      alert("❌ Failed: Smart contract data synchronization not detected.");
      return;
    }
    writeContract({
      address: currentContractAddress,
      abi: parsedAbi,
      functionName: "withdrawFunds",
    });
  };

  const selectedProductData = (WHITELABEL_PRODUCTS || []).find(p => p.id === Number(fiatProductId));
  const productPriceEth = selectedProductData ? Number(selectedProductData.defaultPriceEth) : 0.05;
  const convertedFiatPrice = selectedCurrency === "USD" 
    ? `$${(productPriceEth * ETH_TO_USD_RATE).toFixed(2)} USD`
    : `Rp ${(productPriceEth * ETH_TO_IDR_RATE).toLocaleString("id-ID")}`;

  const walletAddressStr = address ? String(address) : "";

  return (
    <div style={{ backgroundColor: "#fafafa", color: "#111827", minHeight: "100vh", width: "100%", padding: "25px 20px", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', maxWidth: "1100px", margin: "0 auto", boxSizing: "border-box" }}>
      
      {/* ENTERPRISE COMPLIANCE DISCLAIMER MODAL */}
      {showDisclaimer && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999999 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "30px", borderRadius: "16px", width: "90%", maxWidth: "500px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <h2 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: 800 }}>⚖️ ZoniqFi Regulatory Compliance Protocol</h2>
            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "12px 0" }} />
            <div style={{ maxHeight: "220px", overflowY: "auto", fontSize: "12px", color: "#4b5563", lineHeight: "1.6", marginBottom: "20px" }}>
              <p><strong>1. FinTech Sandbox Operational Scope:</strong> This dashboard framework represents a programmatic B2B hybrid clearing simulation operating strictly for academic review and grant evaluation audit compliance.</p>
              <p><strong>2. Anti-Money Laundering (AML) Architecture:</strong> All cross-border settlements via the Hybrid Settlement Core mimic institutional sandbox protocols to secure payment-to-minting workflows.</p>
            </div>
            <button type="button" onClick={() => setShowDisclaimer(false)} style={{ width: "100%", background: "#111827", color: "#ffffff", padding: "12px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>Accept Terms & Proceed</button>
          </div>
        </div>
      )}

      {/* 3D SECURE OTP AUTHENTICATION OVERLAY */}
      {showOtpModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999998 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "26px", borderRadius: "14px", width: "90%", maxWidth: "360px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>🔒</div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 800 }}>3D Secure 2.0 Verification</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "11px", color: "#6b7280" }}>An authentication code has been transmitted to your bank's registered mobile device layout.</p>
            <form onSubmit={handleVerifyMockOtpSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "left", fontSize: "11px", color: "#334155" }}>
                <div>Merchant: <strong>ZoniqFi Protocol Core</strong></div>
                <div>Amount: <strong style={{ color: "#2563eb" }}>{convertedFiatPrice}</strong></div>
              </div>
              <input type="text" placeholder="Enter OTP Code" maxLength={6} value={mockOtpInput} onChange={(e) => setMockOtpInput(e.target.value.replace(/\D/g, ""))} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "2px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box", textAlign: "center", fontWeight: 700, backgroundColor: "#ffffff", color: "#111827" }} required />
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={() => { setShowOtpModal(false); setMockOtpInput(""); }} style={{ width: "35%", background: "#f1f5f9", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
                <button type="submit" style={{ width: "65%", background: "#2563eb", color: "#ffffff", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}>Submit Code</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INDONESIAN NATIONAL QRIS POPUP MODAL */}
      {showQrisModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 99999 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "30px", borderRadius: "16px", width: "100%", maxWidth: "360px", textAlign: "center" }}>
            <h3 style={{ color: "#e04f1a", margin: "0 0 14px 0", fontSize: "14px" }}>💾 GPN / QRIS NATIONAL STANDARD</h3>
            <div style={{ background: "#ffffff", padding: "12px", borderRadius: "12px", display: "inline-block", border: "1px solid #e5e7eb" }}>
              <img src={dynamicQrisUrl || fallbackQrisUrl} width="170" alt="QRIS" />
            </div>
            <div style={{ background: "#fef3c7", color: "#92400e", padding: "10px", borderRadius: "8px", fontSize: "11px", margin: "12px 0", textAlign: "left" }}>
              <strong>📍 Delivery Target:</strong> <code style={{ fontSize: "10px" }}>{onboardingStrategy === "STRATEGY_1" ? `📧 ${userEmailSimulation}` : fiatDeliveryAddress}</code>
            </div>
            <div style={{ margin: "15px 0", fontWeight: 700, color: "#92400e" }}>Total: {convertedFiatPrice}</div>
            <button type="button" onClick={executeOnChainRelayMint} style={{ width: "100%", background: "#10b981", color: "white", padding: "10px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>Confirm Payment</button>
          </div>
        </div>
      )}

      {/* GLOBAL HEADER BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "16px", marginBottom: "25px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#111827" }}>🏪 {storeName ? String(storeName) : "ZoniqFi Terminal Core"}</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>B2B Hybrid Web3 Infrastructure Layer</p>
        </div>
        <div>
          {isConnected && walletAddressStr ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", background: "#111827", color: "#ffffff", padding: "6px 12px", borderRadius: "30px", fontWeight: 600 }}>• Wallet Connected: {`${walletAddressStr.slice(0, 6)}...${walletAddressStr.slice(-4)}`}</span>
              <button onClick={() => disconnect()} style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Sign Out</button>
            </div>
          ) : (
            <button onClick={() => setIsWalletModalOpen(true)} style={{ background: "#2563eb", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>🔌 Connect Provider Wallet</button>
          )}
        </div>
      </div>

      {/* HARDENED WORKFLOW GATEWAY APP TERMINAL */}
      <div>
        {/* STATE MONITOR BANNER */}
        {(isTxPending || txHash || txError || connectError || fiatPaymentStatus === "PROCESSING") && (
          <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", marginBottom: "20px", border: "1px solid #e5e7eb" }}>
            <h4 style={{ marginTop: 0, marginBottom: "6px", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", color: "#4b5563" }}>⚡ System Broadcast Monitor:</h4>
            {fiatPaymentStatus === "PROCESSING" && <p style={{ color: "#2563eb", margin: 0, fontSize: "13px" }}>⏳ Awaiting confirmation clearing network...</p>}
            {isTxPending && <p style={{ color: "#d97706", margin: 0, fontSize: "13px" }}>⏳ Processing node signature approval...</p>}
            {txHash && <p style={{ color: "#059669", margin: 0, fontSize: "13px", wordBreak: "break-all" }}>✅ Settled! Tx Hash: <code>{txHash}</code></p>}
            {txError && <p style={{ color: "#dc2626", margin: 0, fontSize: "13px" }}>❌ Smart Contract Error: {txError.message.split("\n")[0]}</p>}
          </div>
        )}

        {/* DUAL PATHWAY CATALOG SELECTION GRID */}
        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 700 }}>🛒 Gateway Procurement Sandbox</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {(WHITELABEL_PRODUCTS || []).map((prod: Product) => {
              const priceEth = prod.defaultPriceEth || "0.05";
              const priceUsd = (Number(priceEth) * ETH_TO_USD_RATE).toFixed(0);
              const theme = cardThemes[prod.id] || { bg: "#ffffff", border: "#e5e7eb", accent: "#f9fafb", shadow: "none" };
              const isSelectedInDemo = Number(fiatProductId) === prod.id;

              return (
                <div key={prod.id} style={{ background: theme.bg, border: isSelectedInDemo ? `3px dashed #f97316` : `2px solid ${theme.border}`, borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: theme.shadow }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ background: theme.accent, color: "#1f2937", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>SKU-0{prod.id}</span>
                      {isSelectedInDemo && <span style={{ fontSize: "10px", color: "#f97316", background: "#fff7ed", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>🎯 Active Target</span>}
                    </div>
                    <h4 style={{ margin: "12px 0 6px 0", fontSize: "16px", fontWeight: 800 }}>{prod.name}</h4>
                    <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#4b5563" }}>{prod.description}</p>
                  </div>
                  <div>
                    <div style={{ borderTop: `1px solid #e5e7eb`, paddingTop: "12px", marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: "18px", fontWeight: 800 }}>{priceEth} ETH</span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#4b5563" }}>${priceUsd} USD</span>
                      </div>
                    </div>
                    <button type="button" disabled={isTxPending} onClick={() => { if (!isConnected) { setIsWalletModalOpen(true); } else { handleDirectBuy(prod.id, priceEth); } }} style={{ width: "100%", background: !isConnected ? "#111827" : theme.border, color: "#ffffff", border: "none", padding: "10px 0", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                      {!isConnected ? "🔌 Connect Wallet to Buy" : "⚡ Purchase via Web3 Node"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TWO COLUMN INTERACTION AND EVENT LEDGER PANEL */}
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "25px" }}>
          
          {/* DATABASE RECORD PIPELINE MONITOR */}
          <div style={{ background: "#f0f7ff", padding: "20px", borderRadius: "12px", border: "1px solid #3b82f6", flex: "1.2", minWidth: "300px", boxSizing: "border-box" }}>
            <h3 style={{ marginTop: 0, marginBottom: "2px", color: "#1d4ed8", fontSize: "15px", fontWeight: 700 }}>📊 Global Database Order Logs</h3>
            <p style={{ fontSize: "12px", color: "#2563eb", margin: 0 }}>Unified event record tracking pipeline.</p>
            <div style={{ maxHeight: "310px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
              {dbLogs.length === 0 ? (
                <div style={{ background: "#ffffff", padding: "16px", borderRadius: "8px", textAlign: "center", color: "#9ca3af", border: "1px dashed #bfdbfe", fontSize: "12px" }}>📭 No dynamic billing data synchronized yet.</div>
              ) : (
                dbLogs.map((log: DbLog, index: number) => (
                  <div key={index} style={{ background: "#ffffff", padding: "10px", borderRadius: "6px", border: "1px solid #bfdbfe", fontSize: "11px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                      <span style={{ fontWeight: 700, color: "#059669" }}>📩 Token ID: {log.tokenId}</span>
                      <span style={{ color: "#9ca3af" }}>{log.timestamp}</span>
                    </div>
                    <p style={{ margin: "2px 0" }}><strong>SKU Linked:</strong> SKU-0{log.productId}</p>
                    <p style={{ margin: "2px 0" }}><strong>Gateway Route:</strong> <span style={{ background: "#e5e7eb", color: "#1f2937", padding: "1px 4px", borderRadius: "4px", fontSize: "9px", fontWeight: 600 }}>{log.currencyMethod}</span></p>
                    <p style={{ margin: "2px 0", wordBreak: "break-all" }}><strong>Holder Address:</strong> <code>{log.buyer}</code></p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECURE CLEARING SYSTEM INTERACTION HUB */}
          <div style={{ background: "#fff7ed", padding: "20px", borderRadius: "12px", border: "1px solid #f97316", flex: "1", minWidth: "300px", boxSizing: "border-box" }}>
            <form onSubmit={handleFiatSimulationSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>💳 Hybrid Settlement Engine</h3>
              
              <div style={{ display: "flex", gap: "14px", marginBottom: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px" }}>
                  <input type="radio" name="currency" value="USD" checked={selectedCurrency === "USD"} onChange={() => setSelectedCurrency("USD")} />
                  <span>💳 Credit Card</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px" }}>
                  <input type="radio" name="currency" value="IDR" checked={selectedCurrency === "IDR"} onChange={() => setSelectedCurrency("IDR")} />
                  <span>💾 QRIS Payment</span>
                </label>
              </div>

              <div style={{ background: "#ffffff", padding: "12px", borderRadius: "10px", border: "1px solid #fdba74" }}>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 800, color: "#c2410c", marginBottom: "8px", textTransform: "uppercase" }}>🗺️ Onboarding Interface & Conversion Pipeline:</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", display: "flex", alignItems: "start", gap: "6px", cursor: "pointer", padding: "6px", borderRadius: "6px", border: onboardingStrategy === "STRATEGY_2" ? "2px solid #2563eb" : "1px solid #e5e7eb", background: onboardingStrategy === "STRATEGY_2" ? "#f8fafc" : "#ffffff" }}>
                    <input type="radio" name="strategy" value="STRATEGY_2" checked={onboardingStrategy === "STRATEGY_2"} onChange={() => setOnboardingStrategy("STRATEGY_2")} />
                    <div style={{ width: "100%", display: "flex", justifyContent: "space-between" }}>
                      <strong>Crypto-Native Clearing</strong>
                      <span style={{ fontSize: "8px", background: "#dbeafe", color: "#1e40af", padding: "1px 5px", borderRadius: "10px", fontWeight: 700 }}>  WALLET ON</span>
                    </div>
                  </label>

                  <label style={{ fontSize: "11px", display: "flex", alignItems: "start", gap: "6px", cursor: "pointer", padding: "6px", borderRadius: "6px", border: onboardingStrategy === "STRATEGY_1" ? "2px solid #10b981" : "1px solid #e5e7eb", background: onboardingStrategy === "STRATEGY_1" ? "#f0fdf4" : "#ffffff" }}>
                    <input type="radio" name="strategy" value="STRATEGY_1" checked={onboardingStrategy === "STRATEGY_1"} onChange={() => setOnboardingStrategy("STRATEGY_1")} />
                    <div style={{ width: "100%", display: "flex", justifyContent: "space-between" }}>
                      <strong>Account Abstraction Pipeline</strong>
                      <span style={{ fontSize: "8px", background: "#fee2e2", color: "#991b1b", padding: "1px 5px", borderRadius: "10px", fontWeight: 700 }}>  WALLET OFF</span>
                    </div>
                  </label>
                </div>
              </div>

              {onboardingStrategy === "STRATEGY_2" && (
                <div style={{ background: "#ffffff", padding: "10px", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                  <label style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>📍 ERC-20 RECIPIENT WALLET HEX:</label>
                  <input type="text" placeholder="Enter 0x..." value={fiatDeliveryAddress} onChange={(e) => setFiatDeliveryAddress(e.target.value)} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px", boxSizing: "border-box", fontFamily: "monospace", backgroundColor: "#ffffff", color: "#111827" }} required />
                </div>
              )}

              {onboardingStrategy === "STRATEGY_1" && (
                <div style={{ background: "rgba(16, 185, 129, 0.05)", padding: "10px", borderRadius: "6px", border: "1px solid #a7f3d0" }}>
                  <label style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px", color: "#065f46" }}>📧 RETAIL BUYER EMAIL CONTEXT:</label>
                  <input type="email" placeholder="retailbuyer@gmail.com" value={userEmailSimulation} onChange={(e) => setUserEmailSimulation(e.target.value)} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #a7f3d0", fontSize: "11px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
                </div>
              )}

              {selectedCurrency === "IDR" ? (
                <div style={{ padding: "8px", backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #fed7aa", fontSize: "11px", color: "#c2410c", fontWeight: 600 }}>🎯 QRIS Settlement Active.</div>
              ) : (
                <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "6px", border: "1px solid #fed7aa", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <input type="text" placeholder="0000 0000 0000 0000" maxLength={19} onChange={(e) => { let val = e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim(); e.target.value = val; }} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px", boxSizing: "border-box", fontFamily: "monospace", backgroundColor: "#ffffff", color: "#111827" }} required />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <input type="text" placeholder="MM / YYYY" maxLength={9} onChange={(e) => { let v = e.target.value.replace(/\D/g, ""); if (v.length > 2) v = v.slice(0, 2) + " / " + v.slice(2, 6); e.target.value = v; }} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
                    <input type="password" placeholder="CVC" maxLength={3} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                <select value={fiatProductId} onChange={(e) => setFiatProductId(e.target.value)} style={{ width: "45%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px", backgroundColor: "#ffffff", color: "#111827" }}>
                  {(WHITELABEL_PRODUCTS || []).map((p: Product) => (
                    <option key={p.id} value={p.id}>SKU-0{p.id}</option>
                  ))}
                </select>
                <div style={{ width: "55%", background: "#ffffff", padding: "6px", borderRadius: "4px", border: "1px solid #fed7aa", fontSize: "11px", textAlign: "center", fontWeight: 700, color: "#111827" }}>
                  {convertedFiatPrice}
                </div>
              </div>

              <button type="submit" disabled={fiatPaymentStatus === "PROCESSING" || isFetchingQris} style={{ width: "100%", background: "#f97316", color: "white", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}>
                {isFetchingQris ? "Opening Gateway..." : `Simulate Checkout`}
              </button>
            </form>
          </div>
        </div>

        {/* OPERATOR CONTROL OVERRIDE PANEL */}
        {isConnected && address?.toLowerCase() === "0xc7ac22cbe2c96c308dafbec609025c03a713fe01" && (
          <div style={{ background: "#fdf4ff", padding: "20px", borderRadius: "12px", border: "1px solid #d946ef", marginBottom: "25px" }}>
            <h3 style={{ marginTop: 0, color: "#a21caf", fontSize: "14px", fontWeight: 700 }}>🛠️ Internal Management Panel (Operator Only)</h3>
            <form onSubmit={handleSetPrice} style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "end" }}>
              <input type="number" value={adminProductId} onChange={(e) => setAdminProductId(e.target.value)} style={{ padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "12px", backgroundColor: "#ffffff", color: "#111827" }} required />
              <input type="text" value={adminPrice} onChange={(e) => setAdminPrice(e.target.value)} style={{ padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "12px", backgroundColor: "#ffffff", color: "#111827" }} required />
              <button type="submit" disabled={!isConnected || isTxPending} style={{ background: "#d946ef", color: "white", border: "none", padding: "7px 14px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Override Rate</button>
            </form>
            <div style={{ borderTop: "1px dashed #d946ef", paddingTop: "12px", marginTop: "12px" }}>
              <button type="button" disabled={!isConnected || isTxPending} onClick={handleWithdrawFunds} style={{ background: "#6b21a8", color: "white", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}>💰 Emergency Withdraw Contract Funds</button>
            </div>
          </div>
        )}
      </div>

      {/* WEB3 PROVIDER WALLET SELECTION OVERLAY */}
      {isWalletModalOpen && !isConnected && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "25px", borderRadius: "16px", width: "100%", maxWidth: "320px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px" }}>🔌 Select Web3 Wallet</span>
              <button type="button" onClick={() => setIsWalletModalOpen(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(connectors || []).map((connector) => (
                <button key={connector.uid} onClick={() => { handleConnectWallet(connector); setIsWalletModalOpen(false); }} style={{ background: "#f9fafb", color: "#111827", border: "1px solid #e5e7eb", padding: "12px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>🚀 {connector.name === "injected" ? "Browser Extension" : connector.name}</span>
                  <span style={{ fontSize: "10px", color: "#2563eb", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px" }}>Launch</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CORPORATE FOOTER */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px", marginTop: "25px", textAlign: "center", fontSize: "12px", color: "#6b7280" }}>
        <p style={{ margin: "0 0 4px 0", fontWeight: 500 }}>© 2026 <strong>ZoniqFi</strong>. All rights reserved. Enterprise Hybrid B2B Core Settlement Protocol.</p>
        <p style={{ margin: 0 }}>Powered by Ecosystem Node Deployments • Connect via <a href="https://zoniqfi.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>ZoniqFi Network Core 🌐</a></p>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <MainApp />
      </WagmiProvider>
    </QueryClientProvider>
  );
}