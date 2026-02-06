# paintrunBCN

## Overview
paintrunBCN is a web app inspired by Paper.io where runners "paint" Barcelona by uploading their Strava activities (GPX files). When a route closes a loop, the enclosed area gets painted on a map of Barcelona's neighborhoods. Users compete in a global ranking for most square meters painted.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js with sessions (connect-pg-simple)
- **Database**: PostgreSQL (Drizzle ORM)
- **Maps**: Leaflet + react-leaflet with CARTO dark tile layer
- **GeoJSON**: Barcelona neighborhoods from official open data (barris.geojson in /public/data/)

## Key Features
- Email registration with 6-digit verification code
- GPX file upload and parsing (fast-xml-parser)
- Closed loop detection and area calculation (turf.js)
- Interactive Barcelona map with neighborhood boundaries
- Personal dashboard with activities list and map visualization
- Global ranking with podium (top 3) and full list
- View any ranked user's painted areas on the map

## Pages
- `/` - Landing page
- `/register` - Registration form
- `/verify` - Email verification (OTP input)
- `/login` - Login form
- `/dashboard` - Authenticated user dashboard with map + activities
- `/rankings` - Global ranking with user selection

## API Routes
- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify` - Verify email code
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user info
- `POST /api/activities/upload` - Upload GPX file (multipart/form-data)
- `GET /api/activities` - List user's activities
- `GET /api/users/me/stats` - User stats (area + rank)
- `GET /api/rankings` - Global rankings
- `GET /api/users/:userId/activities` - Activities for specific user

## Database Schema
- `users` - id, email, username, passwordHash, verified, totalAreaSqMeters
- `verification_codes` - id, email, code, expiresAt, used
- `activities` - id, userId, name, coordinates (jsonb), polygon (jsonb), areaSqMeters, distanceMeters
- `session` - auto-managed by connect-pg-simple

## Dev Notes
- Verification codes are logged to console and returned in response (dev mode)
- Seed data creates 4 sample users with activities
- Demo login: runner1@paintrunbcn.com / demo123
- Theme defaults to dark mode (fits the CARTO dark map tiles)
