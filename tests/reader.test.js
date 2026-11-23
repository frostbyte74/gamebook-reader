import test from 'node:test';
import assert from 'node:assert/strict';
import { findChoices, getPageText, navigate, pageCount, restart, retrace, textFromItems, validatePageSettings } from '../src/reader.js';

test('printed page offsets are used for every lookup and the final page', () => {
  const book = { pages: ['cover', 'intro', 'start', 'middle', 'ending'], firstPage: 3 };
  assert.equal(pageCount(book), 3);
  assert.equal(getPageText(book, 1), 'start');
  assert.equal(getPageText(book, 3), 'ending');
  for (const invalid of [0, -1, 4, 1.5, NaN]) {
    assert.throws(() => getPageText(book, invalid), RangeError);
  }
});

test('choice recognition handles common wording, line breaks, duplicates, and invalid destinations', () => {
  const text = 'Turn to page 3. Go to 8. Turn over to page\n3. Continue on to page 2. See page 7. Turn to page 0. Go to page 99. On page 999999, wait.';
  assert.deepEqual(findChoices(text, 8), [3, 8, 2, 7]);
  assert.deepEqual(findChoices('The year is 1984, and you have 3 coins.', 300), []);
});

test('nonlinear navigation, retracing and restarting preserve book settings', () => {
  const initial = { page: 1, history: [], extra: 'preserved' };
  const first = navigate(initial, 8, 10);
  const second = navigate(first, 3, 10);
  assert.deepEqual(second.history, [1, 8]);
  assert.equal(second.page, 3);
  assert.deepEqual(retrace(second), first);
  assert.deepEqual(restart(second), initial);
  assert.deepEqual(initial.history, []);
  assert.equal(navigate(first, 8, 10), first);
  assert.equal(retrace(initial), initial);
  for (const invalid of [0, 11, 1.2, NaN]) {
    assert.throws(() => navigate(initial, invalid, 10), RangeError);
  }
});

test('page settings reject offsets or covers outside the actual PDF', () => {
  assert.doesNotThrow(() => validatePageSettings(3, 1, 5));
  assert.doesNotThrow(() => validatePageSettings(5, 5, 5));
  for (const values of [[0, 1], [1, 6], [1.5, 1], [NaN, 1], [6, 1]]) {
    assert.throws(() => validatePageSettings(...values, 5), RangeError);
  }
});

test('PDF text extraction joins fragmented words and preserves paragraphs', () => {
  const item = (str, x, y, width, hasEOL = false) => ({ str, transform: [1, 0, 0, 12, x, y], width, height: 12, hasEOL });
  const items = [
    { type: 'beginMarkedContent' },
    item('Adven', 10, 100, 30),
    item('ture', 40, 100, 20),
    item('awaits.', 65, 100, 35, true),
    item('Turn to page 3.', 10, 85, 100, true),
    item('A new paragraph.', 10, 55, 100, true),
  ];
  assert.equal(textFromItems(items), 'Adventure awaits.\nTurn to page 3.\n\nA new paragraph.');
});

test('line changes without explicit EOL markers do not merge neighboring words', () => {
  const item = (str, y) => ({ str, transform: [1, 0, 0, 12, 10, y], width: 30, height: 12 });
  assert.equal(textFromItems([item('First', 100), item('Second', 85)]), 'First\nSecond');
});
