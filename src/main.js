import './style.css';
import { createDemo } from './demo.js';
import { findChoices, getPageText, navigate, pageCount, restart, retrace, validatePageSettings } from './reader.js';
import { readSaved, saveBook } from './storage.js';
import { createPageView } from './page-view.js';

const $ = selector => document.querySelector(selector);
let book = createDemo();
let state = { page: 1, history: [] };
const defaultPreferences = { opacity: 18, textSize: 21, view: 'original' };
let preferences = { ...defaultPreferences };
let busy = false;
let settingsBusy = false;
let settingsNumberingSource;
let saveQueue = Promise.resolve();
let savedBook;
const pageView = createPageView($('#original-page-view'), $('#page-canvas'), $('#page-render-status'));

function message(text, error = false) {
  $('#status').textContent = text;
  $('#status').classList.toggle('error', error);
}

function persist() {
  // Serialize writes so quick page turns cannot overwrite newer progress.
  const snapshot = { book, state, preferences };
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await saveBook(snapshot, savedBook !== snapshot.book);
    savedBook = snapshot.book;
  }).catch(() => {
    message('Your browser could not save this book. You can keep reading, but it may not be here after reloading.', true);
  });
}

function setBusy(value) {
  busy = value;
  $('.paper').setAttribute('aria-busy', String(value));
  $('#pdf-input').disabled = value;
  $('#load-demo').disabled = value;
  $('#open-settings').disabled = value;
  $('#restart-book').disabled = value;
  $('.file-button').classList.toggle('disabled', value);
  $('#import-progress').hidden = !value;
}

