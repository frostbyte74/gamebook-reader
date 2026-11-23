import { cpSync, mkdirSync } from 'node:fs';

const source = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const target = new URL('../public/pdfjs/', import.meta.url);
mkdirSync(target, { recursive: true });
for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
  cpSync(new URL(directory, source), new URL(directory, target), { recursive: true });
}
cpSync(new URL('LICENSE', source), new URL('LICENSE', target));
