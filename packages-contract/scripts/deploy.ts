import hre from "hardhat";
import { createWalletClient, createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  console.log("🚀 [Hardhat 3] Memulai deployment dengan arsitektur Viem Native...");

  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.SEPOLIA_RPC_URL;

  if (!privateKey || !rpcUrl) {
    throw new Error("🚨 Eror: PRIVATE_KEY atau SEPOLIA_RPC_URL tidak ditemukan di file .env!");
  }

  const formattedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedPrivateKey as `0x${string}`);
  
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  console.log("Deploying contracts with the account:", account.address);

  const artifact = await hre.artifacts.readArtifact("DigitalGoodsStore");

  // 🌟 JURUS PENYELAMAT:
  // 1. Jika kontrak lu punya constructor dengan argumen, masukkan ke array [] di bawah ini
  // 2. gas: 4000000n (meningkatkan limit agar tidak revert karena out-of-gas)
  const constructorArgs: any[] = []; 

  console.log("Mengirim transaksi deployment ke Sepolia Testnet...");
  
  try {
    const hash = await walletClient.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode as `0x${string}`,
      args: constructorArgs, // Masukkan argumen di sini jika ada
      gas: 4000000n,         // Memberikan "ruang napas" lebih besar
    });

    console.log("Transaction Hash:", hash);
    console.log("Menunggu konfirmasi block transaksi...");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log("==================================================");
    console.log("🎉 CONTRACT DEPLOYED SUCCESSFULLY TO SEPOLIA!");
    console.log("Contract Address:", receipt.contractAddress);
    console.log("==================================================");
  } catch (error: any) {
    console.error("❌ Deployment Gagal!");
    console.error("Pesan Eror:", error.shortMessage || error.message);
    // Jika ada revert, pesan ini akan memberi tahu alasannya
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});