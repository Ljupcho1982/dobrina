/* Добрина — QR-от на страницата за преземање. Се регенерира само ако се
   смени самиот Pages URL; името на asset-от во Releases е стабилно, па нова
   верзија не бара нов код. Изврши: node tools/make-qr.js [url] */

const path = require('path');
const QRCode = require('qrcode');

const url = process.argv[2] || 'https://ljupcho1982.github.io/dobrina/';
const out = path.join(__dirname, '..', 'docs', 'qr.png');

QRCode.toFile(out, url, {
  width: 528,          // 4× од прикажаните 132px, за да остане остар на retina
  margin: 2,
  color: { dark: '#3a2c22ff', light: '#fffaf3ff' },
  errorCorrectionLevel: 'M',
}).then(() => {
  console.log('wrote docs/qr.png -> ' + url);
}).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
