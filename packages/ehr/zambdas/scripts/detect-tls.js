const { existsSync } = require('fs');
module.exports.tlsPath = existsSync('./.env/cert.pem') && existsSync('./.env/key.pem') ? './.env' : undefined;
