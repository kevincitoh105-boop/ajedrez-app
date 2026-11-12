const fs = require('fs');
const path = require('path');

const source = path.join('assets', 'app-icon.png');
const foreground = path.join('assets', 'app-icon-foreground.png');
const res = path.join('android', 'app', 'src', 'main', 'res');
if (!fs.existsSync(source)) throw new Error('Falta assets/app-icon.png');
if (!fs.existsSync(foreground)) throw new Error('Falta assets/app-icon-foreground.png');
if (!fs.existsSync(res)) throw new Error('No existe el directorio de recursos Android: ' + res);

for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  const dir = path.join(res, 'mipmap-' + density);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(source, path.join(dir, 'ic_launcher.png'));
  fs.copyFileSync(source, path.join(dir, 'ic_launcher_round.png'));
  fs.copyFileSync(foreground, path.join(dir, 'ic_launcher_foreground.png'));
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
console.log('Icono CHESS aplicado a los recursos launcher Android.');
