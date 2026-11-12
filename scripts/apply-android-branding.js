const fs = require('fs');
const path = require('path');

const source = path.join('assets', 'app-icon.png');
const res = path.join('android', 'app', 'src', 'main', 'res');
if (!fs.existsSync(source)) throw new Error('Falta assets/app-icon.png');
if (!fs.existsSync(res)) throw new Error('No existe el directorio de recursos Android: ' + res);

for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  const dir = path.join(res, 'mipmap-' + density);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(source, path.join(dir, 'ic_launcher.png'));
  fs.copyFileSync(source, path.join(dir, 'ic_launcher_round.png'));
  fs.copyFileSync(source, path.join(dir, 'ic_launcher_foreground.png'));
}
const adaptive = path.join(res, 'mipmap-anydpi-v26');
fs.mkdirSync(adaptive, { recursive: true });
const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
fs.writeFileSync(path.join(adaptive, 'ic_launcher.xml'), xml);
fs.writeFileSync(path.join(adaptive, 'ic_launcher_round.xml'), xml);
const values = path.join(res, 'values');
fs.mkdirSync(values, { recursive: true });
fs.writeFileSync(path.join(values, 'ic_launcher_background.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#07090C</color></resources>\n');

const manifest = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(manifest)) throw new Error('No existe AndroidManifest.xml');
let manifestText = fs.readFileSync(manifest, 'utf8');
const appTag = manifestText.match(/<application\b[^>]*>/);
if (!appTag) throw new Error('No se encontró la etiqueta <application> en AndroidManifest.xml');
let app = appTag[0];
for (const attr of ['icon', 'roundIcon']) {
  const expression = new RegExp('android:' + attr + '="[^"]*"');
  if (expression.test(app)) app = app.replace(expression, 'android:' + attr + '="@mipmap/ic_launcher' + (attr === 'roundIcon' ? '_round' : '') + '"');
  else app = app.replace(/>$/, ' android:' + attr + '="@mipmap/ic_launcher' + (attr === 'roundIcon' ? '_round' : '') + '">');
}
manifestText = manifestText.replace(appTag[0], app);
fs.writeFileSync(manifest, manifestText);
if (!/android:icon="@mipmap\/ic_launcher"/.test(app) || !/android:roundIcon="@mipmap\/ic_launcher_round"/.test(app)) {
  throw new Error('El manifest no quedó enlazado a los iconos personalizados');
}
for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const file = path.join(res, 'mipmap-' + density, name);
    if (!fs.existsSync(file) || fs.statSync(file).size < 100) throw new Error('Icono ausente o vacío: ' + file);
  }
}
console.log('Icono CHESS aplicado. Manifest enlazado a @mipmap/ic_launcher y @mipmap/ic_launcher_round.');

