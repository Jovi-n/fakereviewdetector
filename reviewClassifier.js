const suspiciousKeywords = [
  'best ever',
  'must visit',
  'five stars',
  'highly recommended',
  '100% genuine',
  'life changing',
  'perfect service',
  'amazing place',
  'awesome',
  'superb'
];

function scoreReview(review) {
  const text = (review.text || '').trim();
  const lower = text.toLowerCase();
  const score = {
    suspiciousPoints: 0,
    reasons: []
  };

  if (!text) {
    score.suspiciousPoints += 2;
    score.reasons.push('No review text was provided.');
  }

  if (text.length > 0 && text.length < 20) {
    score.suspiciousPoints += 2;
    score.reasons.push('Very short review text.');
  }

  if (/!{3,}/.test(text) || /\?{3,}/.test(text)) {
    score.suspiciousPoints += 1;
    score.reasons.push('Excessive punctuation.');
  }

  if ((text.match(/[A-Z]/g) || []).length > text.length * 0.4 && text.length > 10) {
    score.suspiciousPoints += 1;
    score.reasons.push('Too many uppercase letters.');
  }

  if (suspiciousKeywords.some((keyword) => lower.includes(keyword))) {
    score.suspiciousPoints += 1;
    score.reasons.push('Contains promotional phrasing.');
  }

  if (review.rating === 5 && text.length < 35) {
    score.suspiciousPoints += 1;
    score.reasons.push('5-star rating with little detail.');
  }

  if (review.relative_time_description && /today|just now/i.test(review.relative_time_description) && text.length < 25) {
    score.suspiciousPoints += 1;
    score.reasons.push('Fresh review with low detail.');
  }

  const label = score.suspiciousPoints >= 3 ? 'Likely Fake' : 'Likely Genuine';

  return {
    author: review.author_name || 'Anonymous',
    rating: review.rating,
    text,
    timeDescription: review.relative_time_description || 'Unknown time',
    label,
    suspiciousPoints: score.suspiciousPoints,
    reasons: score.reasons
  };
}

function summarize(results) {
  const fakeCount = results.filter((item) => item.label === 'Likely Fake').length;
  const genuineCount = results.length - fakeCount;

  return {
    totalReviews: results.length,
    likelyFake: fakeCount,
    likelyGenuine: genuineCount
  };
}

module.exports = {
  scoreReview,
  summarize
};
