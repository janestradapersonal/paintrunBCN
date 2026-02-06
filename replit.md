# paintrunBCN

## Overview
paintrunBCN is a web app inspired by Paper.io where runners "paint" Barcelona by uploading their Strava activities (GPX files). When a route closes a loop, the enclosed area gets painted on a map of Barcelona's neighborhoods. Users compete in monthly global and per-neighborhood rankings.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js with sessions (connect-pg-simple)
- **Database**: PostgreSQL (Drizzle ORM)
- **Maps**: Leaflet + react-leaflet with CARTO dark tile layer
- **GeoJSON**: Barcelona neighborhoods from official open data (barris.geojson in /client/public/data/)

## Key Features
- Email registration with 6-digit verification code
- GPX file upload and parsing (fast-xml-parser)
- Closed loop detection and area calculation (turf.js)
- Automatic neighborhood detection using turf.js point-in-polygon
- Interactive Barcelona map with neighborhood boundaries
- **Intensity map**: Repeated runs over same area show progressively more opaque color
- Personal dashboard with activities list, map, and titles
- **Monthly rankings**: Global and per-neighborhood, reset each month
- **Neighborhood rankings**: Overlapping/repeated painting counts multiple times
- **Titles/achievements**: Users earn titles when they win monthly rankings
- View any ranked user's painted areas on the map

## Pages
- `/` - Landing page
- `/register` - Registration form
- `/verify` - Email verification (OTP input)
- `/login` - Login form
- `/dashboard` - Authenticated user dashboard with map + activities + titles
- `/rankings` - Rankings with Global/Neighborhoods tabs and month selector

## API Routes
- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify` - Verify email code
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user info
- `POST /api/activities/upload` - Upload GPX file (multipart/form-data)
- `GET /api/activities?month=YYYY-MM` - List user's activities (optional month filter)
- `GET /api/users/me/stats` - User stats (area + rank + titles)
- `GET /api/rankings?month=YYYY-MM` - Monthly global rankings
- `GET /api/rankings/neighborhoods?month=YYYY-MM` - Neighborhoods with activity
- `GET /api/rankings/neighborhoods/:name?month=YYYY-MM` - Per-neighborhood leaderboard
- `GET /api/users/:userId/activities?month=YYYY-MM` - Activities for specific user
- `GET /api/users/:userId/titles` - User's won titles

## Database Schema
- `users` - id, email, username, passwordHash, verified, totalAreaSqMeters
- `verification_codes` - id, email, code, expiresAt, used
- `activities` - id, userId, name, coordinates (jsonb), polygon (jsonb), areaSqMeters, distanceMeters, neighborhoodName, monthKey, uploadedAt
- `monthly_titles` - id, userId, monthKey, titleType (global/neighborhood), neighborhoodName, rank, areaSqMeters
- `session` - auto-managed by connect-pg-simple

## Monthly System
- Activities are tagged with `monthKey` (format: YYYY-MM) on upload
- Rankings are filtered by month - users compete fresh each month
- Neighborhood rankings count overlapping area (run same plaza 3x = 3x area)
- General rankings sum all activity area for the month
- Titles are stored in `monthly_titles` when a user wins a ranking

## Dev Notes
- Verification codes are logged to console and shown in a toast notification (dev mode only). No email delivery service is configured - to add email delivery, set up Resend or SendGrid integration and update server/routes.ts to send the code via email instead of returning it.
- Seed data creates 4 sample users with activities in current month
- MaratonistaBCN has duplicate Raval activity to demo intensity and neighborhood overlap counting
- Sample titles from previous month for 3 users
- Demo login: runner1@paintrunbcn.com / demo123
- Theme defaults to dark mode (fits the CARTO dark map tiles)
- Neighborhood detection uses turf.js booleanPointInPolygon with centroid fallback
