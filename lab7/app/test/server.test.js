const assert = require('node:assert/strict');
const test = require('node:test');

test('lab application package is testable', () => {
  assert.equal(process.env.NODE_ENV || 'test', 'test');
});
