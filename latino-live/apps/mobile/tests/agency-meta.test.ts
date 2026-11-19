import assert from 'node:assert/strict';
import test from 'node:test';
import { metaBreakdown, metaProgress, type AgencyMember } from '../lib/agency-meta.ts';

function member(over: Partial<AgencyMember> & { id: string }): AgencyMember {
  return {
    display_name: over.id,
    avatar_url: null,
    level: 1,
    diamonds: 0,
    is_manager: false,
    month_diamonds: 0,
    meta_level: 1,
    meta_target: 500,
    since: '2026-01-01T00:00:00Z',
    ...over,
  };
}

test('a member shy of the target shows the share already walked', () => {
  assert.equal(metaProgress(member({ id: 'a', month_diamonds: 250, meta_target: 500 })), 0.5);
  assert.equal(metaProgress(member({ id: 'b', month_diamonds: 0, meta_target: 500 })), 0);
});

test('passing the target fills the bar instead of overflowing it', () => {
  assert.equal(metaProgress(member({ id: 'a', month_diamonds: 1200, meta_target: 500 })), 1);
  assert.equal(metaProgress(member({ id: 'b', month_diamonds: 10, meta_target: 0 })), 0);
});

test('the breakdown counts people per meta from the lowest level up', () => {
  const rows = metaBreakdown([
    member({ id: 'a', meta_level: 2 }),
    member({ id: 'b', meta_level: 1 }),
    member({ id: 'c', meta_level: 2 }),
    member({ id: 'd', meta_level: 5 }),
  ]);
  assert.deepEqual(rows, [
    { level: 1, people: 1 },
    { level: 2, people: 2 },
    { level: 5, people: 1 },
  ]);
});
