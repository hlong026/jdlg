const assert = require('assert');

const {
  buildSelectedMap,
  getCurrentSelectableIds,
  isEveryCurrentSelected,
  toggleCurrentSelection,
} = require('../miniprogram/utils/currentPageSelection');

const items = Array.from({ length: 12 }, (_, index) => ({ id: `item-${index + 1}` }));

assert.deepStrictEqual(
  getCurrentSelectableIds(items, (item) => item.id, ['item-3', 'item-1', 'missing'], 9),
  ['item-1', 'item-3'],
  'visible ids should be filtered and ordered by the current list',
);

assert.deepStrictEqual(
  getCurrentSelectableIds(items, (item) => item.id, [], 9),
  items.slice(0, 9).map((item) => item.id),
  'empty visible ids should fall back to the first screen only',
);

assert.deepStrictEqual(
  toggleCurrentSelection(['old', 'item-1'], ['item-1', 'item-2']),
  ['old', 'item-1', 'item-2'],
  'select all should add the current page without dropping older selections',
);

assert.deepStrictEqual(
  toggleCurrentSelection(['old', 'item-1', 'item-2'], ['item-1', 'item-2']),
  ['old'],
  'cancel all should remove only the current page selection',
);

assert.deepStrictEqual(buildSelectedMap(['item-1', 'item-2']), { 'item-1': true, 'item-2': true });
assert.strictEqual(isEveryCurrentSelected(['item-1', 'item-2'], ['item-1', 'item-2']), true);
assert.strictEqual(isEveryCurrentSelected(['item-1'], ['item-1', 'item-2']), false);
assert.strictEqual(isEveryCurrentSelected(['item-1'], []), false);

console.log('currentPageSelection tests passed');
