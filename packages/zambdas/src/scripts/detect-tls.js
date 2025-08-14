const { existsSync } = require('fs');
module.exports.tlsPath = existsSync('../../config/.env/cert.pem') && existsSync('../../config/.env/key.pem') ? '../../config/.env' : undefined;
