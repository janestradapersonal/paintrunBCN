# paintrunBCN

## Overview
paintrunBCN is a web app inspired by Paper.io where runners "paint" Barcelona by uploading their Strava activities (GPX files). When a route closes a loop, the enclosed area gets painted on a map of Barcelona's neighborhoods. Users compete in monthly global and per-neighborhood rankings. The GLOBAL LIVE mode uses last-write-wins territorial control where newer activities paint over older ones.

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
- **User profiles**: Public profile pages with trophy cabinet, painted map, and activity list
- **User search**: Search for users by username from dashboard and rankings
- **Follow system**: Follow/unfollow users, see followers and following lists
- **Participant counts**: Rankings show total number of participants
- **Custom paint color**: Users can choose their paint color from presets or a custom color picker in their profile
- **GLOBAL LIVE**: Territorial control mode - last-write-wins, newer activities paint over older ones
  - Rankings show current territory owned (m² and % of Barcelona)
  - Multi-user territory map with each user's paint color
  - Territory computation uses turf.js polygon difference operations
- View any ranked user's painted areas on the map

## Pages
- `/` - Landing page (welcome panel when logged out, dashboard when logged in)
- `/register` - Registration form
- `/verify` - Email verification (OTP input)
- `/login` - Login form
- `/dashboard` - Redirects to `/` (dashboard is now part of landing page)
- `/rankings` - Rankings with Global/Neighborhoods tabs and month selector
- `/profile/:userId` - Public user profile with trophy cabinet, map, followers/following

## API Routes
- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify` - Verify email code
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user info
- `POST /api/activities/upload` - Upload GPX file (multipart/form-data)
- `GET /api/activities?month=YYYY-MM` - List user's activities (optional month filter)
- `GET /api/users/me/stats` - User stats (area + rank + titles)
- `PUT /api/users/me/paint-color` - Update user's paint color (hex format)
- `GET /api/users/search?q=query` - Search users by username
- `GET /api/users/:userId/profile` - User profile with stats and follow status
- `GET /api/users/:userId/activities?month=YYYY-MM` - Activities for specific user
- `GET /api/users/:userId/titles` - User's won titles
- `POST /api/users/:userId/follow` - Follow a user (auth required)
- `POST /api/users/:userId/unfollow` - Unfollow a user (auth required)
- `GET /api/users/:userId/followers` - User's followers list
- `GET /api/users/:userId/following` - User's following list
- `GET /api/rankings?month=YYYY-MM` - Monthly global rankings
- `GET /api/rankings/participant-count?month=YYYY-MM` - Total participants for the month
- `GET /api/rankings/neighborhoods?month=YYYY-MM` - Neighborhoods with activity
- `GET /api/rankings/neighborhoods/:name?month=YYYY-MM` - Per-neighborhood leaderboard
- `GET /api/rankings/neighborhoods/:name/participant-count?month=YYYY-MM` - Participants in a neighborhood
- `GET /api/rankings/global-live?month=YYYY-MM` - GLOBAL LIVE territorial rankings (last-write-wins)
- `GET /api/rankings/global-live/territories?month=YYYY-MM` - Territory polygons for map visualization

## Database Schema
- `users` - id, email, username, passwordHash, verified, totalAreaSqMeters, paintColor, createdAt
- `verification_codes` - id, email, code, expiresAt, used
- `activities` - id, userId, name, coordinates (jsonb), polygon (jsonb), areaSqMeters, distanceMeters, neighborhoodName, monthKey, uploadedAt
- `monthly_titles` - id, userId, monthKey, titleType (global/neighborhood), neighborhoodName, rank, areaSqMeters
- `follows` - id, followerId, followingId, createdAt (unique constraint on follower+following)
- `session` - auto-managed by connect-pg-simple

## Monthly System
- Activities are tagged with `monthKey` (format: YYYY-MM) on upload
- Rankings are filtered by month - users compete fresh each month
- Neighborhood rankings count overlapping area (run same plaza 3x = 3x area)
- General rankings sum all activity area for the month
- Titles are stored in `monthly_titles` when a user wins a ranking

## Dev Notes
- Verification codes are sent via SendGrid email (from janestrada888@gmail.com). If SendGrid is not configured or fails, the code falls back to console log and toast notification.
- Seed data creates 4 sample users with activities in current month
- MaratonistaBCN has duplicate Raval activity to demo intensity and neighborhood overlap counting
- Sample titles from previous month for 3 users
- Sample follows between users to demo the follow system
- Demo login: runner1@paintrunbcn.com / demo123
- Theme defaults to dark mode (fits the CARTO dark map tiles)
- Neighborhood detection uses turf.js booleanPointInPolygon with centroid fallback
