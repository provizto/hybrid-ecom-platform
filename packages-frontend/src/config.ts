import { http, createConfig } from 'wagmi'
import { hardhat } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [hardhat],
  connectors: [
    injected(), 
  ],
  transports: {
    // Paksa langsung ke IP IPv4, jangan pakai kata 'localhost' agar tidak di-resolve ke IPv6 oleh Windows
    [hardhat.id]: http('http://127.0.0.1:8545'), 
  },
})