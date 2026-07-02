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

// HIGH-CONTRAST ENTERPRISE CARD SCHEME FOR SKU ITEMS
const cardThemes: Record<number, { bg: string; border: string; accent: string; shadow: string }> = {
  1: { bg: "#ffffff", border: "#2563eb", accent: "#eff6ff", shadow: "0 10px 25px -5px rgba(37, 99, 235, 0.15)" }, 
  2: { bg: "#ffffff", border: "#7c3aed", accent: "#f5f3ff", shadow: "0 10px 25px -5px rgba(124, 58, 237, 0.15)" }, 
  3: { bg: "#ffffff", border: "#059669", accent: "#ecfdf5", shadow: "0 10px 25px -5px rgba(5, 150, 105, 0.15)" }  
};

function MainApp() {
  const [parsedAbi, setParsedAbi] = useState<any>(null);

  const [adminProductId, setAdminProductId] = useState<string>("1");
  const [adminPrice, setAdminPrice] = useState<string>("0.05");

  // Rig Setup for Global Fiat Settlement
  const [fiatProductId, setFiatProductId] = useState<string>("3");
  const [fiatPaymentStatus, setFiatPaymentStatus] = useState<string>("IDLE");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD"); 
  
  // Manual Delivery Hex Address State
  const [fiatDeliveryAddress, setFiatDeliveryAddress] = useState<string>("");

  // ONBOARDING INTERFACE CONVERSION STATES
  const [onboardingStrategy, setOnboardingStrategy] = useState<string>("STRATEGY_2"); 
  const [userEmailSimulation, setUserEmailSimulation] = useState<string>("");

  const [dbLogs, setDbLogs] = useState<DbLog[]>([]);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [showQrisModal, setShowQrisModal] = useState<boolean>(false);
  
  // LEGAL COMPLIANCE DISCLAIMER POP-UP STATE
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(true);

  // 💳 3D SECURE OTP SIMULATION ENGINE STATE
  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [mockOtpInput, setMockOtpInput] = useState<string>("");
  
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
        if (matchingConnector) {
          connect({ connector: matchingConnector });
        } else {
          const activeInjected = connectors.find(c => c.id === "injected" || c.name.toLowerCase().includes("default") || c.name.toLowerCase().includes("browser"));
          if (activeInjected) connect({ connector: activeInjected });
          else if (connectors.length > 0) connect({ connector: connectors[0] });
        }
        return;
      } else {
        connect({ connector });
        return;
      }
    }

    if (typeof connector === "string") {
      if (connector === "phantom") {
        window.location.href = `phantom://browse/${encodedUrl}`;
      } else if (connector === "backpack") {
        window.location.href = `backpack://dapp?url=${encodedUrl}`;
      }
      return;
    }

    if (!connector) return;
    const cName = connector.name ? connector.name.toLowerCase() : "";
    const cId = connector.id ? connector.id.toLowerCase() : "";

    try {
      if (isMobile) {
        if (cName.includes("metamask") || cId.includes("metamask")) {
          window.location.href = `metamask://dapp/${cleanUrl}`;
          return;
        }
        if (cName.includes("phantom") || cId.includes("phantom")) {
          window.location.href = `phantom://browse/${encodedUrl}`;
          return;
        }
        if (cName.includes("backpack") || cId.includes("backpack")) {
          window.location.href = `backpack://dapp?url=${encodedUrl}`;
          return;
        }
      }
      connect({ connector });
    } catch (err: any) {
      alert("Failed to prompt provider bridge orchestration: " + err.message);
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

  const handleDirectBuy = (id: any, priceEth: any) => {
    if (!isConnected || !address) {
      setIsWalletModalOpen(true);
      return;
    }

    if (!parsedAbi || !currentContractAddress) {
      alert(`❌ WEB3 EXECUTION BLOCKED!\n\nSystem Error Details:\n- Smart Contract Address: ${currentContractAddress ? "🟢 OK" : "🔴 ERROR"}`);
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

  const executeOnChainRelayMint = () => {
    let targetDeliveryAddress = "";
    if (onboardingStrategy === "STRATEGY_2") {
      targetDeliveryAddress = fiatDeliveryAddress.trim() || (address ? String(address) : "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5");
    } else {
      targetDeliveryAddress = "0xE74D76735eCcB986BF5f91A25B3dCe5dfDb2669e"; 
    }

    if (!targetDeliveryAddress.startsWith("0x") || targetDeliveryAddress.length !== 42) {
      alert("❌ Invalid ERC-20 Wallet Address!");
      setShowQrisModal(false);
      return;
    }

    if (!parsedAbi || !currentContractAddress) {
      alert("Warning: Smart contract ABI configuration is not ready!");
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

  const handleFiatSimulationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (onboardingStrategy === "STRATEGY_2") {
      let checkAddr = fiatDeliveryAddress.trim() || (address ? String(address) : "");
      if (!checkAddr.startsWith("0x") || checkAddr.length !== 42) {
        alert("❌ Please fill in the NFT Recipient Wallet Address correctly!");
        return;
      }
    } else if (onboardingStrategy === "STRATEGY_1" && !userEmailSimulation.includes("@")) {
      alert("❌ Please enter a valid buyer Email address!");
      return;
    }

    const selectedProductData = (WHITELABEL_PRODUCTS || []).find(p => p.id === Number(fiatProductId));
    const productPriceEth = selectedProductData ? Number(selectedProductData.defaultPriceEth) : 0.05;
    const priceInIdr = Math.round(productPriceEth * ETH_TO_IDR_RATE);

    // Path A: National Indonesian QRIS Clearing
    if (selectedCurrency === "IDR") {
      setIsFetchingQris(true);
      try {
        const response = await fetch("/api/charge-qris", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: fiatProductId, amountIdr: priceInIdr })
        });
        const data = await response.json();
        if (data && data.success && data.qrUrl) {
          setDynamicQrisUrl(data.qrUrl); 
        } else {
          setDynamicQrisUrl(fallbackQrisUrl);
        }
      } catch (err: any) {
        setDynamicQrisUrl(fallbackQrisUrl);
      } finally {
        setIsFetchingQris(false);
        setShowQrisModal(true); 
      }
      return; 
    }

    // Path B: Global Credit Card Rails (Trigger 3D Secure Verification Layer First)
    setShowOtpModal(true);
  };

  const handleVerifyMockOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mockOtpInput.trim().length < 4) {
      alert("❌ Institutional Verification Error: Invalid Secure OTP digits!");
      return;
    }
    setShowOtpModal(false);
    mockOtpInput.trim();
    executeOnChainRelayMint();
  };

  const selectedProductData = (WHITELABEL_PRODUCTS || []).find(p => p.id === Number(fiatProductId));
  const productPriceEth = selectedProductData ? Number(selectedProductData.defaultPriceEth) : 0.05;
  const convertedFiatPrice = selectedCurrency === "USD" 
    ? `$${(productPriceEth * ETH_TO_USD_RATE).toFixed(2)} USD`
    : `Rp ${(productPriceEth * ETH_TO_IDR_RATE).toLocaleString("id-ID")}`;

  const walletAddressStr = address ? String(address) : "";

  return (
    <div style={{ backgroundColor: "#fafafa", color: "#111827", minHeight: "100vh", width: "100%", padding: "25px 20px", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', maxWidth: "1100px", margin: "0 auto", boxSizing: "border-box" }}>
      
      {/* 🏛️ ENTERPRISE REGULATORY & COMPLIANCE DISCLAIMER POP-UP MODAL */}
      {showDisclaimer && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999999 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "30px", borderRadius: "16px", width: "90%", maxWidth: "500px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", textAlign: "left" }}>
            <h2 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              ⚖️ ZoniqFi Regulatory Compliance Protocol
            </h2>
            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "12px 0" }} />
            <div style={{ maxHeight: "220px", overflowY: "auto", fontSize: "12px", color: "#4b5563", lineHeight: "1.6", marginBottom: "20px" }}>
              <p style={{ marginTop: 0 }}><strong>1. FinTech Sandbox Operational Scope:</strong> This dashboard framework represents a programmatic B2B hybrid clearing simulation. It operates strictly under simulated decentralized execution guidelines for academic review and performance audit compliance.</p>
              <p><strong>2. Anti-Money Laundering (AML) & KYC Architecture:</strong> All programmatic cross-border settlements routed via the Hybrid Settlement Core (Fiat credit rails & National QRIS GPN codes) mock institutional compliance rules to safeguard utility token issuance procedures.</p>
              <p style={{ marginBottom: 0 }}><strong>3. Cryptographic Utility Context:</strong> The generated ERC-721 Smart Contract tokens act solely as non-speculative Enterprise Software Utility Licenses (Asset Keys). By clicking "Accept & Proceed", you acknowledge authorization to evaluate this protocol bridge.</p>
            </div>
            <button type="button" onClick={() => setShowDisclaimer(false)} style={{ width: "100%", background: "#111827", color: "#ffffff", padding: "12px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "13px", letterSpacing: "0.02em", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
              Accept Protocol Terms & Proceed
            </button>
          </div>
        </div>
      )}

      {/* 🔐 HIGH-FIDELITY 3D SECURE 2.0 OTP BANK POP-UP OVERLAY */}
      {showOtpModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999998 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "26px", borderRadius: "14px", width: "90%", maxWidth: "360px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)", textAlign: "center" }}>
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>🔒</div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 800, color: "#111827" }}>3D Secure 2.0 Verification</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "11px", color: "#6b7280" }}>An authentication code has been transmitted to your card issuing bank's registered mobile device layout.</p>
            
            <form onSubmit={handleVerifyMockOtpSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", textAlign: "left", fontSize: "11px", color: "#334155" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}><span>Merchant:</span> <strong>ZoniqFi Protocol Core</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Amount:</span> <strong style={{ color: "#2563eb" }}>{convertedFiatPrice}</strong></div>
              </div>

              <div>
                <input 
                  type="text" 
                  placeholder="Enter 6-Digit OTP Code (e.g. 123456)" 
                  maxLength={6}
                  value={mockOtpInput}
                  onChange={(e) => setMockOtpInput(e.target.value.replace(/\D/g, ""))}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "2px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box", textAlign: "center", fontWeight: 700, letterSpacing: "0.2em", backgroundColor: "#ffffff", color: "#111827" }}
                  required 
                />
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button type="button" onClick={() => { setShowOtpModal(false); setMockOtpInput(""); }} style={{ width: "35%", background: "#f1f5f9", color: "#334155", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>Cancel</button>
                <button type="submit" style={{ width: "65%", background: "#2563eb", color: "#ffffff", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontWeight: 700, fontSize: "12px", boxShadow: "0 4px 10px rgba(37,99,235,0.2)" }}>Submit Secure Code</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NAVBAR HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "16px", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", color: "#111827" }}>🏪 {storeName ? String(storeName) : "Web3 Digital Core"}</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>Enterprise Hybrid B2B Whitelabel Gateway</p>
        </div>
        <div>
          {isConnected && walletAddressStr ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", background: "#111827", color: "#ffffff", padding: "6px 12px", borderRadius: "30px", fontWeight: 600 }}>• Wallet Connected: {`${walletAddressStr.slice(0, 6)}...${walletAddressStr.slice(-4)}`}</span>
              <button onClick={() => disconnect()} style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Sign Out</button>
            </div>
          ) : (
            <button onClick={() => setIsWalletModalOpen(true)} style={{ background: "#2563eb", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "12px", boxShadow: "0 4px 10px rgba(37,99,235,0.2)" }}>🔌 Connect Provider Wallet</button>
          )}
        </div>
      </div>

      {/* FLOATING OVERLAY PROVIDER SELECTION MODAL */}
      {isWalletModalOpen && !isConnected && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "25px", borderRadius: "16px", width: "100%", maxWidth: "320px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#111827" }}>🔌 Select Web3 Wallet</span>
              <button type="button" onClick={() => setIsWalletModalOpen(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(connectors || []).map((connector) => {
                let displayWalletName = connector.name || "Injected Node";
                if (displayWalletName.toLowerCase() === "injected") displayWalletName = "Browser Default Extension";
                return (
                  <button key={connector.uid} onClick={() => { handleConnectWallet(connector); setIsWalletModalOpen(false); }} style={{ background: "#f9fafb", color: "#111827", border: "1px solid #e5e7eb", padding: "12px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>🚀 {displayWalletName}</span>
                    <span style={{ fontSize: "10px", color: "#2563eb", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>Launch</span>
                  </button>
                );
              })}
              {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
                <>
                  {!(connectors || []).some(c => (c.name || "").toLowerCase().includes("phantom")) && (
                    <button onClick={() => { handleConnectWallet("phantom"); setIsWalletModalOpen(false); }} style={{ background: "#f9fafb", color: "#111827", border: "1px solid #e5e7eb", padding: "12px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>🚀 Phantom</span>
                      <span style={{ fontSize: "10px", color: "#2563eb", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>Launch</span>
                    </button>
                  )}
                  {!(connectors || []).some(c => (c.name || "").toLowerCase().includes("backpack")) && (
                    <button onClick={() => { handleConnectWallet("backpack"); setIsWalletModalOpen(false); }} style={{ background: "#f9fafb", color: "#111827", border: "1px solid #e5e7eb", padding: "12px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>🚀 Backpack</span>
                      <span style={{ fontSize: "10px", color: "#2563eb", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>Launch</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC POP-UP MODAL QRIS INDONESIA */}
      {showQrisModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 99999 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "30px", borderRadius: "16px", width: "100%", maxWidth: "360px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center", color: "#e04f1a", margin: 0, fontSize: "14px" }}>
                💾 GPN / QRIS STANDAR NASIONAL
              </h3>
              <button type="button" onClick={() => setShowQrisModal(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <div style={{ background: "#ffffff", padding: "12px", borderRadius: "12px", display: "inline-block", border: "1px solid #e5e7eb" }}>
              <img src={dynamicQrisUrl || fallbackQrisUrl} width="170" alt="QRIS" />
            </div>
            <div style={{ marginTop: "10px" }}>
              <button type="button" onClick={downloadQris} style={{ background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "11px" }}>💾 Download QRIS Code</button>
            </div>
            <div style={{ background: "#fef3c7", color: "#92400e", padding: "10px", borderRadius: "8px", fontSize: "11px", margin: "12px 0", textAlign: "left", wordBreak: "break-all" }}>
              <strong>📍 NFT Delivery Target:</strong><br />
              <code style={{ fontSize: "10px", fontWeight: 700 }}>
                {onboardingStrategy === "STRATEGY_2" && (fiatDeliveryAddress || "0x95222... Fallback")}
                {onboardingStrategy === "STRATEGY_1" && `📧 ${userEmailSimulation} (Auto Embedded Wallet)`}
              </code>
            </div>
            <div style={{ margin: "15px 0", fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "10px", borderRadius: "8px", fontSize: "13px" }}>Total: {convertedFiatPrice}</div>
            <button type="button" onClick={executeOnChainRelayMint} style={{ width: "100%", background: "#10b981", color: "white", padding: "10px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
              Konfirmasi Pembayaran
            </button>
          </div>
        </div>
      )}

      {/* SYSTEM BROADCAST NETWORK STATE MONITOR */}
      {(isTxPending || txHash || txError || connectError || fiatPaymentStatus === "PROCESSING") && (
        <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", marginBottom: "20px", border: "1px solid #e5e7eb" }}>
          <h4 style={{ marginTop: 0, marginBottom: "6px", fontWeight: 700, fontSize: "12px", textTransform: "uppercase", color: "#4b5563" }}>⚡ System Broadcast Monitor:</h4>
          {fiatPaymentStatus === "PROCESSING" && <p style={{ color: "#2563eb", margin: 0, fontSize: "13px", fontWeight: 500 }}>⏳ Awaiting confirmation...</p>}
          {isTxPending && <p style={{ color: "#d97706", margin: 0, fontSize: "13px", fontWeight: 500 }}>⏳ Processing node signature approval...</p>}
          {txHash && <p style={{ color: "#059669", margin: 0, fontSize: "13px", fontWeight: 600, wordBreak: "break-all" }}>✅ Settled! Tx Hash: <code>{txHash}</code></p>}
          {txError && <p style={{ color: "#dc2626", margin: 0, fontSize: "13px", fontWeight: 500 }}>❌ Smart Contract Error: {txError.message.split("\n")[0]}</p>}
        </div>
      )}

      {/* B2B DIGITAL SOLUTIONS CATALOG */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: 700, color: "#111827" }}>🛒 B2B Digital Solutions Catalog</h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#6b7280" }}>Direct on-chain procurement infrastructure for enterprise infrastructure items.</p>
        
        {/* COMPACT HIGH-CONTRAST CARD GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
          {(WHITELABEL_PRODUCTS || []).map((prod: Product) => {
            const priceEth = prod.defaultPriceEth || "0.05";
            const priceUsd = (Number(priceEth) * ETH_TO_USD_RATE).toFixed(0);
            const theme = cardThemes[prod.id] || { bg: "#ffffff", border: "#e5e7eb", accent: "#f9fafb", shadow: "none" };
            
            return (
              <div key={prod.id} style={{ 
                background: theme.bg, 
                border: `2px solid ${theme.border}`, 
                borderRadius: "14px", 
                padding: "20px", 
                display: "flex", 
                flexDirection: "column", 
                justifyContent: "space-between", 
                boxSizing: "border-box",
                boxShadow: theme.shadow,
                transition: "transform 0.2s ease"
              }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ background: theme.accent, color: "#1f2937", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 800, border: `1px solid ${theme.border}` }}>SKU-0{prod.id}</span>
                    <span style={{ color: isConnected ? "#10b981" : "#ef4444", fontSize: "11px", fontWeight: 700 }}>● {isConnected ? "Network Live" : "Secure Blocked"}</span>
                  </div>
                  <h4 style={{ margin: "12px 0 6px 0", fontSize: "16px", fontWeight: 800, color: "#111827" }}>{prod.name}</h4>
                  <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#4b5563", lineHeight: "1.4" }}>{prod.description}</p>
                </div>
                <div>
                  <div style={{ borderTop: `1px solid #e5e7eb`, paddingTop: "12px", marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: "18px", fontWeight: 800, color: "#111827" }}>{priceEth} ETH</span>
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

      {/* FLEX SIDE-BY-SIDE SIDEBAR COMPACTION */}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "25px" }}>
        
        {/* GLOBAL DATABASE ORDER LOGS */}
        <div style={{ background: "#f0f7ff", padding: "20px", borderRadius: "12px", border: "1px solid #3b82f6", flex: "1.2", minWidth: "300px", boxSizing: "border-box" }}>
          <h3 style={{ marginTop: 0, marginBottom: "2px", color: "#1d4ed8", fontSize: "15px", fontWeight: 700 }}>📊 Global Database Order Logs</h3>
          <p style={{ fontSize: "12px", color: "#2563eb", margin: 0 }}>Unified dashboard recording incoming cross-border settlement event emissions.</p>
          <div style={{ maxHeight: "310px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
            {dbLogs.length === 0 ? (
              <div style={{ background: "#ffffff", padding: "16px", borderRadius: "8px", textAlign: "center", color: "#9ca3af", border: "1px dashed #bfdbfe", fontSize: "12px" }}>📭 No dynamic billing data synchronized yet.</div>
            ) : (
              (dbLogs || []).map((log: DbLog, index: number) => (
                <div key={index} style={{ background: "#ffffff", padding: "10px", borderRadius: "6px", border: "1px solid #bfdbfe", fontSize: "11px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ fontWeight: 700, color: "#059669" }}>📩 Token ID: {log.tokenId}</span>
                    <span style={{ color: "#9ca3af" }}>{log.timestamp}</span>
                  </div>
                  <p style={{ margin: "2px 0" }}><strong>SKU Linked:</strong> Solutions SKU-0{log.productId}</p>
                  <p style={{ margin: "2px 0" }}><strong>Gateway Route:</strong> <span style={{ background: "#e5e7eb", color: "#1f2937", padding: "1px 4px", borderRadius: "4px", fontSize: "9px", fontWeight: 600 }}>{log.currencyMethod}</span></p>
                  <p style={{ margin: "2px 0", wordBreak: "break-all", color: "#4b5563" }}><strong>Holder Address:</strong> <code>{log.buyer}</code></p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* HYBRID SETTLEMENT ENGINE */}
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

            {/* HIGH-IMPACT PITCH CONVERSION PIPELINE SELECTOR */}
            <div style={{ background: "#ffffff", padding: "12px", borderRadius: "10px", border: "1px solid #fdba74" }}>
              <label style={{ display: "block", fontSize: "10px", fontWeight: 800, color: "#c2410c", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                🗺️ Onboarding Interface & Conversion Pipeline:
              </label>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                
                {/* STRATEGY 2 - CRYPTO NATIVE CLEARING */}
                <label style={{ 
                  fontSize: "11px", 
                  display: "flex", 
                  alignItems: "start", 
                  gap: "6px", 
                  cursor: "pointer", 
                  padding: "6px", 
                  borderRadius: "6px", 
                  border: onboardingStrategy === "STRATEGY_2" ? "2px solid #2563eb" : "1px solid #e5e7eb", 
                  background: onboardingStrategy === "STRATEGY_2" ? "#f8fafc" : "#ffffff" 
                }}>
                  <input type="radio" name="strategy" value="STRATEGY_2" checked={onboardingStrategy === "STRATEGY_2"} onChange={() => setOnboardingStrategy("STRATEGY_2")} style={{ marginTop: "2px" }} />
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>Crypto-Native Clearing (Direct Web3 Wallet)</strong>
                      <span style={{ fontSize: "8px", background: "#dbeafe", color: "#1e40af", padding: "1px 5px", borderRadius: "10px", fontWeight: 700 }}>  WALLET ON</span>
                    </div>
                  </div>
                </label>

                {/* STRATEGY 1 - ACCOUNT ABSTRACTION PIPELINE */}
                <label style={{ 
                  fontSize: "11px", 
                  display: "flex", 
                  alignItems: "start", 
                  gap: "6px", 
                  cursor: "pointer", 
                  padding: "6px", 
                  borderRadius: "6px", 
                  border: onboardingStrategy === "STRATEGY_1" ? "2px solid #10b981" : "1px solid #e5e7eb", 
                  background: onboardingStrategy === "STRATEGY_1" ? "#f0fdf4" : "#ffffff" 
                }}>
                  <input type="radio" name="strategy" value="STRATEGY_1" checked={onboardingStrategy === "STRATEGY_1"} onChange={() => setOnboardingStrategy("STRATEGY_1")} style={{ marginTop: "2px" }} />
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>Account Abstraction Pipeline (Gasless Email Onboarding)</strong>
                      <span style={{ fontSize: "8px", background: "#fee2e2", color: "#991b1b", padding: "1px 5px", borderRadius: "10px", fontWeight: 700 }}>  WALLET OFF</span>
                    </div>
                  </div>
                </label>

              </div>
            </div>

            {onboardingStrategy === "STRATEGY_2" && (
              <div style={{ background: "#ffffff", padding: "10px", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>📍 ERC-20 RECIPIENT WALLET HEX:</label>
                {/* 🟢 FIXED: Kunci warna background & teks agar terhindar dari Mobile Dark Mode */}
                <input type="text" placeholder="Enter 0x..." value={fiatDeliveryAddress} onChange={(e) => setFiatDeliveryAddress(e.target.value)} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px", boxSizing: "border-box", fontFamily: "monospace", backgroundColor: "#ffffff", color: "#111827" }} required />
              </div>
            )}

            {onboardingStrategy === "STRATEGY_1" && (
              <div style={{ background: "rgba(16, 185, 129, 0.05)", padding: "10px", borderRadius: "6px", border: "1px solid #a7f3d0" }}>
                <label style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px", color: "#065f46" }}>📧 RETAIL BUYER EMAIL CONTEXT:</label>
                {/* 🟢 FIXED: Kunci warna background & teks agar terhindar dari Mobile Dark Mode */}
                <input type="email" placeholder="retailbuyer@gmail.com" value={userEmailSimulation} onChange={(e) => setUserEmailSimulation(e.target.value)} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #a7f3d0", fontSize: "11px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
              </div>
            )}

            {selectedCurrency === "IDR" ? (
              <div style={{ padding: "8px", backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #fed7aa", fontSize: "11px", color: "#c2410c", fontWeight: 600 }}>🎯 QRIS Settlement Active.</div>
            ) : (
              <div style={{ backgroundColor: "#ffffff", padding: "10px", borderRadius: "6px", border: "1px solid #fed7aa", display: "flex", flexDirection: "column", gap: "6px" }}>
                {/* 🟢 FIXED: Kunci warna background & teks agar terhindar dari Mobile Dark Mode */}
                <input type="text" placeholder="0000 0000 0000 0000" maxLength={19} onChange={(e) => { let val = e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim(); e.target.value = val; }} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px", boxSizing: "border-box", fontFamily: "monospace", backgroundColor: "#ffffff", color: "#111827" }} required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {/* 🟢 FIXED: Kunci warna background & teks agar terhindar dari Mobile Dark Mode */}
                  <input type="text" placeholder="MM / YYYY" maxLength={9} onChange={(e) => { let v = e.target.value.replace(/\D/g, ""); if (v.length > 2) v = v.slice(0, 2) + " / " + v.slice(2, 6); e.target.value = v; }} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
                  <input type="password" placeholder="CVC" maxLength={3} style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
              {/* 🟢 FIXED: Kunci warna background & teks agar terhindar dari Mobile Dark Mode */}
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

      {/* INTERNAL MANAGEMENT PANEL */}
      {isConnected && address?.toLowerCase() === "0xc7ac22cbe2c96c308dafbec609025c03a713fe01" && (
        <div style={{ background: "#fdf4ff", padding: "20px", borderRadius: "12px", border: "1px solid #d946ef" }}>
          <h3 style={{ marginTop: 0, color: "#a21caf", fontSize: "14px", fontWeight: 700 }}>🛠️ Internal Management Panel (Operator Only)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <form onSubmit={handleSetPrice} style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "end" }}>
              {/* 🟢 FIXED: Kunci warna background & teks agar terhindar dari Mobile Dark Mode */}
              <input type="number" value={adminProductId} onChange={(e) => setAdminProductId(e.target.value)} style={{ padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "12px", backgroundColor: "#ffffff", color: "#111827" }} required />
              <input type="text" value={adminPrice} onChange={(e) => setAdminPrice(e.target.value)} style={{ padding: "6px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "12px", backgroundColor: "#ffffff", color: "#111827" }} required />
              <button type="submit" disabled={!isConnected || isTxPending} style={{ background: "#d946ef", color: "white", border: "none", padding: "7px 14px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Override Rate</button>
            </form>
            <div style={{ borderTop: "1px dashed #d946ef", paddingTop: "8px" }}>
              <button type="button" disabled={!isConnected || isTxPending} onClick={handleWithdrawFunds} style={{ background: "#6b21a8", color: "white", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}>💰 Emergency Withdraw Contract Funds</button>
            </div>
          </div>
        </div>
      )}

      {/* ENTERPRISE FOOTER & COPYRIGHT ARCHITECTURE */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px", marginTop: "25px", textAlign: "center", fontSize: "12px", color: "#6b7280" }}>
        <p style={{ margin: "0 0 4px 0", fontWeight: 500 }}>
          © 2026 <strong>ZoniqFi</strong>. All rights reserved. Enterprise Hybrid B2B Core Settlement Protocol.
        </p>
        <p style={{ margin: 0 }}>
          Powered by Ecosystem Node Deployments • Connect via{" "}
          <a href="https://zoniqfi.com" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>ZoniqFi Network Core 🌐</a>
        </p>
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