function render(focus = false) {
  const count = pageCount(book);
  const text = getPageText(book, state.page);
  $('#book-title').textContent = book.title;
  $('#book-details').textContent = book.isDemo ? 'An original short adventure' : `${book.pages.length} PDF pages / ${count} book pages / saved on this device`;
  $('#page-counter').textContent = `PAGE ${state.page} OF ${count}`;
  $('#chapter-label').textContent = state.page === 1 ? 'THE ADVENTURE BEGINS' : 'YOUR ADVENTURE CONTINUES';
  $('#page-heading').textContent = `Page ${state.page}`;
  $('#pdf-page-position').hidden = book.isDemo;
  $('#pdf-page-position').textContent = `Printed page ${state.page} / PDF page ${book.firstPage + state.page - 1} of ${book.pages.length}`;
  const paragraphs = text.trim() ? text.split(/\n\s*\n/) : ['There is no selectable text on this PDF page. Switch to Original page to see its images and layout. You can still Continue or Go to page; automatic choices and Text view require selectable text or OCR.'];
  $('#page-text').replaceChildren(...paragraphs.map(paragraph => {
    const element = document.createElement('p');
    element.textContent = paragraph.replace(/\n/g, ' ');
    return element;
  }));
  const originalView = !book.isDemo && preferences.view !== 'text';
  $('#page-display').hidden = book.isDemo;
  $('#view-original').setAttribute('aria-pressed', String(originalView));
  $('#view-text').setAttribute('aria-pressed', String(!originalView));
  $('#original-page-view').hidden = !originalView;
  $('#page-text').classList.toggle('visually-hidden', originalView);
  $('#image-only-note').hidden = !originalView || Boolean(text.trim());
  $('#page-canvas').setAttribute('aria-label', `Page ${state.page} in original PDF layout, including illustrations`);
  if (originalView) {
    pageView.show(book, book.firstPage + state.page - 1);
  } else {
    pageView.hide(book.isDemo);
  }
  const choices = findChoices(text, count);
  $('#choices').replaceChildren(...choices.map((target, index) => {
    const button = document.createElement('button');
    button.className = 'choice';
    button.type = 'button';
    const number = document.createElement('span');
    number.className = 'choice-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('span');
    label.textContent = `Turn to page ${target}`;
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '\u2192';
    button.append(number, label, arrow);
    button.addEventListener('click', () => goTo(target));
    return button;
  }));
  $('.choices-section .eyebrow').textContent = choices.length ? 'WHAT WILL YOU DO?' : state.page === count ? 'THE END OF THIS PATH' : 'THE NEXT PAGE AWAITS';
  $('#next-page').hidden = state.page === count;
  $('#next-page').textContent = `Continue to page ${state.page + 1} \u2192`;
  $('#back-page').disabled = !state.history.length;
  $('#jump-page').max = count;
  $('#jump-page').value = '';
  $('#journey-note').textContent = state.history.length ? `${state.history.length} page turn${state.history.length === 1 ? '' : 's'} along your path.` : 'One page. A world of possibilities.';
  $('#cover-background').style.backgroundImage = book.cover ? `url("${book.cover}")` : '';
  const thumbnail = $('#cover-thumbnail');
  thumbnail.hidden = !book.cover;
  if (book.cover) {
    if (thumbnail.getAttribute('src') !== book.cover) thumbnail.src = book.cover;
    thumbnail.alt = `Cover of ${book.title}`;
  } else {
    thumbnail.removeAttribute('src');
    thumbnail.alt = '';
  }
  document.documentElement.style.setProperty('--cover-opacity', preferences.opacity / 100);
  document.documentElement.style.setProperty('--story-size', `${preferences.textSize}px`);
  if (focus) {
    $('#page-heading').focus({ preventScroll: true });
    $('.paper').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
}

function goTo(target) {
  if (busy) return;
  try {
    state = navigate(state, target, pageCount(book));
    message('');
    render(true);
    persist();
  } catch (error) {
    message(error.message, true);
  }
}

function changeView(view) {
  if (busy) return;
  preferences = { ...preferences, view };
  render();
  persist();
}

$('#view-original').addEventListener('click', () => changeView('original'));
$('#view-text').addEventListener('click', () => changeView('text'));

$('#jump-form').addEventListener('submit', event => {
  event.preventDefault();
  goTo(Number($('#jump-page').value));
});
$('#next-page').addEventListener('click', () => goTo(state.page + 1));
$('#back-page').addEventListener('click', () => {
  if (busy) return;
  state = retrace(state);
  message('');
  render(true);
  persist();
});
$('#restart-book').addEventListener('click', () => $('#restart-dialog').showModal());
$('#cancel-restart').addEventListener('click', () => $('#restart-dialog').close());
$('#confirm-restart').addEventListener('click', () => {
  state = restart(state);
  $('#restart-dialog').close();
  message('A fresh adventure begins.');
  render(true);
  persist();
});
$('#load-demo').addEventListener('click', () => {
  book = createDemo();
  state = restart(state);
  message('An original adventure, ready to explore.');
  render(true);
  persist();
});

$('#pdf-input').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file || busy) return;
  setBusy(true);
  message('Opening your book. The PDF stays on your device...');
  $('#import-progress').removeAttribute('value');
  try {
    const { importPdf } = await import('./pdf.js');
    const imported = await importPdf(file, (current, total) => {
      $('#import-progress').max = total;
      $('#import-progress').value = current;
      message(`Extracting page ${current} of ${total}...`);
    });
    book = imported;
    state = restart(state);
    preferences = { ...preferences, view: 'original' };
    render(true);
    message(book.detectedFirstPage
      ? `Book opened. Printed page 1 was detected at PDF page ${book.detectedFirstPage}. Choices and jumps use printed page numbers.`
      : 'Book opened. No reliable printed-page labels were found; set the PDF position of printed page 1 in Reader settings.');
    persist();
    openSettings();
  } catch (error) {
    message(error.name === 'PasswordException'
      ? 'This PDF is password-protected. Open an unlocked copy to read it here.'
      : `Could not open this book. ${error.message || 'Choose a valid PDF and try again.'}`, true);
  } finally {
    setBusy(false);
    event.target.value = '';
  }
});

