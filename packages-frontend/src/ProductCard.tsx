import { useReadContract, useAccount } from "wagmi";
import { formatEther } from "viem";
import type { Product } from "./products";

interface ProductCardProps {
  product: Product;
  contractAddress: `0x${string}` | undefined;
  abi: any;
  onBuy: (id: number, priceEth: string) => void;
  isTxPending: boolean;
}

export function ProductCard({ product, contractAddress, abi, onBuy, isTxPending }: ProductCardProps) {
  const { isConnected } = useAccount();

  const { data: blockchainPrice } = useReadContract({
    address: contractAddress,
    abi: abi || [],
    functionName: "productPrices",
    args: [BigInt(product.id)],
    query: { enabled: !!abi && !!contractAddress }
  });

  let finalPriceEth = product.defaultPriceEth;
  if (blockchainPrice !== undefined && blockchainPrice !== null) {
    try {
      const priceBigInt = BigInt(blockchainPrice.toString());
      if (priceBigInt > 0n) {
        finalPriceEth = formatEther(priceBigInt);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const bgGradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #13547a 0%, #80d0c7 100%)",
    "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)"
  ];
  const cardBg = bgGradients[(Number(product.id) - 1) % bgGradients.length];

  return (
    <div style={{
      background: "#ffffff",
      borderRadius: "12px",
      border: "1px solid #e1e8ed",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 4px 6px rgba(0,0,0,0.02)"
    }}>
      <div style={{ width: "100%", height: "140px", background: cardBg, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "24px" }}>
        SKU-0{product.id}
      </div>

      <div style={{ padding: "20px", flexGrow: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
        <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>{product.name}</h4>
        <p style={{ margin: 0, fontSize: "13px", color: "#657786", lineHeight: "1.4" }}>{product.description}</p>
        
        <div style={{ marginTop: "auto", paddingTop: "15px", borderTop: "1px solid #f5f8fa" }}>
          <div style={{ fontSize: "12px", color: "#657786", marginBottom: "2px" }}>Settlement Rate:</div>
          <div style={{ fontSize: "18px", fontWeight: "bold", color: "#2f9e44" }}>{finalPriceEth} ETH</div>
          
          <button
            onClick={() => onBuy(product.id, finalPriceEth)}
            disabled={!isConnected || isTxPending}
            style={{
              width: "100%",
              marginTop: "12px",
              background: isConnected ? "#2f9e44" : "#a6a6a6",
              color: "white",
              border: "none",
              padding: "10px",
              borderRadius: "6px",
              cursor: isConnected ? "pointer" : "not-allowed",
              fontWeight: "bold",
              fontSize: "14px"
            }}
          >
            {isConnected ? "Purchase Asset" : "Connect Wallet to Buy"}
          </button>
        </div>
      </div>
    </div>
  );
}