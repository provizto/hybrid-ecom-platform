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

// 📁 Membaca file private-key.pem rahasia dari lokal folder
const __dirname = path.resolve();
const privateKeyPath = path.join(__dirname, 'private-key.pem');
let privateKey = '';

try {
    if (fs.existsSync(privateKeyPath)) {
        privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        console.log('🔒 [SNAP BI] Kunci Privat RSA berhasil dimuat ke memori server.');
    } else {
        console.warn('⚠️ [Peringatan] File private-key.pem tidak ditemukan!');
    }
} catch (err) {
    console.error('❌ Gagal membaca file enkripsi .pem:', err);
}

// 🧠 Helper SNAP BI Signature Generator
function generateSnapSignature(clientId: string, timestamp: string): string {
    if (!privateKey) throw new Error('Kunci privat kosong!');
    const stringToSign = `${clientId}|${timestamp}`;
    const sign = crypto.createSign('SHA256');
    sign.update(stringToSign);
    sign.end();
    return sign.sign(privateKey, 'base64');
}

app.get("/api/charge-qris", (req: Request, res: Response) => {
    res.json({ success: true, message: "Server siaga menerima data POST." });
});

// 📡 ENGINE UTAMA: Menggunakan CORE API untuk membuat barcode QRIS asli
app.post('/api/charge-qris', async (req: Request, res: Response) => {
    try {
        const { productId, amountIdr } = req.body;
        const currentTimestamp = new Date().toISOString();
        const mockClientId = process.env.MIDTRANS_CLIENT_KEY || 'MOCK_CLIENT_ID';

        console.log(`\n================= 📥 MASUKNYA TRANSAKSI QRIS CORE =================`);
        console.log(`[${currentTimestamp}] Memproses SKU-0${productId} senilai Rp ${amountIdr.toLocaleString('id-ID')}`);

        // Buat segel tanda tangan digital SNAP BI
        let snapSignature = 'SIMULATED_SIGNATURE';
        if (privateKey) {
            snapSignature = generateSnapSignature(mockClientId, currentTimestamp);
        }

        // 🔥 PINDAH KE CORE API: Biar dapet gambar QRIS mentah asli
        let coreApi = new midtransClient.CoreApi({
            isProduction: false,
            serverKey: process.env.MIDTRANS_SERVER_KEY,
            clientKey: process.env.MIDTRANS_CLIENT_KEY
        });

        const orderId = `HYBRID-CORE-${productId}-${Date.now()}`;
        
        // Parameter khusus metode pembayaran QRIS Midtrans
        let parameter = {
            "payment_type": "qris",
            "transaction_details": {
                "order_id": orderId,
                "gross_amount": amountIdr
            },
            "qris": {
                "acquirer": "gopay" // Menggunakan network gopay/qris sandbox resmi
            },
            "item_details": [{
                "id": `SKU-0${productId}`,
                "price": amountIdr,
                "quantity": 1,
                "name": `Web3 Digital Core License B2B`
            }]
        };

        const transaction = await coreApi.charge(parameter);
        
        // 🎯 EKSTRAKSI URL GAMBAR: Cari aksi pembuatan QR Code dari payload Midtrans
        const qrAction = transaction.actions?.find((action: any) => action.name === 'generate-qr-code');
        const midtransQrUrl = qrAction ? qrAction.url : '';

        if (!midtransQrUrl) {
            throw new Error("Gagal mendapatkan link gambar QRIS dari respon Midtrans.");
        }

        console.log(`🎯 [QRIS Image URL Berhasil Ditempa]: ${midtransQrUrl}`);

        res.status(200).json({
            success: true,
            orderId: orderId,
            qrUrl: midtransQrUrl, // Ini sekarang berisi link gambar asli (.png/.jpg dari Midtrans)
            security: {
                timestamp: currentTimestamp,
                signature: snapSignature
            }
        });

    } catch (error: any) {
        console.error('❌ Sistem Core API Gagal Menempa QRIS:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log(`🚀 Server Backend TS Mengudara Mulus di Port ${PORT}`);
    });
}

export default app;