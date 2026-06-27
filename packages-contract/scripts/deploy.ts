import hre from "hardhat";

async function main() {
  console.log("🚀 [Hardhat 3] Memulai deployment Smart Contract...");

  // Di Hardhat 3, ethers dipanggil via objek runtime 'hre'
  const ethers = (hre as any).ethers;
  if (!ethers) {
    throw new Error("Plugin @nomicfoundation/hardhat-ethers belum terpasang atau belum di-import di hardhat.config.ts");
  }

  // Mengambil library contract berdasarkan nama smart contract lu
  const StoreContract = await ethers.getContractFactory("DigitalGoodsStore");
  
  // Eksekusi deploy ke network target
  const store = await StoreContract.deploy();

  // Menunggu kontrak resmi tervalidasi di blok blockchain lokal
  await store.waitForDeployment();

  const contractAddress = await store.getAddress();
  console.log("\n====================================================");
  console.log(`✅ SUCCESS! Smart Contract Resmi Ter-deploy via Hardhat 3!`);
  console.log(`📍 Alamat Contract Baru: ${contractAddress}`);
  console.log("====================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });