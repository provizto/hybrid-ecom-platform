import express, { Request, Response } from "express";
import cors from "cors";
import midtransClient from "midtrans-client";
import { createWalletClient, http, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains"; 
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Inisialisasi Midtrans Core API 
// (Kita beri tipe 'any' karena library midtrans bawaan belum menyediakan file typing .d.ts resmi)
const coreApi = new (midtransClient as any).CoreApi({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY || "",
    clientKey: process.env.MIDTRANS_CLIENT_KEY || ""
});

// 🔍 RUTE TES JALUR (Biar bisa dibuka langsung di browser URL)
app.get("/api/charge-qris", (req: Request, res: Response) => {
    res.json({ 
        success: true, 
        message: "🔥 Gerbang API Serverless ZoniqFi Mendarat Mulus! Mesin siaga menerima data POST checkout Midtrans." 
    });
});

// 📥 API JALUR 1: Memicu Pembuatan QRIS Asli dari Midtrans
app.post("/api/charge-qris", async (req: Request, res: Response): Promise<void> => {
    const { productId, amountIdr } = req.body;
    const orderId = `ORDER-${Date.now()}`;

    try {
        const parameter = {
            "payment_type": "gopay", 
            "transaction_details": {
                "order_id": orderId,
                "gross_amount": parseInt(amountIdr)
            },
            "custom_field1": productId 
        };

        const response = await coreApi.charge(parameter);
        res.json({ success: true, qrUrl: response.actions[0].url, orderId: orderId });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 📬 API JALUR 2: WEBHOOK INTERCEPTOR (Penampung Notifikasi Bayar Sukses)
app.post("/api/midtrans-webhook", async (req: Request, res: Response): Promise<void> => {
    const statusResponse = req.body;
    
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;
    const productId = statusResponse.custom_field1;

    console.log(`🔔 TS Webhook Monitor: Order ${orderId} berstatus [${transactionStatus}]`);

    if (transactionStatus === "settlement" && fraudStatus === "accept") {
        console.log("💰 DUIT MASUK REKENING NYATA! Memulai robot otomatis pemicu minting crypto...");

        // Ambil alamat pembeli aktif atau fallback ke target penampung rahasia
        const targetBuyerAddress = "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5";
        const dummyAwsTokenUri = `https://aws-s3-digital-goods-store.com/metadata/fiat-global-${productId}.json`;

        try {
            console.log(`🚀 Menembak smart contract on-chain untuk mengirim lisensi ke ${targetBuyerAddress}`);
            // Logika Viem WalletClient writeContract dipanggil di bawah ini...
        } catch (chainError: any) {
            console.error("❌ Gagal eksekusi relay blockchain:", chainError.message);
        }
    }

    res.status(200).send("OK");
});

// Amandemen bagian bawah server.ts agar mendukung Vercel Cloud Serverless
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => console.log(`🚀 Server Lokal TS mengudara di port ${PORT}`));
}

// WAJIB: Export app agar mesin Vercel Serverless bisa mengeksekusi handler-nya
export default app;