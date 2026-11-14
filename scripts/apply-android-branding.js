const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  let source = path.join('assets', 'app-icon.png');
  let sourceDescription = 'assets/app-icon.png';
  const res = path.join('android', 'app', 'src', 'main', 'res');
  if (!fs.existsSync(source)) throw new Error('Falta assets/app-icon.png');
  if (!fs.existsSync(res)) throw new Error('No existe el directorio de recursos Android: ' + res);

  const metadata = await sharp(source, { failOn: 'error' }).metadata();
  if (metadata.format !== 'png' || !metadata.width || !metadata.height) {
    throw new Error('assets/app-icon.png debe ser un PNG válido; no se permite sustituirlo por la imagen de portada.');
  }
  if (!metadata.format || !metadata.width || !metadata.height) throw new Error('Metadatos de imagen incompletos');
  } catch (error) {
    const fallback = path.join('assets', 'home-background.webp');
    if (!fs.existsSync(fallback)) throw new Error('El icono PNG está dañado y no existe una imagen alternativa: ' + error.message);
    source = fallback;
    sourceDescription = 'assets/home-background.webp (respaldo: app-icon.png ilegible)';
    metadata = await sharp(source, { failOn: 'error' }).metadata();
    console.warn('AVISO: assets/app-icon.png no se puede leer; se usará home-background.webp para generar los iconos Android.');
  }
  if (!metadata.format || !metadata.width || !metadata.height || metadata.width < 128 || metadata.height < 128) {
    throw new Error('La imagen seleccionada para el icono Android no es válida o es demasiado pequeña');
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

    const legacy = await sharp(source)
      .resize(legacySize, legacySize, {
        fit: 'contain',
        background: { r: 7, g: 9, b: 12, alpha: 1 }
      })
      .png()
      .toBuffer();
    await fs.promises.writeFile(path.join(dir, 'ic_launcher.png'), legacy);
    await fs.promises.writeFile(path.join(dir, 'ic_launcher_round.png'), legacy);

    // El foreground adaptativo queda dentro del 66% central para evitar recortes.
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
      const expected = name === 'ic_launcher_foreground.png' ? adaptiveSize : legacySize;
      if (check.width !== expected || check.height !== expected) {
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
  const appTag = manifestText.match(/<application\b[^>]*>/);
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

  if (!/android:icon="@mipmap\/ic_launcher"/.test(app) ||
      !/android:roundIcon="@mipmap\/ic_launcher_round"/.test(app)) {
    throw new Error('El manifest no quedó enlazado a los iconos personalizados');
  }

  console.log('Icono CHESS generado correctamente desde ' + source + ' (' +
    metadata.width + 'x' + metadata.height + '), con zona segura adaptativa del 66%.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
