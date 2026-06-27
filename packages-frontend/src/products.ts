export interface Product {
  id: number;
  name: string;
  description: string;
  defaultPriceEth: string;
}

export const WHITELABEL_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Enterprise SaaS License",
    description: "Lifetime access token for the white-label B2B core software architecture.",
    defaultPriceEth: "0.05",
  },
  {
    id: 2,
    name: "Developer API Access Token",
    description: "Production-grade API access for automated secure Web3 checkout integrations.",
    defaultPriceEth: "0.08",
  },
  {
    id: 3,
    name: "Premium Web3 UI Toolkit",
    description: "Pre-built React components designed optimized for blockchain-fiat commerce.",
    defaultPriceEth: "0.03",
  }
];