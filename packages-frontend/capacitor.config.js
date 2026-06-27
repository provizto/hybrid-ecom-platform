const config = {
  appId: 'com.haruntamale.hybridecom',
  appName: 'Hybrid Ecom Platform',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    cleartext: true,
    allowNavigation: ['*']
  },
  android: {
    allowMixedContent: true
  }
};

export default config;