import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { textFromItems } from './reader.js';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function openPdf(bytes) {
  const task = getDocument({
    data: new Uint8Array(bytes.slice(0)),
    isEvalSupported: false,
    cMapUrl: new URL(`${import.meta.env.BASE_URL}pdfjs/cmaps/`, document.baseURI).href,
    cMapPacked: true,
    standardFontDataUrl: new URL(`${import.meta.env.BASE_URL}pdfjs/standard_fonts/`, document.baseURI).href,
    wasmUrl: new URL(`${import.meta.env.BASE_URL}pdfjs/wasm/`, document.baseURI).href,
  });
  try {
    return await task.promise;
  } catch (error) {
    await task.destroy();
    throw error;
  }
}

export async function renderCover(document, pageNumber) {
  const page = await document.getPage(pageNumber);
  const original = page.getViewport({ scale: 1 });
  const scale = Math.min(1200 / original.width, 1600 / original.height, 2);
  const viewport = page.getViewport({ scale });
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({
    canvas,
    viewport,
    background: '#ffffff',
  }).promise;
  const image = canvas.toDataURL('image/jpeg', 0.85);
  canvas.width = 0;
  canvas.height = 0;
  return image;
}

export async function importPdf(file, onProgress) {
  const bytes = await file.arrayBuffer();
  const document = await openPdf(bytes);
  try {
    const pages = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push(textFromItems(content.items));
      page.cleanup();
      onProgress(number, document.numPages);
    }
    const cover = await renderCover(document, 1);
    return {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.pdf$/i, ''),
      pages,
      bytes,
      firstPage: 1,
      coverPage: 1,
      cover,
      isDemo: false,
    };
  } finally {
    await document.loadingTask.destroy();
  }
}
