// Neon Tide Cover Studio — hand-in program for gta6-cover-art-01.
//
// The app itself is the static site under app/ (open app/index.html in a
// browser; it runs fully offline). This program stages the entry for the
// grader: it copies app/ and screenshots/ into the output directory and
// writes dossier.json there with the kit's vendored library, buildDossier,
// under the scorer's caps, so the dossier on disk is exactly the one the
// gate rebuilds and compares.
//
// Run it the way the grader does, or locally with an output override:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });

const shotsDir = join(outDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
const localShots = join(repoDir, 'screenshots');
if (existsSync(localShots)) {
  cpSync(localShots, shotsDir, { recursive: true });
}

// The caps are the scorer's own: at most 4 screenshots of 256 KiB each,
// at most 993 files and 48 MiB under app/, no app path over 1,000 bytes,
// and the dossier's source text capped at 160 KiB. The output as a whole
// shares the platform's 1,000-entry, 64 MiB budget with dossier.json.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
