/**
 * Deployment URL of the Apps Script Web App (ends with /exec).
 * Safe to keep in a public repository: without a valid initData HMAC from our bot
 * this endpoint does nothing. See tech-bank/005 for why that is true.
 */
window.ENGBOT_CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwA99AIQJev042G_6fCmvmXNFanddmlTgPSU1zkcQwpPUH_9Q_u75RJ1RENEwRh50pcDg/exec',
  VERSION: '0.1.1'
};
