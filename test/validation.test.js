const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReservation } = require('../server');

test('예약 필수 필드와 시간 순서를 검증한다', () => {
  assert.match(validateReservation({}), /필수 항목/);
  assert.match(validateReservation({ roomId: 1, reserverName: '홍길동', email: 'a@b.com', startAt: '2026-01-01T10:00:00Z', endAt: '2026-01-01T09:00:00Z', title: '회의' }), /종료일시/);
  assert.equal(validateReservation({ roomId: 1, reserverName: '홍길동', email: 'a@b.com', startAt: '2026-01-01T10:00:00Z', endAt: '2026-01-01T11:00:00Z', title: '회의' }), null);
});