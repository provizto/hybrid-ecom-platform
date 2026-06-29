import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import midtransClient from 'midtrans-client';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 📁 AMANKAN JALUR: Membaca file private-key.pem rahasia dari lokal folder
const __dirname = path.resolve();
const privateKeyPath = path.join(__dirname, 'private-key.pem');
let privateKey = '';

try {
    if (fs.existsSync(privateKeyPath)) {
        privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        console.log('🔒 [SNAP BI] Kunci Privat RSA berhasil dimuat ke memori server.');
    } else {
        console.warn('⚠️ [Peringatan] File private-key.pem tidak ditemukan di root backend!');
    }
} catch (err) {
    console.error('❌ Gagal membaca file enkripsi .pem:', err);
}

// 🧠 HELPER FUNCTION: Membuat Asymmetric Signature sesuai standarisasi SNAP BI Bank Indonesia
function generateSnapSignature(clientId: string, timestamp: string): string {
    if (!privateKey) throw new Error('Kunci privat kosong atau tidak valid!');
    
    // Rumus baku SNAP BI untuk Asymmetric Signature (Access Token Request)
    // StringToSign = Client-Id + "|" + X-Timestamp
    const stringToSign = `${clientId}|${timestamp}`;
    
    const sign = crypto.createSign('SHA256');
    sign.update(stringToSign);
    sign.end();
    
    // Kembalikan dalam bentuk format Base64 asli
    return sign.sign(privateKey, 'base64');
}

// 🔍 RUTE TES JALUR (Biar bisa dibuka langsung di browser URL)
app.get("/api/charge-qris", (req: Request, res: Response) => {
    res.json({ 
        success: true, 
        message: "🔥 Gerbang API Serverless ZoniqFi Mendarat Mulus! Mesin siaga menerima data POST checkout Midtrans." 
    });
});

// 📡 API GATEWAY: Pembuat Kontrak Transaksi QRIS Core
app.post('/api/charge-qris', async (req: Request, res: Response) => {
    try {
        const { productId, amountIdr } = req.body;
        const currentTimestamp = new Date().toISOString();
        const mockClientId = process.env.MIDTRANS_CLIENT_KEY || 'MOCK_CLIENT_ID';

        console.log(`\n================= 📥 MASUKNYA TRANSAKSI SNAP BI =================`);
        console.log(`[${currentTimestamp}] Memproses SKU-0${productId} senilai Rp ${amountIdr.toLocaleString('id-ID')}`);

        // 🔐 PEMBUATAN SEGEL ASYMMETRIC SIGNATURE
        let snapSignature = 'SIMULATED_SIGNATURE_FALLBACK';
        if (privateKey) {
            snapSignature = generateSnapSignature(mockClientId, currentTimestamp);
            console.log(`🔑 [SNAP BI Signature Generated]: ${snapSignature.slice(0, 25)}...`);
        }

        // --- RIG ENGINERING CORE MIDTRANS SANDBOX (Lokal/Core API Hybrid) ---
        let snap = new midtransClient.Snap({
            isProduction: false,
            serverKey: process.env.MIDTRANS_SERVER_KEY
        });

        const orderId = `HYBRID-CORE-${productId}-${Date.now()}`;
        
        let parameter = {
            "transaction_details": {
                "order_id": orderId,
                "gross_amount": amountIdr
            },
            "item_details": [{
                "id": `SKU-0${productId}`,
                "price": amountIdr,
                "quantity": 1,
                "name": `Web3 Digital Core License B2B`
            }],
            "payment_type": "gopay" // Gerbang QRIS Sandbox Midtrans dijembatani lewat protokol gopay mpm
        };

        const transaction = await snap.createTransaction(parameter);
        
        // Ekstraksi URL Kode Batang QRIS Dinamis Asli dari payloads Midtrans
        const midtransQrUrl = `https://api.sandbox.midtrans.com/v2/gopay/${transaction.token}/qr-code`;
        console.log(`🎯 [Midtrans Link QRIS Berhasil Ditempa]: ${midtransQrUrl}`);

        res.status(200).json({
            success: true,
            orderId: orderId,
            qrUrl: midtransQrUrl,
            snapToken: transaction.token,
            security: {
                timestamp: currentTimestamp,
                signatureRoute: "SHA256withRSA",
                signature: snapSignature
            }
        });

    } catch (error: any) {
        console.error('❌ Sistem Rig Engine Gagal Menempa QRIS:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Jalankan Mesin Server secara lokal jika tidak di lingkungan produksi awan
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log(`🚀 Server Backend TS Mengudara Mulus di Port ${PORT}`);
    });
}

export default app;