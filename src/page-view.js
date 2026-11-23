export function createPageView(container, canvas, status) {
  let generation = 0;
  let queue = Promise.resolve();
  let documentPromise;
  let documentId;
  let renderTask;
  let requested;

  async function releaseDocument() {
    const previous = documentPromise;
    documentPromise = undefined;
    documentId = undefined;
    const pdf = await previous?.catch(() => undefined);
    if (pdf) await pdf.loadingTask.destroy();
  }

  function show(book, pageNumber) {
    const width = container.clientWidth;
    if (!width || (requested?.book.id === book.id && requested.pageNumber === pageNumber && requested.width === width)) return;
    requested = { book, pageNumber, width };
    const version = ++generation;
    renderTask?.cancel();
    canvas.hidden = true;
    delete canvas.dataset.pdfPage;
    container.setAttribute('aria-busy', 'true');
    status.textContent = 'Opening the original page, illustrations and all...';

    // Serialize canvas use; cancellation must settle before another page draws.
    queue = queue.then(async () => {
      if (version !== generation) return;
      try {
        if (documentId !== book.id) {
          await releaseDocument();
          if (version !== generation) return;
          documentId = book.id;
          documentPromise = import('./pdf.js').then(({ openPdf }) => openPdf(book.bytes));
        }
        const pdf = await documentPromise;
        if (version !== generation) return;
        const page = await pdf.getPage(pageNumber);
        if (version !== generation) return;
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / original.width });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (viewport.width * viewport.height)));
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        renderTask = page.render({
          canvas,
          viewport,
          transform: [outputScale, 0, 0, outputScale, 0, 0],
          background: '#ffffff',
        });
        await renderTask.promise;
        page.cleanup();
        if (version !== generation) return;
        canvas.dataset.pdfPage = String(pageNumber);
        canvas.hidden = false;
        status.textContent = '';
      } catch (error) {
        if (version === generation) {
          status.textContent = 'Could not display the original page. Switch to Text view or reopen the PDF to try again.';
          requested = undefined;
          if (!renderTask) await releaseDocument();
        }
      } finally {
        renderTask = undefined;
        if (version === generation) container.setAttribute('aria-busy', 'false');
      }
    }).catch(() => {
      if (version === generation) {
        status.textContent = 'Could not display the original page. Switch to Text view or reopen the PDF to try again.';
        container.setAttribute('aria-busy', 'false');
        requested = undefined;
      }
    });
  }

  function hide(release = false) {
    const version = ++generation;
    requested = undefined;
    renderTask?.cancel();
    canvas.hidden = true;
    delete canvas.dataset.pdfPage;
    status.textContent = '';
    container.setAttribute('aria-busy', 'false');
    if (release) queue = queue.then(() => version === generation ? releaseDocument() : undefined).catch(() => {});
  }

  new ResizeObserver(() => {
    if (requested) show(requested.book, requested.pageNumber);
  }).observe(container);

  return { show, hide };
}
