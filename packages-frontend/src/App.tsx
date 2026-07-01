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

  // Rig Setup for Global Fiat Settlement
  const [fiatProductId, setFiatProductId] = useState<string>("3");
  const [fiatPaymentStatus, setFiatPaymentStatus] = useState<string>("IDLE");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD"); 
  
  // Manual Delivery Hex Address State
  const [fiatDeliveryAddress, setFiatDeliveryAddress] = useState<string>("");

  // ONBOARDING STRATEGY: Strategy 2 (Manual Input) & Strategy 1 (Privy Automated Embedded Wallet)
  const [onboardingStrategy, setOnboardingStrategy] = useState<string>("STRATEGY_2"); 
  const [userEmailSimulation, setUserEmailSimulation] = useState<string>("");

  const [dbLogs, setDbLogs] = useState<DbLog[]>([]);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  
  // 🏪 State controlling Pop-up dynamic QRIS Code
  const [showQrisModal, setShowQrisModal] = useState<boolean>(false);
  
  // 🔗 State capturing dynamic server-generated QRIS endpoints
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

  // 🔄 AUTO-FILL: Dynamically populate input forms if native web3 provider connects
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

  // 📡 Real-time background network node log emission listener
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

  // 🔄 REAL-TIME LOG INTERFACE SYNCHRONIZATION UPON TRANSACTION RECEIPT
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

  // 🔌 UNIFIED INTERSTELLAR WEB3 MOBILE ROUTER WITH ANTI-HIJACK PROTOCOL
  const handleConnectWallet = async (connector: any) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const cleanUrl = window.location.href.replace(/^https?:\/\//, "");
    const encodedUrl = encodeURIComponent(window.location.href);

    // GUARD DETECTOR: Intercept connection workflows if hosted inside an In-App wallet browser sandbox
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

    // FALLBACK CUSTOM URI SCHEME ROUTER: Active strictly under standard Chrome/Safari mobile environments
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
      alert("❌ Failed: Contract ABI or Smart Contract Address has not been loaded in the Management Panel.");
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

  // 🛡️ CRASH INSULATION SHIELD: Protects payable node requests from random provider RPC drop-outs
  const handleDirectBuy = (id: any, priceEth: any) => {
    if (!isConnected || !address) {
      setIsWalletModalOpen(true);
      return;
    }

    if (!parsedAbi || !currentContractAddress) {
      alert(`❌ WEB3 EXECUTION BLOCKED!\n\nSystem Error Details:\n- Data Contract ABI: ${parsedAbi ? "🟢 OK (Loaded)" : "🔴 ERROR (Empty/Failed Load)"}\n- Smart Contract Address: ${currentContractAddress ? "🟢 OK (Loaded)" : "🔴 ERROR (Empty/Undefined)"}`);
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
      console.error("Injected Provider Gas Simulation Error Intercepted:", err);
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
      alert("Warning: Smart contract ABI configuration is not ready to load in the background!");
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

    executeOnChainRelayMint();
  };

  const selectedProductData = (WHITELABEL_PRODUCTS || []).find(p => p.id === Number(fiatProductId));
  const productPriceEth = selectedProductData ? Number(selectedProductData.defaultPriceEth) : 0.05;
  const convertedFiatPrice = selectedCurrency === "USD" 
    ? `$${(productPriceEth * ETH_TO_USD_RATE).toFixed(2)} USD`
    : `Rp ${(productPriceEth * ETH_TO_IDR_RATE).toLocaleString("id-ID")}`;

  const walletAddressStr = address ? String(address) : "";

  return (
    <div style={{ backgroundColor: "#fafafa", color: "#111827", minHeight: "100vh", width: "100%", padding: "50px 20px", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', maxWidth: "1100px", margin: "0 auto", boxSizing: "border-box" }}>
      
      {/* NAVBAR HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "24px", marginBottom: "35px", flexWrap: "wrap", gap: "15px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", color: "#111827" }}>🏪 {storeName ? String(storeName) : "Web3 Digital Core"}</h1>
          <p style={{ margin: "6px 0 0 0", fontSize: "14px", color: "#6b7280" }}>Enterprise Hybrid B2B Whitelabel Gateway</p>
        </div>
        <div>
          {isConnected && walletAddressStr ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "13px", background: "#111827", color: "#ffffff", padding: "8px 14px", borderRadius: "30px", fontWeight: 600 }}>• Wallet Connected: {`${walletAddressStr.slice(0, 6)}...${walletAddressStr.slice(-4)}`}</span>
              <button onClick={() => disconnect()} style={{ background: "#ef4444", color: "white", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Sign Out</button>
            </div>
          ) : (
            <button onClick={() => setIsWalletModalOpen(true)} style={{ background: "#2563eb", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", boxShadow: "0 4px 10px rgba(37,99,235,0.2)" }}>🔌 Connect Provider Wallet</button>
          )}
        </div>
      </div>

      {/* FLOATING OVERLAY PROVIDER SELECTION MODAL */}
      {isWalletModalOpen && !isConnected && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "35px", borderRadius: "20px", width: "100%", maxWidth: "340px", textAlign: "center", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <span style={{ fontWeight: 700, fontSize: "16px", color: "#111827" }}>🔌 Select Web3 Wallet</span>
              <button type="button" onClick={() => setIsWalletModalOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* 1. Dynamic Injection Mapping via WAGMI */}
              {(connectors || []).map((connector) => {
                let displayWalletName = connector.name || "Injected Node";
                if (displayWalletName.toLowerCase() === "injected") displayWalletName = "Browser Default Extension";
                return (
                  <button key={connector.uid} onClick={() => { handleConnectWallet(connector); setIsWalletModalOpen(false); }} style={{ background: "#f9fafb", color: "#111827", border: "1px solid #e5e7eb", padding: "14px", borderRadius: "12px", cursor: "pointer", fontWeight: 700, fontSize: "14px", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>🚀 {displayWalletName}</span>
                    <span style={{ fontSize: "11px", color: "#2563eb", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>Launch</span>
                  </button>
                );
              })}

              {/* 2. Static Fallback Engine Forces Phantom & Backpack Visibility in Mobile Native Environments */}
              {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
                <>
                  {!(connectors || []).some(c => (c.name || "").toLowerCase().includes("phantom")) && (
                    <button onClick={() => { handleConnectWallet("phantom"); setIsWalletModalOpen(false); }} style={{ background: "#f9fafb", color: "#111827", border: "1px solid #e5e7eb", padding: "14px", borderRadius: "12px", cursor: "pointer", fontWeight: 700, fontSize: "14px", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>🚀 Phantom</span>
                      <span style={{ fontSize: "11px", color: "#2563eb", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>Launch</span>
                    </button>
                  )}
                  {!(connectors || []).some(c => (c.name || "").toLowerCase().includes("backpack")) && (
                    <button onClick={() => { handleConnectWallet("backpack"); setIsWalletModalOpen(false); }} style={{ background: "#f9fafb", color: "#111827", border: "1px solid #e5e7eb", padding: "14px", borderRadius: "12px", cursor: "pointer", fontWeight: 700, fontSize: "14px", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>🚀 Backpack</span>
                      <span style={{ fontSize: "11px", color: "#2563eb", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>Launch</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ✅ CIAMIK DYNAMIC POP-UP MODAL QRIS INDONESIA */}
      {showQrisModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 99999 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "35px", borderRadius: "20px", width: "100%", maxWidth: "380px", textAlign: "center", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", color: "#e04f1a", margin: 0, fontSize: "16px" }}>
                💾 GPN / QRIS STANDAR NASIONAL
              </h3>
              <button type="button" onClick={() => setShowQrisModal(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <div style={{ background: "#ffffff", padding: "16px", borderRadius: "14px", display: "inline-block", border: "1px solid #e5e7eb" }}>
              <img src={dynamicQrisUrl || fallbackQrisUrl} width="190" alt="QRIS" />
            </div>
            <div style={{ marginTop: "12px" }}>
              <button type="button" onClick={downloadQris} style={{ background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>💾 Download QRIS Code</button>
            </div>
            <div style={{ background: "#fef3c7", color: "#92400e", padding: "12px", borderRadius: "10px", fontSize: "12px", margin: "15px 0", textAlign: "left", wordBreak: "break-all" }}>
              <strong>📍 NFT Delivery Target:</strong><br />
              <code style={{ fontSize: "11px", fontWeight: 700 }}>
                {onboardingStrategy === "STRATEGY_2" && (fiatDeliveryAddress || "0x95222... Fallback")}
                {onboardingStrategy === "STRATEGY_1" && `📧 ${userEmailSimulation} (Auto Embedded Wallet)`}
              </code>
            </div>
            <div style={{ margin: "20px 0", fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "12px", borderRadius: "10px", fontSize: "14px" }}>Total: {convertedFiatPrice}</div>
            <button type="button" onClick={executeOnChainRelayMint} style={{ width: "100%", background: "#10b981", color: "white", padding: "12px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px" }}>
              Konfirmasi Pembayaran
            </button>
          </div>
        </div>
      )}

      {/* SYSTEM BROADCAST NETWORK STATE MONITOR */}
      {(isTxPending || txHash || txError || connectError || fiatPaymentStatus === "PROCESSING") && (
        <div style={{ background: "#ffffff", padding: "20px", borderRadius: "12px", marginBottom: "35px", border: "1px solid #e5e7eb" }}>
          <h4 style={{ marginTop: 0, marginBottom: "8px", fontWeight: 700, fontSize: "14px", textTransform: "uppercase", color: "#4b5563" }}>⚡ System Broadcast Monitor:</h4>
          {fiatPaymentStatus === "PROCESSING" && <p style={{ color: "#2563eb", margin: 0, fontSize: "14px", fontWeight: 500 }}>⏳ Awaiting confirmation...</p>}
          {isTxPending && <p style={{ color: "#d97706", margin: 0, fontSize: "14px", fontWeight: 500 }}>⏳ Processing node signature approval...</p>}
          {txHash && <p style={{ color: "#059669", margin: 0, fontSize: "14px", fontWeight: 600, wordBreak: "break-all" }}>✅ Settled! Tx Hash: <code>{txHash}</code></p>}
          {txError && <p style={{ color: "#dc2626", margin: 0, fontSize: "14px", fontWeight: 500 }}>❌ Smart Contract Error: {txError.message.split("\n")[0]}</p>}
        </div>
      )}

      {/* B2B DIGITAL SOLUTIONS CATALOG */}
      <div style={{ marginBottom: "50px" }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: 700, color: "#111827" }}>🛒 B2B Digital Solutions Catalog</h3>
        <p style={{ margin: "0 0 25px 0", fontSize: "14px", color: "#6b7280" }}>Direct on-chain procurement infrastructure for enterprise infrastructure items.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
          {(WHITELABEL_PRODUCTS || []).map((prod: Product) => {
            const priceEth = prod.defaultPriceEth || "0.05";
            const priceUsd = (Number(priceEth) * ETH_TO_USD_RATE).toFixed(0);
            const cardTheme = cardThemes[prod.id] || { bg: "#ffffff", border: "#e5e7eb" };
            return (
              <div key={prod.id} style={{ background: cardTheme.bg, border: `1px solid ${cardTheme.border}`, borderRadius: "16px", padding: "26px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ background: "#ffffff", color: "#1f2937", padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, border: `1px solid ${cardTheme.border}` }}>SKU-0{prod.id}</span>
                    <span style={{ color: isConnected ? "#10b981" : "#ef4444", fontSize: "12px", fontWeight: 600 }}>● {isConnected ? "Network Live" : "Secure Blocked"}</span>
                  </div>
                  <h4 style={{ margin: "18px 0 8px 0", fontSize: "18px", fontWeight: 700, color: "#111827" }}>{prod.name}</h4>
                  <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#4b5563" }}>{prod.description}</p>
                </div>
                <div>
                  <div style={{ borderTop: `1px solid ${cardTheme.border}`, paddingTop: "16px", marginBottom: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: "20px", fontWeight: 800, color: "#111827" }}>{priceEth} ETH</span>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>${priceUsd} USD</span>
                    </div>
                  </div>
                  <button type="button" disabled={isTxPending} onClick={() => { if (!isConnected) { setIsWalletModalOpen(true); } else { handleDirectBuy(prod.id, priceEth); } }} style={{ width: "100%", background: !isConnected ? "#111827" : "#2563eb", color: "#ffffff", border: "none", padding: "13px 0", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                    {!isConnected ? "🔌 Connect Wallet to Buy" : "⚡ Purchase via Web3 Node"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: "25px", flexWrap: "wrap", marginBottom: "40px" }}>
        
        {/* GLOBAL DATABASE ORDER LOGS */}
        <div style={{ background: "#f0f7ff", padding: "25px", borderRadius: "14px", border: "1px solid #3b82f6", flex: "1", minWidth: "300px" }}>
          <h3 style={{ marginTop: 0, color: "#1d4ed8", fontSize: "17px", fontWeight: 700 }}>📊 Global Database Order Logs</h3>
          <p style={{ fontSize: "13px", color: "#2563eb", marginTop: "-4px" }}>Unified dashboard recording incoming cross-border settlement event emissions.</p>
          <div style={{ maxHeight: "380px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
            {dbLogs.length === 0 ? (
              <div style={{ background: "#ffffff", padding: "20px", borderRadius: "8px", textAlign: "center", color: "#9ca3af", border: "1px dashed #bfdbfe" }}>📭 No dynamic billing data synchronized yet.</div>
            ) : (
              (dbLogs || []).map((log: DbLog, index: number) => (
                <div key={index} style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #bfdbfe", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 700, color: "#059669" }}>📩 Token ID: {log.tokenId}</span>
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

        {/* ✅ INTEGRATED ENGINE CARD DESIGN */}
        <div style={{ background: "#fff7ed", padding: "25px", borderRadius: "14px", border: "1px solid #f97316", flex: "1", minWidth: "300px" }}>
          <form onSubmit={handleFiatSimulationSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3>💳 Hybrid Settlement Engine</h3>
            
            {/* ✅ INTEGRATED RADIO METRICS SNIPPET */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input type="radio" name="currency" value="USD" checked={selectedCurrency === "USD"} onChange={() => setSelectedCurrency("USD")} />
                <span>💳 Credit Card</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input type="radio" name="currency" value="IDR" checked={selectedCurrency === "IDR"} onChange={() => setSelectedCurrency("IDR")} />
                <span>💾 QRIS Payment</span>
              </label>
            </div>

            {/* 🗺️ ENGLISH LOCALIZED ONBOARDING ARCHITECTURE SELECTOR */}
            <div style={{ background: "#ffffff", padding: "18px", borderRadius: "12px", border: "1px solid #fdba74" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#c2410c", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                🗺️ Web3 Onboarding Delivery Strategy (Architecture Mode):
              </label>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                
                {/* STRATEGY 2 - WALLET ACTIVE */}
                <label style={{ 
                  fontSize: "12px", 
                  display: "flex", 
                  alignItems: "start", 
                  gap: "10px", 
                  cursor: "pointer", 
                  color: "#111827",
                  padding: "12px",
                  borderRadius: "8px",
                  border: onboardingStrategy === "STRATEGY_2" ? "2px solid #2563eb" : "1px solid #e5e7eb",
                  background: onboardingStrategy === "STRATEGY_2" ? "#f8fafc" : "#ffffff",
                  transition: "all 0.2s ease"
                }}>
                  <input type="radio" name="strategy" value="STRATEGY_2" checked={onboardingStrategy === "STRATEGY_2"} onChange={() => setOnboardingStrategy("STRATEGY_2")} style={{ marginTop: "3px" }} />
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "5px" }}>
                      <strong>Strategy 2: Manual Wallet Form Input</strong>
                      <span style={{ fontSize: "10px", background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "20px", fontWeight: 700 }}>🟢 WALLET ON (WEB3 NATIVE MODE)</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>The customer links their personal hardware or browser extension web3 asset address manually or automatically via connection hooks.</div>
                  </div>
                </label>

                {/* STRATEGY 1 - WALLET OFF */}
                <label style={{ 
                  fontSize: "12px", 
                  display: "flex", 
                  alignItems: "start", 
                  gap: "10px", 
                  cursor: "pointer", 
                  color: "#111827",
                  padding: "12px",
                  borderRadius: "8px",
                  border: onboardingStrategy === "STRATEGY_1" ? "2px solid #10b981" : "1px solid #e5e7eb",
                  background: onboardingStrategy === "STRATEGY_1" ? "#f0fdf4" : "#ffffff",
                  transition: "all 0.2s ease"
                }}>
                  <input type="radio" name="strategy" value="STRATEGY_1" checked={onboardingStrategy === "STRATEGY_1"} onChange={() => setOnboardingStrategy("STRATEGY_1")} style={{ marginTop: "3px" }} />
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "5px" }}>
                      <strong>Strategy 1: Auto Email Embedded Wallet</strong>
                      <span style={{ fontSize: "10px", background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: "20px", fontWeight: 700 }}>🔴 WALLET OFF (RETAIL USER MODE)</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#047857", marginTop: "2px", fontWeight: 500 }}>No prior web3 knowledge required. The backend automatically provisions an isolated Privy-certified embedded cryptographic vault tied directly to the customer's email ID.</div>
                  </div>
                </label>

              </div>
            </div>

            {/* DYNAMIC FORM SEGMENTS (ENGLISH TRANSLATED UI SPEC) */}
            {onboardingStrategy === "STRATEGY_2" && (
              <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px", color: "#111827" }}>📍 ENTER ERC-20 RECIPIENT WALLET ADDRESS FOR NFT:</label>
                <input type="text" placeholder="Enter 0x..." value={fiatDeliveryAddress} onChange={(e) => setFiatDeliveryAddress(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827", fontFamily: "monospace" }} required />
                <span style={{ fontSize: "10px", color: "#6b7280", marginTop: "4px", display: "block" }}>
                  *NFTs minted via the fiat/QRIS route will be instantly routed to the hex address specified above.
                </span>
              </div>
            )}

            {onboardingStrategy === "STRATEGY_1" && (
              <div style={{ background: "rgba(16, 185, 129, 0.05)", padding: "12px", borderRadius: "8px", border: "1px solid #a7f3d0" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, marginBottom: "4px", color: "#065f46" }}>📧 RETAIL BUYER EMAIL (AUTO GENERATE WALLET):</label>
                <input type="email" placeholder="example: retailbuyer@gmail.com" value={userEmailSimulation} onChange={(e) => setUserEmailSimulation(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #a7f3d0", fontSize: "12px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
                <span style={{ fontSize: "10px", color: "#047857", marginTop: "4px", display: "block" }}>*Backend system automatically converts the above email into a Privy-certified Web3 wallet!</span>
              </div>
            )}

            {/* MASKING ENGINE INCORPORATED ACCORDING TO SPECS */}
            {selectedCurrency === "IDR" ? (
              <div style={{ marginTop: "4px", padding: "12px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #fed7aa", fontSize: "12px", color: "#c2410c", fontWeight: 600 }}>🎯 QRIS Core Active. Dynamic QR code ready to deploy.</div>
            ) : (
              <div style={{ marginTop: "4px", backgroundColor: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #fed7aa" }}>
                <input 
                  type="text" 
                  placeholder="0000 0000 0000 0000" 
                  maxLength={19} 
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, "");
                    value = value.replace(/(.{4})/g, "$1 ").trim();
                    e.target.value = value;
                  }}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px", marginBottom: "8px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827", fontFamily: "monospace" }} 
                  required 
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <input 
                    type="text" 
                    placeholder="MM / YYYY" 
                    maxLength={9} 
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "");
                      if (v.length > 2) {
                        v = v.slice(0, 2) + " / " + v.slice(2, 6);
                      }
                      e.target.value = v;
                    }}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} 
                    required 
                  />
                  <input 
                    type="password" 
                    placeholder="CVC" 
                    maxLength={3} 
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} 
                    required 
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px", color: "#4b5563" }}>4. Select Solutions Product:</label>
              <select value={fiatProductId} onChange={(e) => setFiatProductId(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }}>
                {(WHITELABEL_PRODUCTS || []).map((p: Product) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #fed7aa", fontSize: "13px", color: "#111827" }}>
              <strong>Calculated Billing Value:</strong> <span style={{ color: "#c2410c", fontWeight: 700 }}>{convertedFiatPrice}</span>
            </div>

            <button type="submit" disabled={fiatPaymentStatus === "PROCESSING" || isFetchingQris} style={{ width: "100%", background: "#f97316", color: "white", border: "none", padding: "12px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>
              {isFetchingQris ? "Opening API Gateway..." : `Simulate Checkout via ${selectedCurrency}`}
            </button>
          </form>
        </div>

      </div>

      {/* INTERNAL MANAGEMENT PANEL (OPERATOR ONLY) */}
      {isConnected && address?.toLowerCase() === "0xc7ac22cbe2c96c308dafbec609025c03a713fe01" && (
        <div style={{ background: "#fdf4ff", padding: "25px", borderRadius: "14px", border: "1px solid #d946ef", marginTop: "30px" }}>
          <h3 style={{ marginTop: 0, color: "#a21caf", fontSize: "16px", fontWeight: 700 }}>🛠️ Internal Management Panel (Operator Only)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <form onSubmit={handleSetPrice} style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "end", width: "100%" }}>
              <div style={{ flex: "1", minWidth: "150px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "#4b5563" }}>Product Target ID:</label>
                <input type="number" value={adminProductId} onChange={(e) => setAdminProductId(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
              </div>
              <div style={{ flex: "1", minWidth: "150px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "#4b5563" }}>New Ledger Rate (ETH):</label>
                <input type="text" value={adminPrice} onChange={(e) => setAdminPrice(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #d1d5db", boxSizing: "border-box", backgroundColor: "#ffffff", color: "#111827" }} required />
              </div>
              <button type="submit" disabled={!isConnected || isTxPending} style={{ background: "#d946ef", color: "white", border: "none", padding: "11px 22px", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>Override Price Rate</button>
            </form>
            <div style={{ borderTop: "1px dashed #d946ef", paddingTop: "15px" }}>
              <button type="button" disabled={!isConnected || isTxPending} onClick={handleWithdrawFunds} style={{ background: "#6b21a8", color: "white", border: "none", padding: "12px 24px", borderRadius: "6px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>💰 Emergency Withdraw Contract Funds</button>
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#701a75", fontWeight: 500 }}>
                *Withdraw all accumulated ETH locked within this Smart Contract network directly to the primary admin wallet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 🌐 ENTERPRISE FOOTER & COPYRIGHT ARCHITECTURE */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "30px", marginTop: "40px", textAlign: "center", fontSize: "14px", color: "#6b7280" }}>
        <p style={{ margin: "0 0 8px 0", fontWeight: 500 }}>
          © 2026 <strong>ZoniqFi</strong>. All rights reserved. Enterprise Hybrid B2B Core Settlement Protocol.
        </p>
        <p style={{ margin: 0 }}>
          Powered by Ecosystem Node Deployments • Connect via{" "}
          <a 
            href="https://zoniqfi.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none", borderBottom: "1px dashed #2563eb" }}
          >
            ZoniqFi Network Core 🌐
          </a>
        </p>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <MainApp />
        </WagmiProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}