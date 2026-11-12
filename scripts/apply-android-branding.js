const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const source = path.join('assets', 'app-icon.png');
  const res = path.join('android', 'app', 'src', 'main', 'res');
  if (!fs.existsSync(source)) throw new Error('Falta assets/app-icon.png');
  if (!fs.existsSync(res)) throw new Error('No existe el directorio de recursos Android: ' + res);

  const metadata = await sharp(source, { failOn: 'error' }).metadata();
  if (metadata.format !== 'png' || !metadata.width || !metadata.height) {
    throw new Error('assets/app-icon.png no es un PNG válido');
  }
  if (metadata.width < 128 || metadata.height < 128) {
    throw new Error('El icono original debe tener al menos 128x128 px');
  }

  const densities = [
    ['mdpi', 48, 108],
    ['hdpi', 72, 162],
    ['xhdpi', 96, 216],
    ['xxhdpi', 144, 324],
    ['xxxhdpi', 192, 432]
  ];

  for (const [density, legacySize, adaptiveSize] of densities) {
    const dir = path.join(res, 'mipmap-' + density);
    fs.mkdirSync(dir, { recursive: true });

    // Icono clásico: imagen completa, centrada y sin deformaciones.
    const legacy = await sharp(source)
      .resize(legacySize, legacySize, {
        fit: 'contain',
        background: { r: 7, g: 9, b: 12, alpha: 1 }
      })
      .png()
      .toBuffer();

    await fs.promises.writeFile(path.join(dir, 'ic_launcher.png'), legacy);
    await fs.promises.writeFile(path.join(dir, 'ic_launcher_round.png'), legacy);

    // Icono adaptativo: Android recorta un círculo/forma sobre el foreground.
    // Mantener el arte dentro del 66% central evita que se corte.
    const safeSize = Math.round(adaptiveSize * 0.66);
    const foreground = await sharp(source)
      .resize(safeSize, safeSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    const adaptive = await sharp({
      create: {
        width: adaptiveSize,
        height: adaptiveSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: foreground, gravity: 'centre' }])
      .png()
      .toBuffer();

    await fs.promises.writeFile(path.join(dir, 'ic_launcher_foreground.png'), adaptive);

    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      const file = path.join(dir, name);
      const check = await sharp(file).metadata();
      if (check.width !== (name === 'ic_launcher_foreground.png' ? adaptiveSize : legacySize) ||
          check.height !== (name === 'ic_launcher_foreground.png' ? adaptiveSize : legacySize)) {
        throw new Error('Dimensiones incorrectas en ' + file);
      }
    }
  }

  const adaptiveDir = path.join(res, 'mipmap-anydpi-v26');
  fs.mkdirSync(adaptiveDir, { recursive: true });
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  fs.writeFileSync(path.join(adaptiveDir, 'ic_launcher.xml'), xml);
  fs.writeFileSync(path.join(adaptiveDir, 'ic_launcher_round.xml'), xml);

  const values = path.join(res, 'values');
  fs.mkdirSync(values, { recursive: true });
  fs.writeFileSync(path.join(values, 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#07090C</color></resources>\n');

  const manifest = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifest)) throw new Error('No existe AndroidManifest.xml');
  let manifestText = fs.readFileSync(manifest, 'utf8');
  const appTag = manifestText.match(/<application\\b[^>]*>/);
  if (!appTag) throw new Error('No se encontró la etiqueta <application> en AndroidManifest.xml');
  let app = appTag[0];

  for (const attr of ['icon', 'roundIcon']) {
    const value = attr === 'roundIcon' ? '@mipmap/ic_launcher_round' : '@mipmap/ic_launcher';
    const expression = new RegExp('android:' + attr + '="[^"]*"');
    if (expression.test(app)) app = app.replace(expression, 'android:' + attr + '="' + value + '"');
    else app = app.replace(/>$/, ' android:' + attr + '="' + value + '">');
  }

  manifestText = manifestText.replace(appTag[0], app);
  fs.writeFileSync(manifest, manifestText);

  if (!/android:icon="@mipmap\\/ic_launcher"/.test(app) ||
      !/android:roundIcon="@mipmap\\/ic_launcher_round"/.test(app)) {
    throw new Error('El manifest no quedó enlazado a los iconos personalizados');
  }

  console.log(`Icono CHESS generado correctamente desde assets/app-icon.png (${metadata.width}x${metadata.height}). Foreground adaptativo con zona segura del 66%.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
