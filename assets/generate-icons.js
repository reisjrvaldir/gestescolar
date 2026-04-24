// Script Node.js para gerar ícones PNG do PWA
// Execute: node assets/generate-icons.js
const fs = require('fs');

// SVG base do ícone GestEscolar
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size*0.18}" fill="#1a73e8"/>
  <text x="50%" y="54%" font-size="${size*0.52}" font-family="Arial,sans-serif" font-weight="900"
    fill="white" text-anchor="middle" dominant-baseline="middle">G</text>
  <text x="50%" y="82%" font-size="${size*0.13}" font-family="Arial,sans-serif" font-weight="600"
    fill="rgba(255,255,255,0.85)" text-anchor="middle">ESCOLAR</text>
</svg>`;

[72, 96, 128, 144, 152, 192, 384, 512].forEach(s => {
  fs.writeFileSync(`assets/icon-${s}.svg`, svg(s));
  console.log(`Gerado: assets/icon-${s}.svg`);
});
console.log('Ícones SVG gerados. Para PNG real use um conversor online ou Inkscape.');
