import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DigitalGoodsStoreModule = buildModule("DigitalGoodsStoreModule", (m) => {
  // Ambil akun deployer pertama secara otomatis
  const deployer = m.getAccount(0);

  // Deploy kontrak dan masukkan alamat deployer sebagai initialOwner di constructor
  const digitalGoodsStore = m.contract("DigitalGoodsStore", [deployer]);

  return { digitalGoodsStore };
});

export default DigitalGoodsStoreModule;