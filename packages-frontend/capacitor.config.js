/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.haruntamale.hybridecom',
  appName: 'Hybrid Ecom Platform',
  webDir: 'dist', // 👈 Memastikan target mengarah ke folder build Vite, bukan www
  server: {
    cleartext: true,
    allowNavigation: ['*']
  },
  android: {
    allowMixedContent: true
  }
};

// Menggunakan module.exports agar dibaca sempurna oleh Capacitor CLI di Windows
module.exports = config;