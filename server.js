const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scoreReview, summarize } = require('./reviewClassifier');

const PORT = process.env.PORT || 3000;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PUBLIC_DIR = path.join(__dirname, 'public');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function parseMapsUrl(mapsUrl) {
  try {
    return new URL(mapsUrl);
  } catch {
    return null;
  }
}

function extractPlaceId(mapsUrl) {
  try {
    const decoded = decodeURIComponent(mapsUrl);
    const match = decoded.match(/place_id:([A-Za-z0-9_-]+)/) || decoded.match(/[?&]placeid=([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function extractSearchText(mapsUrl) {
  const url = parseMapsUrl(mapsUrl);
  if (!url) {
    return null;
  }

  const q = url.searchParams.get('q');
  if (q && !q.toLowerCase().includes('place_id:')) {
    return q.trim();
  }

  const pathMatch = decodeURIComponent(url.pathname).match(/\/place\/([^/]+)/i);
  if (pathMatch) {
    return pathMatch[1].replace(/\+/g, ' ').trim();
  }

  return null;
}

async function findPlaceIdByText(searchText) {
  const endpoint = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  endpoint.searchParams.set('input', searchText);
  endpoint.searchParams.set('inputtype', 'textquery');
  endpoint.searchParams.set('fields', 'place_id');
  endpoint.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Google Find Place API failed with status ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'OK' || !Array.isArray(data.candidates) || data.candidates.length === 0) {
    throw new Error(data.error_message || 'Unable to resolve place ID from URL text.');
  }

  return data.candidates[0].place_id;
}

async function getPlaceDetails(placeId) {
  const endpoint = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  endpoint.searchParams.set('place_id', placeId);
  endpoint.searchParams.set('fields', 'name,rating,reviews,url');
  endpoint.searchParams.set('key', GOOGLE_MAPS_API_KEY);

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Google Places API request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(data.error_message || `Google Places API status: ${data.status}`);
  }

  return data.result;
}

function getDemoPlaceDetails(mapsUrl) {
  const id = crypto.createHash('sha1').update(mapsUrl).digest('hex').slice(0, 8);
  return {
    name: `Demo Place (${id})`,
    rating: 4.2,
    url: mapsUrl,
    reviews: [
      {
        author_name: 'Aarav S.',
        rating: 5,
        text: 'Amazing place! BEST EVER!!!',
        relative_time_description: 'Today'
      },
      {
        author_name: 'Neha R.',
        rating: 4,
        text: 'Food quality was good and staff were polite. Seating can be improved on busy evenings.',
        relative_time_description: '2 weeks ago'
      },
      {
        author_name: 'Rahul M.',
        rating: 5,
        text: 'Must visit.',
        relative_time_description: 'Just now'
      }
    ]
  };
}

function serveStatic(req, res) {
  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(requestPath).replace(/^\.\.(\/|\\|$)/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/analyze') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      let payload;
      try {
        payload = JSON.parse(body || '{}');
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON body.' });
        return;
      }

      const mapsUrl = payload.mapsUrl;

      if (!mapsUrl || typeof mapsUrl !== 'string' || !parseMapsUrl(mapsUrl)) {
        sendJson(res, 400, { error: 'Please provide a valid Google Maps URL.' });
        return;
      }

      try {
        let mode = 'demo';
        let warning = 'GOOGLE_MAPS_API_KEY is not set. Showing demo reviews. Add API key for live Google reviews.';
        let place;

        if (GOOGLE_MAPS_API_KEY) {
          const directPlaceId = extractPlaceId(mapsUrl);
          const placeId = directPlaceId || await findPlaceIdByText(extractSearchText(mapsUrl) || mapsUrl);
          place = await getPlaceDetails(placeId);
          mode = 'live';
          warning = null;
        } else {
          place = getDemoPlaceDetails(mapsUrl);
        }

        const reviews = (place.reviews || []).map(scoreReview);

        sendJson(res, 200, {
          mode,
          warning,
          place: {
            name: place.name,
            rating: place.rating,
            mapsUrl: place.url
          },
          summary: summarize(reviews),
          reviews
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message });
      }
    });

    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Fake review detector running on http://localhost:${PORT}`);
});
