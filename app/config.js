/**
 * Deployment URL of the Apps Script Web App (ends with /exec).
 * Safe to keep in a public repository: without a valid initData HMAC from our bot
 * this endpoint does nothing. See tech-bank/005 for why that is true.
 */
window.ENGBOT_CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwA99AIQJev042G_6fCmvmXNFanddmlTgPSU1zkcQwpPUH_9Q_u75RJ1RENEwRh50pcDg/exec',
  // Куда ведёт ярлык времени на карточке грамматики: теорию ты пишешь сам,
  // приложение только всегда держит рядом ссылку на неё.
  GRAMMAR_NOTES_URL: 'https://github.com/EnOtik911/eng-bot/blob/main/docs/grammar-map.md',
  VERSION: '0.6.1'
};
