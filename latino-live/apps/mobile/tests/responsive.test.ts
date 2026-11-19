import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG_MAX, CONTENT_MAX, capped, catalogColumns, columnStyle } from '../lib/responsive.ts';

test('a phone keeps its whole width', () => {
  assert.equal(capped(360), 360);
  assert.equal(capped(412), 412);
});

test('a wide screen is trimmed to a column', () => {
  assert.equal(capped(1024), CONTENT_MAX);
  assert.equal(capped(2560), CONTENT_MAX);
});

test('a screen narrower than the column never grows past itself', () => {
  assert.equal(capped(320, 560), 320);
  assert.equal(capped(0), 0);
});

test('the rooms keep two columns on a phone and on a laptop', () => {
  assert.equal(catalogColumns(360), 2);
  assert.equal(catalogColumns(CATALOG_MAX), 2);
  assert.equal(catalogColumns(1280), 3);
});

test('a centered column caps its width and stays centered', () => {
  const style = columnStyle();
  assert.equal(style.maxWidth, CONTENT_MAX);
  assert.equal(style.alignSelf, 'center');
  assert.equal(style.width, '100%');
});
