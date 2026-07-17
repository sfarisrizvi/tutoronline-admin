const fs = require('fs');
const path = require('path');

const serverJsPath = path.join(process.cwd(), '.next', 'standalone', 'server.js');

if (fs.existsSync(serverJsPath)) {
  console.log('Patching server.js for Hostinger Passenger compatibility...');
  let content = fs.readFileSync(serverJsPath, 'utf8');
  content = content.replace(
    'parseInt(process.env.PORT, 10) || 3000',
    'process.env.PORT ? (isNaN(Number(process.env.PORT)) ? process.env.PORT : parseInt(process.env.PORT, 10)) : 3000'
  );
  fs.writeFileSync(serverJsPath, content);
  console.log('server.js patched successfully!');
} else {
  console.log('server.js not found at ' + serverJsPath + '. Standing by.');
}
