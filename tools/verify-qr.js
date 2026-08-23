/* Го декодира docs/qr.png и паѓа ако не го носи очекуваниот URL. QR што
   никој не може да го врати назад е полош од никаков QR: изгледа исправно
   и не води никаде. Изврши: node tools/verify-qr.js [url] */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');

const expected = process.argv[2] || 'https://ljupcho1982.github.io/dobrina/';
const file = path.join(__dirname, '..', 'docs', 'qr.png');

const png = PNG.sync.read(fs.readFileSync(file));
const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

if (!code) { console.error('FAIL: ништо не се декодира од docs/qr.png'); process.exit(1); }
if (code.data !== expected) {
  console.error('FAIL: QR носи "' + code.data + '", а се очекува "' + expected + '"');
  process.exit(1);
}
console.log('ok: QR декодира во ' + code.data);
