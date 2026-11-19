import assert from 'node:assert/strict';
import test from 'node:test';
import { agencyTotals, groupAgencies, type AgencyPerson } from '../lib/agencies.ts';

function person(over: Partial<AgencyPerson> & { id: string }): AgencyPerson {
  return {
    display_name: over.id,
    avatar_url: null,
    level: 1,
    diamonds: 0,
    agency_name: null,
    assigned_badge: 'agency',
    diamonds_received: 0,
    diamonds_received_30d: 0,
    ...over,
  };
}

test('people of the same agency group together and their diamonds add up', () => {
  const groups = groupAgencies([
    person({ id: 'a', agency_name: 'Luna', diamonds_received: 500, diamonds_received_30d: 100 }),
    person({ id: 'b', agency_name: 'Luna', diamonds_received: 250, diamonds_received_30d: 50 }),
    person({ id: 'c', agency_name: 'Sol', diamonds_received: 400, diamonds_received_30d: 0 }),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, 'Luna');
  assert.equal(groups[0].members.length, 2);
  assert.equal(groups[0].diamonds, 750);
  assert.equal(groups[0].diamonds30d, 150);
  assert.deepEqual(groups[0].members.map(member => member.id), ['a', 'b']);
  assert.deepEqual(groups.map(group => group.name), ['Luna', 'Sol']);
});

test('case and stray spaces never split one agency into two', () => {
  const groups = groupAgencies([
    person({ id: 'a', agency_name: '  Estrella  ' }),
    person({ id: 'b', agency_name: 'estrella' }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, 'Estrella');
  assert.equal(groups[0].members.length, 2);
});

test('people with the badge but no agency name wait in their own group at the end', () => {
  const groups = groupAgencies([
    person({ id: 'a', agency_name: null, diamonds_received: 9000 }),
    person({ id: 'b', agency_name: 'Sol', diamonds_received: 10 }),
  ]);
  assert.equal(groups[0].name, 'Sol');
  assert.equal(groups[1].name, null);
  assert.equal(groups[1].members[0].id, 'a');
});

test('totals only count real agencies, never the unnamed group', () => {
  const totals = agencyTotals(groupAgencies([
    person({ id: 'a', agency_name: 'Luna', diamonds_received: 100, diamonds_received_30d: 40 }),
    person({ id: 'b', agency_name: null, diamonds_received: 70 }),
    person({ id: 'c', agency_name: 'Sol', diamonds_received: 30 }),
  ]));
  assert.deepEqual(totals, { agencies: 2, people: 2, diamonds: 130, diamonds30d: 40, withoutAgency: 1 });
});
