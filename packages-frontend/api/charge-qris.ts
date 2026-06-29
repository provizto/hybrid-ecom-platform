import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import midtransClient from 'midtrans-client';

// 🔐 Kunci Privat dibaca langsung dari sistem Environment Variable Vercel
const privateKey = process.env.MIDTRANS_PRIVATE_KEY || '';

function generateSnapSignature(clientId: string, timestamp: string): string {
  if (!privateKey) throw new Error('Kunci privat kosong!');
  const stringToSign = `${clientId}|${timestamp}`;
  const sign = crypto.createSign('SHA256');
  sign.update(stringToSign);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // bypass satpam CORS browser agar handphone bisa masuk aman
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ success: true, message: "🚀 Mesin Serverless QRIS Vercel Siaga penuh!" });
  }

  if (req.method === 'POST') {
    try {
      const { productId, amountIdr } = req.body;
      const currentTimestamp = new Date().toISOString();
      const mockClientId = process.env.MIDTRANS_CLIENT_KEY || 'MOCK_CLIENT_ID';

      let snapSignature = 'SIMULATED_SIGNATURE';
      if (privateKey) {
        snapSignature = generateSnapSignature(mockClientId, currentTimestamp);
      }

      // Hubungkan ke Core API Midtrans Sandbox
      const coreApi = new midtransClient.CoreApi({
        isProduction: false,
        serverKey: process.env.MIDTRANS_SERVER_KEY,
        clientKey: process.env.MIDTRANS_CLIENT_KEY
      });

      const orderId = `HYBRID-CORE-${productId}-${Date.now()}`;
      
      const parameter = {
        "payment_type": "qris",
        "transaction_details": {
            "order_id": orderId,
            "gross_amount": amountIdr
        },
        "qris": {
            "acquirer": "gopay"
        },
        "item_details": [{
            "id": `SKU-0${productId}`,
            "price": amountIdr,
            "quantity": 1,
            "name": `Web3 Digital Core License B2B`
        }]
      };

      const transaction = await coreApi.charge(parameter);
      const qrAction = transaction.actions?.find((action: any) => action.name === 'generate-qr-code');
      const midtransQrUrl = qrAction ? qrAction.url : '';

      if (!midtransQrUrl) {
        throw new Error("Gagal mendapatkan link gambar QRIS dari respon Midtrans.");
      }

      return res.status(200).json({
        success: true,
        orderId: orderId,
        qrUrl: midtransQrUrl,
        security: {
            timestamp: currentTimestamp,
            signature: snapSignature
        }
      });

    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}