function openSettings() {
  settingsNumberingSource = book.firstPageSource ?? 'manual';
  $('#first-page').value = book.firstPage;
  $('#detected-numbering').textContent = book.isDemo ? '' : book.detectedFirstPage
    ? `PDF page labels identify printed page 1 at PDF page ${book.detectedFirstPage}.`
    : 'No reliable embedded page labels were found. Match the first printed page manually.';
  $('#use-detected-numbering').hidden = !book.detectedFirstPage;
  $('#cover-page').value = book.coverPage;
  $('#first-page').max = book.pages.length;
  $('#cover-page').max = book.pages.length;
  $('#cover-page').disabled = book.isDemo;
  $('#cover-opacity').value = preferences.opacity;
  $('#opacity-value').value = `${preferences.opacity}%`;
  $('#text-size').value = preferences.textSize;
  $('#settings-error').textContent = '';
  $('#settings-dialog').showModal();
}

$('#open-settings').addEventListener('click', openSettings);
$('#first-page').addEventListener('input', () => {
  settingsNumberingSource = 'manual';
});
$('#use-detected-numbering').addEventListener('click', () => {
  $('#first-page').value = book.detectedFirstPage;
  settingsNumberingSource = 'auto';
});
$('#close-settings').addEventListener('click', () => $('#settings-dialog').close());
$('#settings-dialog').addEventListener('cancel', event => {
  if (settingsBusy) event.preventDefault();
});
$('#cover-opacity').addEventListener('input', event => {
  $('#opacity-value').value = `${event.target.value}%`;
});
$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const firstPage = Number($('#first-page').value);
  const coverPage = Number($('#cover-page').value);
  const submit = $('#settings-form button[type="submit"]');
  let pdf;
  settingsBusy = true;
  submit.disabled = true;
  $('#close-settings').disabled = true;
  try {
    validatePageSettings(firstPage, coverPage, book.pages.length);
    let cover = book.cover;
    if (!book.isDemo && coverPage !== book.coverPage) {
      const { openPdf, renderCover } = await import('./pdf.js');
      pdf = await openPdf(book.bytes);
      cover = await renderCover(pdf, coverPage);
    }
    if (firstPage !== book.firstPage) state = restart(state);
    book = { ...book, firstPage, firstPageSource: settingsNumberingSource, coverPage, cover };
    preferences = { ...preferences, opacity: Number($('#cover-opacity').value), textSize: Number($('#text-size').value) };
    $('#settings-dialog').close();
    message(`Reader settings saved. Printed page 1 corresponds to PDF page ${firstPage}.`);
    render(true);
    persist();
  } catch (error) {
    $('#settings-error').textContent = error.message;
  } finally {
    if (pdf) await pdf.loadingTask.destroy();
    submit.disabled = false;
    $('#close-settings').disabled = false;
    settingsBusy = false;
  }
});

setBusy(true);
render();
try {
  const saved = await readSaved();
  if (saved?.book?.pages?.length) {
    book = saved.book;
    state = saved.state;
    preferences = { ...defaultPreferences, ...saved.preferences };
    let numberingChanged = false;
    if (!book.isDemo && !book.firstPageSource) {
      let detectedFirstPage = null;
      try {
        const { detectPdfFirstPage } = await import('./pdf.js');
        detectedFirstPage = await detectPdfFirstPage(book.bytes);
      } catch {
        // Keep the existing mapping if this saved PDF cannot be inspected.
      }
      const firstPage = book.firstPage === 1 ? detectedFirstPage ?? 1 : book.firstPage;
      numberingChanged = firstPage !== book.firstPage;
      book = { ...book, firstPage, detectedFirstPage, firstPageSource: book.firstPage === 1 ? 'auto' : 'manual' };
      if (numberingChanged) state = restart(state);
    }
    getPageText(book, state.page);
    savedBook = saved.book;
    render();
    message(numberingChanged
      ? `Corrected printed page numbering: page 1 is PDF page ${book.firstPage}. Your adventure has restarted at printed page 1.`
      : 'Your adventure is right where you left it.');
    if (book !== saved.book) persist();
  }
} catch {
  book = createDemo();
  state = { page: 1, history: [] };
  preferences = { ...defaultPreferences };
  render();
  message('Local saving is unavailable. You can still open a PDF and read during this visit.');
} finally {
  setBusy(false);
}
