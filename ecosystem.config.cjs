module.exports = {
  apps: [{
    name: 'autocarv7',
    script: './dist/index.js',  // Run the built backend directly
    env: {
      NODE_ENV: 'production',
      APP_URL: 'https://crm.maulicardecor.com',
      SESSION_SECRET: '8pSnCe9YF1FehlBI1YcX1Z2Z6r90x7zRd0yBM+CPTZaGwkurNBDzybjgretUTO4l9LT7wRLZln1jqnpqjtKECw==',
      MONGODB_URI: 'mongodb://localhost:27017/autocrm',
      WHATSAPP_PHONE_NUMBER_ID: '919970127778',
      WHATSAPP_API_KEY: '7RlFwj57xE6wHngTfSmNHA',
      PORT: '5000'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
