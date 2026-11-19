#!/usr/bin/env node
/**
 * Checks an Android App Bundle before it is uploaded to Google Play.
 *
 * Play refuses a bundle whose package is not exactly the one in the store
 * listing, and its message ("needs to have the package name …") never says
 * which package the file actually carries. This reads the bundle itself:
 *
 *   node scripts/check-aab.mjs "Latino live.aab"
 *   node scripts/check-aab.mjs "Latino live.aab" --expect com.latinolivechat.app
 *
 * It understands the bundle format with Node alone, so it runs on any machine
 * that can run the app, without bundletool, Android Studio or Java.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const MANIFEST = 'base/manifest/AndroidManifest.xml';
const BUNDLE = 'base/assets/index.android.bundle';

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/** The central directory: name, offsets and sizes of every entry in the zip. */
function readDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 66_000); offset--) {
    if (buffer.readUInt32LE(offset) !== 0x06054b50) continue;
    const total = buffer.readUInt16LE(offset + 10);
    const start = buffer.readUInt32LE(offset + 16);
    const entries = [];
    let cursor = start;
    for (let index = 0; index < total; index++) {
      if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
        for (let scan = cursor; scan < buffer.length - 4; scan++) {
          if (buffer.readUInt32LE(scan) === 0x02014b50) {
            cursor = scan;
            break;
          }
        }
      }
      const method = buffer.readUInt16LE(cursor + 10);
      const compressed = buffer.readUInt32LE(cursor + 20);
      const nameLength = buffer.readUInt16LE(cursor + 28);
      const extraLength = buffer.readUInt16LE(cursor + 30);
      const commentLength = buffer.readUInt16LE(cursor + 32);
      const local = buffer.readUInt32LE(cursor + 42);
      const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
      entries.push({ name, method, compressed, local });
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }
  return null;
}

/** One entry's bytes, inflated when the zip stored it compressed. */
function readEntry(buffer, entry) {
  if (buffer.readUInt32LE(entry.local) !== 0x04034b50) return null;
  const nameLength = buffer.readUInt16LE(entry.local + 26);
  const extraLength = buffer.readUInt16LE(entry.local + 28);
  const start = entry.local + 30 + nameLength + extraLength;
  const body = buffer.subarray(start, start + entry.compressed);
  if (entry.method === 0) return body;
  try {
    return inflateRawSync(body);
  } catch {
    return null;
  }
}

/** Package-like strings inside the binary manifest, in either string encoding. */
function packageNames(bytes) {
  const text = `${bytes.toString('utf8')}\n${bytes.toString('utf16le')}`;
  const found = new Set();
  for (const match of text.matchAll(/[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}/g)) {
    const value = match[0];
    if (value.startsWith('android.') || value.startsWith('com.android.')) continue;
    if (value.startsWith('androidx.') || value.startsWith('kotlin.')) continue;
    found.add(value);
  }
  return [...found];
}

const args = process.argv.slice(2);
const file = args.find(argument => !argument.startsWith('--'));
const expectIndex = args.indexOf('--expect');
const expected = expectIndex >= 0 ? args[expectIndex + 1] : 'com.latinolivechat.app';

if (!file) fail('Escribe la ruta del .aab. Ejemplo: node scripts/check-aab.mjs "Latino live.aab"');
try {
  statSync(file);
} catch {
  fail(`No encuentro el archivo: ${file}`);
}

const buffer = readFileSync(file);
if (buffer.length < 1024) fail('Ese archivo está vacío o incompleto.');

const entries = readDirectory(buffer);
if (!entries) fail('Ese archivo no es un .aab (o está dañado). Descárgalo otra vez.');

const manifestEntry = entries.find(entry => entry.name === MANIFEST);
if (!manifestEntry) fail('El archivo no trae el manifiesto de la app. No parece un App Bundle completo.');

const manifest = readEntry(buffer, manifestEntry);
if (!manifest) fail('No se pudo leer el manifiesto del paquete.');

const names = packageNames(manifest);
const bundleSize = entries.find(entry => entry.name === BUNDLE)?.compressed ?? 0;

console.log(`\nArchivo: ${file}`);
console.log(`Tamaño:  ${(buffer.length / 1_048_576).toFixed(1)} MB`);
console.log(`SHA-256: ${createHash('sha256').update(buffer).digest('hex').slice(0, 16)}…`);

if (names.length === 0) fail('No se encontró el nombre del paquete en el manifiesto. Vuelve a generar el paquete.');

const others = names.filter(name => name !== expected).slice(0, 4);
console.log(`Paquete esperado:      ${expected}`);
console.log(`Paquete en el archivo: ${names.includes(expected) ? expected : 'no aparece'}`);
if (others.length > 0) console.log(`Otros nombres del archivo: ${others.join(', ')}${names.length > 5 ? '…' : ''}`);

if (!names.includes(expected)) {
  const platform = names.find(name => name.startsWith('ai.exaspark.app'));
  console.error(`\n✗ Este .aab NO se puede subir a la ficha de ${expected}.`);
  if (platform) {
    console.error(`  Lleva el paquete de la plataforma: ${platform}`);
    console.error('  Ese archivo lo generó ExaSpark, y Play exige el paquete de tu ficha.');
  }
  console.error('  Genera el tuyo con: npx eas-cli@latest build --platform android --profile production');
  console.error('  y sube ese archivo.\n');
  process.exit(1);
}

if (bundleSize < 100_000) {
  console.error('\n✗ El paquete lleva el nombre correcto pero no trae el código de la app.');
  console.error('  Vuelve a compilarlo: falta el bundle de JavaScript.\n');
  process.exit(1);
}

console.log(`Código de la app:      ${(bundleSize / 1_048_576).toFixed(1)} MB`);
console.log('\n✓ Lleva el nombre correcto y trae la app. Se puede subir a Play.');
console.log('  Si Play lo rechaza, el motivo ya no es el identificador.\n');
