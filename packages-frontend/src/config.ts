import { http, createConfig } from "wagmi";
import { mainnet, polygon, polygonAmoy } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors"; // 🌟 Bersih dari 'phantom' yang ilegal

export const config = createConfig({
  chains: [mainnet, polygon, polygonAmoy],
  connectors: [
    injected(), // 🔥 Sakti! Otomatis mendeteksi Phantom, Backpack, dll secara terpisah via EIP-6963
    metaMask(), // Tombol khusus pengetuk MetaMask
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
  },
});