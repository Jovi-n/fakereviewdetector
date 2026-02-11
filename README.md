# Fake Review Detector (Google Maps)

A small web app where users paste a Google Maps URL and the system fetches available place reviews (via Google Places API), then classifies each review as **Likely Genuine** or **Likely Fake** using transparent heuristic rules.

## Features

- Input: Google Maps URL (`place_id` links and normal `/maps/place/...` links are both supported)
- Backend fetches reviews from Google Places Details API
- Rule-based fake review scoring
- Results page with summary counters and per-review reasons

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your API key:
   ```bash
   export GOOGLE_MAPS_API_KEY=your_key_here
   ```
3. Start server:
   ```bash
   npm start
   ```
4. Open:
   `http://localhost:3000`

## Notes

- This is a heuristic detector, not a guaranteed fraud classifier.
- If a URL does not include `place_id`, the server tries text-based place resolution in live mode and still works in demo mode.
- If `GOOGLE_MAPS_API_KEY` is missing, the app automatically runs in demo mode with sample reviews so the UI still works.
