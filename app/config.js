/**
 * Deployment URL of the Apps Script Web App (ends with /exec).
 * Safe to keep in a public repository: without a valid initData HMAC from our bot
 * this endpoint does nothing. See tech-bank/005 for why that is true.
 */
window.ENGBOT_CONFIG = {
  WEB_APP_URL: 'PASTE_YOUR_EXEC_URL_HERE',
  VERSION: '0.1.0'
};
