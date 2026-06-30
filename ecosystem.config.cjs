module.exports = {
  apps: [{
    name: 'autocarv7',
    script: './dist/index.js',  // Run the built backend directly
    env: {
      NODE_ENV: 'production',
      APP_URL: process.env.APP_URL || 'https://crm.maulicardecor.com',
      SESSION_SECRET: process.env.SESSION_SECRET || 'change_me_in_server_env',
      MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/autocrm',
      WHATSAPP_API_KEY: process.env.WHATSAPP_API_KEY || '',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '919970127778',
      WHATSAPP_ONBOARDING_BASE_URL: process.env.WHATSAPP_ONBOARDING_BASE_URL || 'https://onboarding.akst.in',
      WHATSAPP_ONBOARDING_VERSION: process.env.WHATSAPP_ONBOARDING_VERSION || 'v23.0',
      WHATSAPP_ONBOARDING_PHONE_NUMBER_ID: process.env.WHATSAPP_ONBOARDING_PHONE_NUMBER_ID || '951514724722583',
      WHATSAPP_ONBOARDING_ACCESS_TOKEN: process.env.WHATSAPP_ONBOARDING_ACCESS_TOKEN || '',
      WHATSAPP_ONBOARDING_OTP_TEMPLATE: process.env.WHATSAPP_ONBOARDING_OTP_TEMPLATE || 'verify_code_1',
      WHATSAPP_ONBOARDING_OTP_BUTTON_TEXT: process.env.WHATSAPP_ONBOARDING_OTP_BUTTON_TEXT || 'Copy',
      WHATSAPP_BIZ_OPAQUE_CALLBACK_DATA: process.env.WHATSAPP_BIZ_OPAQUE_CALLBACK_DATA || '{{BizOpaqueCallbackData}}',
      PORT: process.env.PORT || '5000'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
