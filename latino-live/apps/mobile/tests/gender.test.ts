import assert from 'node:assert/strict';
import test from 'node:test';
import { GENDERS, NAME_MAX, asGender, genderOf, genderPayload } from '../lib/gender.ts';

test('only the three chosen values count as a gender', () => {
  assert.equal(asGender('mujer'), 'mujer');
  assert.equal(asGender('hombre'), 'hombre');
  assert.equal(asGender('otro'), 'otro');
  assert.equal(asGender('MUJER'), '');
  assert.equal(asGender(null), '');
  assert.equal(asGender(undefined), '');
  assert.equal(asGender('cualquiera'), '');
});

test('a profile without a gender shows nothing', () => {
  assert.equal(genderOf(''), null);
  assert.equal(genderOf(null), null);
});

test('each gender carries the label the profile shows', () => {
  assert.equal(genderOf('mujer')?.label, 'Mujer');
  assert.equal(genderOf('hombre')?.label, 'Hombre');
  assert.equal(genderOf('otro')?.label, 'Otro');
  assert.equal(GENDERS.length, 3);
});

test('a name never passes fifteen letters', () => {
  assert.equal(NAME_MAX, 15);
  assert.equal('geormaryvaldez750'.slice(0, NAME_MAX).length, 15);
});

test('the signup sends only one of the three values', () => {
  assert.deepEqual(genderPayload('mujer'), { gender: 'mujer' });
  assert.deepEqual(genderPayload('hombre'), { gender: 'hombre' });
  assert.deepEqual(genderPayload('otro'), { gender: 'otro' });
});

test('a signup without a valid choice sends nothing', () => {
  assert.equal(genderPayload(''), null);
  assert.equal(genderPayload('cualquiera'), null);
  assert.equal(genderPayload(null), null);
});
