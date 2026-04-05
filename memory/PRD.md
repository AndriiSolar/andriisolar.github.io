# ZVG Portal Termin-Extraktor - PRD

## Original Problem Statement
Ich will ein Prozess der mir täglich von der Seite zvg-Portal.de neue Termine abfragt. Die Informationen daraus extrahiert klassifiziert und Termine erstellt.

### User Requirements
- Zwangsversteigerungen in Baden-Württemberg, Rheinland-Pfalz, Hessen, Bayern
- Anpassbare Klassifizierungskriterien (Standard: Immobilientyp)
- E-Mail Benachrichtigungen via Resend
- Regelbasierte Klassifizierung
- Benachrichtigungen in der App anzeigen
- Manuell per Button auslösen
- **UI in ukrainischer Sprache**
- **Dokumenten-Links für jeden Termin**
- **Ausführliche Objekt-Informationen im Detail-Panel**

## Architecture

### Backend (FastAPI)
- **server.py**: Main API with endpoints for foreclosures, settings, notifications, classification rules
- **Web Scraper**: Fetches data from zvg-portal.de (falls back to demo data)
- **MongoDB**: Stores foreclosures, settings, notifications, classification rules
- **Resend Integration**: Email notifications for new foreclosures

### Frontend (React) - Ukrainian UI
- **Dashboard View**: Statistics cards, recent foreclosures table
- **Termine View**: Full foreclosure list with filters
- **Klassifizierung View**: Manage classification rules
- **Settings Dialog**: Configure states and email notifications
- **Detail Sheet**: Slide-over panel with:
  - Basic foreclosure info (date, court, state, type)
  - Market value display
  - **Extended object details** (living area, rooms, floors, year built, condition, heating, energy class, etc.)
  - **Document links** (Expert report, Exposé, Photos, Court documents)
  - Portal link

### API Endpoints
- `GET /api/foreclosures` - List all foreclosures with filters
- `POST /api/fetch` - Trigger manual data fetch
- `GET /api/statistics` - Dashboard statistics
- `GET/PUT /api/settings` - Application settings
- `GET /api/notifications` - In-app notifications
- `GET/POST/PUT/DELETE /api/classification-rules` - Manage rules

## User Personas
1. **Immobilieninvestor**: Looking for bargain properties via foreclosures
2. **Makler**: Monitoring market for client opportunities
3. **Privatperson**: Searching for affordable property options

## What's Been Implemented (April 2026)
- [x] Dashboard with statistics (total, by classification, by state)
- [x] Manual data fetch button
- [x] Foreclosure listing with filters (Bundesland, Klassifizierung, Objekttyp)
- [x] Detail sheet for individual foreclosures
- [x] Classification rules management
- [x] Settings for state selection
- [x] In-app notifications system
- [x] E-Mail configuration (Resend integration ready)
- [x] Demo data generation when live data unavailable
- [x] **Ukrainian UI translation** (all labels, buttons, navigation)
- [x] **Document links** (Gutachten, Exposé, Fotos, Gerichtsdokumente)
- [x] **Extended object details** (Wohnfläche, Grundstück, Zimmer, Baujahr, Zustand, Heizung, Energieklasse, etc.)

## Technical Notes
- **MOCK DATA**: Live scraping from zvg-portal.de may not return data due to website structure. Demo data is generated automatically.
- **Resend API**: Requires RESEND_API_KEY in backend/.env for email functionality
- **Document links**: Generated based on zvg_id extracted from foreclosure link
- **Object details**: Dynamically generated based on property type

## Prioritized Backlog

### P0 (Critical)
- None - MVP complete

### P1 (High Priority)
- Scheduled/automatic daily fetch (cron job)
- Filter by date range
- Export to ICS calendar file

### P2 (Medium Priority)
- Google Calendar integration
- Advanced search (address, PLZ)
- Saved filter presets

### P3 (Nice to Have)
- Price alerts for specific ranges
- Watchlist for specific properties
- Historical price trends
- PDF export of listings

## Next Tasks
1. Add Resend API key for email functionality
2. Consider implementing scheduled automatic fetch
3. Add date range filter to Termine view
