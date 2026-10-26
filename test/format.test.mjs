import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRut, iniciales } from '../src/format.js';

test('iniciales del conductor', () => {
  assert.equal(iniciales('Conductor Demo'), 'CD');
  assert.equal(iniciales('Camilo Andrés Alvarez Soto'), 'CS');
  assert.equal(iniciales('Pedro'), 'P');
  assert.equal(iniciales(''), '?');
});

test('formato de RUT', () => {
  assert.equal(formatRut('11111111-1'), '11.111.111-1');
  assert.equal(formatRut('18501578-5'), '18.501.578-5');
  assert.equal(formatRut('12.345.678-k'), '12.345.678-K');
  assert.equal(formatRut('123456-7'), '123.456-7');
  assert.equal(formatRut('sin rut'), 'sin rut');
});
