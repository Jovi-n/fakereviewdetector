const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreReview, summarize } = require('../reviewClassifier');

test('flags suspicious short promotional reviews as likely fake', () => {
  const result = scoreReview({
    text: 'BEST EVER!!!',
    rating: 5,
    relative_time_description: 'Today'
  });

  assert.equal(result.label, 'Likely Fake');
  assert.ok(result.suspiciousPoints >= 3);
});

test('keeps detailed neutral review as likely genuine', () => {
  const result = scoreReview({
    text: 'The place was clean, service was quick, and prices were reasonable for the location.',
    rating: 4,
    relative_time_description: '2 weeks ago'
  });

  assert.equal(result.label, 'Likely Genuine');
});

test('summary returns accurate totals', () => {
  const summary = summarize([
    { label: 'Likely Fake' },
    { label: 'Likely Genuine' },
    { label: 'Likely Fake' }
  ]);

  assert.deepEqual(summary, {
    totalReviews: 3,
    likelyFake: 2,
    likelyGenuine: 1
  });
});
