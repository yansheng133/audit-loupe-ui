// node --test pkg/audit-loupe/test/  (no extra packages; Node 20 or later)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backendState, backendMessage } from '../lib/api.js';

const err = (status) => Object.assign(new Error(`HTTP ${ status }`), { status });

test('no permission, no backend and a backend that is down are told apart', () => {
  assert.equal(backendState(err(403)), 'forbidden');
  assert.equal(backendState(err(401)), 'forbidden');
  assert.equal(backendState(err(404)), 'absent');
  assert.equal(backendState(err(503)), 'down');
  assert.equal(backendState(err(502)), 'down');
  assert.equal(backendState(err(504)), 'down');
});

test('the backend\'s own errors are not taken for a backend problem', () => {
  assert.equal(backendState(err(400)), null);
  assert.equal(backendState(err(409)), null);
  assert.equal(backendState(err(500)), null);
  assert.equal(backendState(new Error('network')), null);
});

test('the message names the status', () => {
  const T = { backendForbidden: (s) => `f${ s }`, backendMissing: (s) => `m${ s }`, backendDown: (s) => `d${ s }` };

  assert.equal(backendMessage(T, err(403)), 'f403');
  assert.equal(backendMessage(T, err(404)), 'm404');
  assert.equal(backendMessage(T, err(503)), 'd503');
  assert.equal(backendMessage(T, err(500)), null);
});
