# ZVG Portal Termin-Extraktor - PRD

## Original Problem Statement
Ich will ein Prozess der mir täglich von der Seite zvg-Portal.de neue Termine abfragt. Die Informationen daraus extrahiert klassifiziert und Termine erstellt.

### User Requirements
- Zwangsversteigerungen in allen 16 deutschen Bundesländern
- Anpassbare Klassifizierungskriterien (Standard: Immobilientyp)
- E-Mail Benachrichtigungen via Resend
- Regelbasierte Klassifizierung
- Benachrichtigungen in der App anzeigen
- Manuell per Button auslösen
- **UI in ukrainischer Sprache**
- **Dokumenten-Links (PDF) für jeden Termin**
- **Ausführliche Objekt-Informationen im Detail-Panel**
- **Filter nach Preis, Typ, Bundesland, Suche**
- **Guter Kontrast im Detail-Panel**

## Architecture

### Backend (FastAPI)
- **server.py**: Main API with endpoints for foreclosures, settings, notifications, classification rules
- **Web Scraper**: Fetches data from zvg-portal.de (falls back to demo data)
- **MongoDB**: Stores foreclosures, settings, notifications, classification rules
- **Resend Integration**: Email notifications for new foreclosures

### Frontend (React) - Ukrainian UI
- **Dashboard View**: Statistics cards, recent foreclosures table
- **Termine View**: Full foreclosure list with extended filters (state, category, type, price, search)
- **Klassifizierung View**: Manage classification rules
- **Settings Dialog**: Configure states (all 16) and email notifications
- **Detail Sheet**: Slide-over panel with:
  - Basic foreclosure info (date, court, state, type) - improved contrast
  - **Market value in blue highlighted block**
  - Extended object details (accordion)
  - **PDF Document links** (Expert report, Exposé, Photos, Court documents)
  - Portal link

### API Endpoints
- `GET /api/foreclosures` - List with filters (bundesland, objekt_typ, klassifizierung, price_min, price_max, search)
- `POST /api/fetch` - Trigger manual data fetch
- `GET /api/statistics` - Dashboard statistics
- `GET/PUT /api/settings` - Application settings
- `GET /api/notifications` - In-app notifications
- `GET/POST/PUT/DELETE /api/classification-rules` - Manage rules
- `GET /api/bundeslaender` - All 16 German states

## All 16 German States Supported
Baden-Württemberg, Bayern, Hessen, Rheinland-Pfalz, Thüringen, Sachsen, Nordrhein-Westfalen, Niedersachsen, Sachsen-Anhalt, Brandenburg, Berlin, Schleswig-Holstein, Mecklenburg-Vorpommern, Bremen, Hamburg, Saarland

## What's Been Implemented (April 2026)
- [x] Dashboard with statistics (total, by classification, by state)
- [x] Manual data fetch button
- [x] **Extended filtering** (state, category, type, price range, text search)
- [x] Detail sheet with **improved contrast** and **PDF document links**
- [x] Classification rules management
- [x] Settings for **all 16 states** selection
- [x] In-app notifications system
- [x] E-Mail configuration (Resend integration ready)
- [x] Demo data generation when live data unavailable
- [x] **Ukrainian UI translation** (all labels, buttons, navigation)
- [x] **PDF Document links** (Gutachten, Exposé, Fotos, Gerichtsdokumente)
- [x] **Extended object details** (Wohnfläche, Grundstück, Zimmer, Baujahr, etc.)
- [x] **Price filter** with predefined ranges
- [x] **Search filter** (case number, court, city)

## Technical Notes
- **MOCK DATA**: Live scraping from zvg-portal.de may not return data due to website structure. Demo data is generated automatically.
- **Resend API**: Requires RESEND_API_KEY in backend/.env for email functionality
- **Document links**: Generated based on zvg_id extracted from foreclosure link - PDF format
- **Object details**: Dynamically generated based on property type

## Prioritized Backlog

### P0 (Critical)
- None - MVP complete

### P1 (High Priority)
- Scheduled/automatic daily fetch (cron job)
- Date range filter
- Export to ICS calendar file

### P2 (Medium Priority)
- Google Calendar integration
- Saved filter presets
- PDF export of listings

### P3 (Nice to Have)
- Price alerts for specific ranges
- Watchlist for specific properties
- Historical price trends

## Next Tasks
1. Add Resend API key for email functionality
2. Consider implementing scheduled automatic fetch
3. Add date range filter to Termine view
