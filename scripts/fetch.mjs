// Fetches live PATH data from PANYNJ and saves it as a static JSON file.
// Runs locally (`node scripts/fetch.mjs`) and in GitHub Actions at deploy time.
// Tolerates failure: keeps the last good file so deploys never break.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'data', 'realtime.json');

try {
  const url = `https://www.panynj.gov/bin/portauthority/ridepath.json?timeStamp=${Date.now()}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`PANYNJ responded ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.results)) throw new Error('unexpected payload shape');
  json.fetchedAt = new Date().toISOString();
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(json));
  console.log(`saved ${json.results.length} stations -> public/data/realtime.json`);
} catch (e) {
  console.error(`fetch failed (keeping previous file): ${e.message}`);
  process.exitCode = 1;
}
