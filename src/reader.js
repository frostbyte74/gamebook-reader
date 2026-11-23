export function pageCount(book) {
  return book.pages.length - book.firstPage + 1;
}

export function detectFirstPage(labels) {
  if (!Array.isArray(labels)) return null;
  const start = labels.findIndex(label => /^0*1$/.test(label ?? ''));
  if (start < 0) return null;
  let matches = 0;
  for (let index = start; index < labels.length; index += 1) {
    if (!/^\d+$/.test(labels[index] ?? '')) continue;
    if (Number(labels[index]) !== index - start + 1) return null;
    matches += 1;
  }
  return matches >= Math.min(2, labels.length - start) ? start + 1 : null;
}

export function getPageText(book, page) {
  if (!Number.isInteger(page) || page < 1 || page > pageCount(book)) {
    throw new RangeError('That page is not in this book.');
  }
  return book.pages[book.firstPage + page - 2];
}

export function findChoices(text, totalPages) {
  const pattern = /\b(?:turn|go|proceed|continue|jump|skip)\s+(?:(?:over|on)\s+)?to\s+(?:page\s+)?(\d{1,5})\b|\bpage\s+(\d{1,5})\b/gi;
  const targets = new Set();
  for (const match of text.matchAll(pattern)) {
    const target = Number(match[1] ?? match[2]);
    if (target >= 1 && target <= totalPages) targets.add(target);
  }
  return [...targets];
}

export function navigate(state, target, totalPages) {
  if (!Number.isInteger(target) || target < 1 || target > totalPages) {
    throw new RangeError(`Choose a page from 1 to ${totalPages}.`);
  }
  if (target === state.page) return state;
  return { ...state, page: target, history: [...state.history, state.page].slice(-500) };
}

export function retrace(state) {
  if (!state.history.length) return state;
  return { ...state, page: state.history.at(-1), history: state.history.slice(0, -1) };
}

export function restart(state) {
  return { ...state, page: 1, history: [] };
}

export function validatePageSettings(firstPage, coverPage, pdfPages) {
  if (![firstPage, coverPage].every(page => Number.isInteger(page) && page >= 1 && page <= pdfPages)) {
    throw new RangeError(`Both PDF page numbers must be between 1 and ${pdfPages}.`);
  }
}

export function textFromItems(items) {
  const lines = [];
  let line = '';
  let lastY;
  let lastHeight = 12;
  let previousEnd;
  function flush() {
    if (line.trim()) lines.push({ text: line.trim(), y: lastY, height: lastHeight });
    line = '';
    previousEnd = undefined;
  }
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const y = item.transform?.[5] ?? lastY ?? 0;
    if (line && lastY !== undefined && Math.abs(y - lastY) > 3) flush();
    const x = item.transform?.[4] ?? previousEnd ?? 0;
    const gap = previousEnd === undefined ? 0 : x - previousEnd;
    if (line && !/\s$/.test(line) && !/^\s/.test(item.str) && gap > 1) line += ' ';
    line += item.str;
    lastY = y;
    lastHeight = Math.abs(item.height) || lastHeight;
    previousEnd = x + (item.width || 0);
    if (item.hasEOL) flush();
  }
  flush();
  return lines.map((row, index) => {
    if (!index) return row.text;
    const previous = lines[index - 1];
    const paragraph = Math.abs(row.y - previous.y) > Math.max(row.height, previous.height) * 1.65;
    return `${paragraph ? '\n\n' : '\n'}${row.text}`;
  }).join('');
}
