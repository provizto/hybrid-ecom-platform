# Web3 Digital Core - Enterprise Hybrid B2B Whitelabel Gateway

Welcome to your Enterprise Hybrid Payment Infrastructure. This repository contains the complete frontend architecture for the whitelabel digital goods and licensing gateway, optimized for seamless integration with Web3 smart contracts and traditional fiat settlement systems.

## 🚀 Quick Start & Local Deployment

Follow these steps to set up and run the platform locally on your machine:

1. **Extract the Package:**
   Extract the provided source code ZIP file into your desired working directory.

2. **Navigate to Frontend Directory:**
   ```bash
   cd packages-frontend

1. Install Dependencies:
We highly recommend using pnpm or npm to clean install the core node modules:
   ```bash
   pnpm install
   # or
   npm install

2. Environment Configuration:
   Create a .env file in the root of the packages-frontend directory and provide your live smart contract address:
   ```code
   VITE_CONTRACT_ADDRESS=your_deployed_smart_contract_address_here

3. Run Development Server:
   ```bash
   pnpm run dev
   # or
   npm run dev

Open http://localhost:5173 in your browser to view the application.

☁️ Deploying to Production (Vercel)
   This core engine is fully optimized for cloud native deployment on Vercel.

   1. Connect this repository to your Vercel Dashboard.

   2. Set the Framework Preset to Vite.

   3. Set the Root Directory to packages-frontend.

   4. Leave the Build and Install commands as default (Vercel will automatically  manage the pipeline using its secure Linux environment).

   5. Click Deploy. Your enterprise platform will be live within seconds!

🛠️ Main Features Included
   Multi-Chain/Web3 Direct Buy Setup: Injected wallet connections (MetaMask, Phantom, Backpack) to interact with smart contract asset distribution protocols on-chain.

   Hybrid International Fiat Settlement Engine: Pre-configured UI relays to trigger simulated fiat pipelines (Stripe/QRIS) that invoke backend automated relay minting.

   Unified Database Order Logs: Real-time event subscription log filters to display cross-border settlement admissions.

   Internal Management Panel: Dynamic rate modifier interfaces to instantly override blockchain ledger value rates directly from the operator terminal.

For further customization, white-label UI branding, or dedicated backend API support, please contact your primary system distribution operator.