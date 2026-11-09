import test from 'node:test';
import assert from 'node:assert/strict';
import { rotiJoinUrl, rotiHostUrl, isRotiCode } from '../site/js/roti.js';

test('ROTI : liens participant et animateur de l\'outil ROTI', () => {
  assert.equal(rotiJoinUrl('QVZS'), 'https://agileroy.github.io/roti/?salle=QVZS');
  assert.equal(rotiHostUrl('QVZS'), 'https://agileroy.github.io/roti/?animer=QVZS');
  assert.equal(isRotiCode('QVZS'), true);
  assert.equal(isRotiCode('ABCI'), false);
});
