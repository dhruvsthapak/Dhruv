const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'applications.log');

function log(level, message) {
  const entry = `[${new Date().toISOString()}] [${level}] ${message}`;
  console.log(entry);
  fs.appendFileSync(LOG_FILE, entry + '\n');
}

module.exports = {
  info: (msg) => log('INFO', msg),
  warn: (msg) => log('WARN', msg),
  error: (msg) => log('ERROR', msg),
  success: (msg) => log('SUCCESS', msg),
};
