import { http, createConfig } from "wagmi";
import { mainnet, polygon, polygonAmoy } from "wagmi/chains";
import { injected, metaMask, phantom } from "wagmi/connectors";

export const config = createConfig({
  chains: [mainnet, polygon, polygonAmoy],
  connectors: [
    injected(), // Fallback untuk dApp browser bawaan dompet
    metaMask(), // Memunculkan tombol khusus MetaMask (Pemicu Deep Link)
    phantom(),  // Memunculkan tombol khusus Phantom (Pemicu Deep Link)
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
  },
});