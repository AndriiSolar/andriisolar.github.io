from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx
from bs4 import BeautifulSoup
import asyncio
import resend
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend configuration
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class Foreclosure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    aktenzeichen: str
    gericht: str
    bundesland: str
    bundesland_code: str
    termin_datum: str
    termin_zeit: Optional[str] = None
    adresse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    objekt_typ: str
    objekt_typ_id: Optional[str] = None
    verkehrswert: Optional[str] = None
    beschreibung: Optional[str] = None
    klassifizierung: str = "Sonstiges"
    link: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ForeclosureResponse(BaseModel):
    id: str
    aktenzeichen: str
    gericht: str
    bundesland: str
    bundesland_code: str
    termin_datum: str
    termin_zeit: Optional[str] = None
    adresse: Optional[str] = None
    plz: Optional[str] = None
    ort: Optional[str] = None
    objekt_typ: str
    objekt_typ_id: Optional[str] = None
    verkehrswert: Optional[str] = None
    beschreibung: Optional[str] = None
    klassifizierung: str
    link: Optional[str] = None
    created_at: str

class ClassificationRule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    objekt_typ_ids: List[str]
    active: bool = True

class ClassificationRuleCreate(BaseModel):
    name: str
    objekt_typ_ids: List[str]
    active: bool = True

class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "settings"
    email_notifications_enabled: bool = False
    notification_email: Optional[str] = None
    selected_bundeslaender: List[str] = ["bw", "by", "he", "rp", "th", "sn", "nw", "ni", "st", "br", "be", "sh", "mv"]

class SettingsUpdate(BaseModel):
    email_notifications_enabled: Optional[bool] = None
    notification_email: Optional[EmailStr] = None
    selected_bundeslaender: Optional[List[str]] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message: str
    type: str = "info"
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: str
    html_content: str

class FetchStatus(BaseModel):
    status: str
    message: str
    new_count: int = 0
    total_count: int = 0

# ============== CONSTANTS ==============

BUNDESLAENDER = {
    "bw": "Baden-Württemberg",
    "by": "Bayern",
    "he": "Hessen",
    "rp": "Rheinland-Pfalz",
    "th": "Thüringen",
    "sn": "Sachsen",
    "nw": "Nordrhein-Westfalen",
    "ni": "Niedersachsen",
    "st": "Sachsen-Anhalt",
    "br": "Brandenburg",
    "be": "Berlin",
    "sh": "Schleswig-Holstein",
    "mv": "Mecklenburg-Vorpommern",
    "hb": "Bremen",
    "hh": "Hamburg",
    "sl": "Saarland"
}

OBJEKT_TYPEN = {
    "1": "Reihenhaus",
    "2": "Doppelhaushälfte",
    "3": "Einfamilienhaus",
    "19": "Zweifamilienhaus",
    "4": "Mehrfamilienhaus",
    "5": "Eigentumswohnung (1-2 Zimmer)",
    "6": "Eigentumswohnung (3-4 Zimmer)",
    "7": "Eigentumswohnung (ab 5 Zimmer)",
    "8": "Gewerbeeinheit",
    "13": "Wohn-/Geschäftshaus",
    "9": "Garage",
    "10": "Kfz-Stellplatz",
    "11": "Kfz-Stellplatz (Tiefgarage)",
    "12": "Sonstiges Teileigentum",
    "14": "Gewerbegrundstück",
    "15": "Baugrundstück",
    "16": "Unbebautes Grundstück",
    "17": "Land-/Forstwirtschaft",
    "18": "Sonstiges"
}

# Default classification rules
DEFAULT_CLASSIFICATION_RULES = [
    {"id": "1", "name": "Wohnhäuser", "objekt_typ_ids": ["1", "2", "3", "19", "4"], "active": True},
    {"id": "2", "name": "Wohnungen", "objekt_typ_ids": ["5", "6", "7"], "active": True},
    {"id": "3", "name": "Gewerbe", "objekt_typ_ids": ["8", "13", "14"], "active": True},
    {"id": "4", "name": "Grundstücke", "objekt_typ_ids": ["15", "16", "17"], "active": True},
    {"id": "5", "name": "Stellplätze", "objekt_typ_ids": ["9", "10", "11"], "active": True},
    {"id": "6", "name": "Sonstiges", "objekt_typ_ids": ["12", "18"], "active": True},
]

# ============== ZVG PORTAL PROXY ==============

# Store sessions for ZVG portal access
zvg_sessions = {}

async def get_zvg_session(bundesland_code: str) -> httpx.Cookies:
    """Get or create a session with ZVG portal cookies"""
    import time
    
    # Check if we have a valid session (less than 10 minutes old)
    session_key = bundesland_code
    current_time = time.time()
    
    if session_key in zvg_sessions:
        session_data = zvg_sessions[session_key]
        if current_time - session_data['created'] < 600:  # 10 minutes
            return session_data['cookies']
    
    # Create new session by visiting the search page first
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # First, visit the main search page to get cookies
        search_response = await client.get(
            "https://www.zvg-portal.de/index.php?button=Termine%20suchen",
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
            }
        )
        
        # Then perform a search to establish the session
        await client.post(
            "https://www.zvg-portal.de/index.php?button=Suchen",
            data={"land_abk": bundesland_code, "ger_id": "0", "order_by": "2"},
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": "https://www.zvg-portal.de/index.php?button=Termine%20suchen",
            }
        )
        
        # Store session
        zvg_sessions[session_key] = {
            'cookies': client.cookies,
            'created': current_time
        }
        
        return client.cookies

@api_router.get("/zvg-redirect")
async def zvg_redirect(zvg_id: str, land_abk: str):
    """
    Redirect to ZVG portal detail page with proper session.
    This endpoint first establishes a session, then redirects to the detail page.
    """
    from fastapi.responses import HTMLResponse
    
    # Create an HTML page that:
    # 1. First loads the search page in a hidden iframe to get cookies
    # 2. Then redirects to the detail page
    
    detail_url = f"https://www.zvg-portal.de/index.php?button=showZvg&zvg_id={zvg_id}&land_abk={land_abk}"
    search_url = f"https://www.zvg-portal.de/index.php?button=Suchen&land_abk={land_abk}&ger_id=0&order_by=2"
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weiterleitung zum ZVG-Portal...</title>
        <style>
            body {{
                font-family: 'IBM Plex Sans', -apple-system, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: #F9FAFB;
            }}
            .loader {{
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }}
            .spinner {{
                width: 40px;
                height: 40px;
                border: 3px solid #E5E7EB;
                border-top-color: #0052FF;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            }}
            @keyframes spin {{
                to {{ transform: rotate(360deg); }}
            }}
            h2 {{ color: #111827; margin: 0 0 0.5rem; font-size: 1.25rem; }}
            p {{ color: #6B7280; margin: 0; font-size: 0.875rem; }}
            .countdown {{ font-size: 1.5rem; font-weight: bold; color: #0052FF; margin: 1rem 0; }}
            .manual-link {{
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid #E5E7EB;
            }}
            a {{
                color: #0052FF;
                text-decoration: none;
            }}
            a:hover {{
                text-decoration: underline;
            }}
        </style>
    </head>
    <body>
        <div class="loader">
            <div class="spinner"></div>
            <h2>Weiterleitung zum ZVG-Portal</h2>
            <p>Session wird aufgebaut...</p>
            <div class="countdown" id="countdown">8</div>
            <p>Sekunden bis zur Weiterleitung</p>
            <div class="manual-link">
                <p>Falls die Weiterleitung nicht funktioniert:</p>
                <p><a href="{search_url}" target="_blank">1. Klicken Sie hier für die Suche</a></p>
                <p><a href="{detail_url}" target="_blank">2. Dann hier für den Termin</a></p>
            </div>
        </div>
        
        <iframe id="session-frame" style="display:none;" src="{search_url}"></iframe>
        
        <script>
            var seconds = 8;
            var countdownEl = document.getElementById('countdown');
            
            // Countdown timer
            var timer = setInterval(function() {{
                seconds--;
                countdownEl.textContent = seconds;
                if (seconds <= 0) {{
                    clearInterval(timer);
                    window.location.href = "{detail_url}";
                }}
            }}, 1000);
        </script>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

@api_router.get("/zvg-document")
async def zvg_document(zvg_id: str, land_abk: str, doc_type: str):
    """
    Redirect to ZVG portal document (PDF) with proper session.
    doc_type can be: gutachten, expose, fotos, dokumente
    """
    from fastapi.responses import HTMLResponse
    
    # Document URL patterns
    doc_urls = {
        "gutachten": f"https://www.zvg-portal.de/index.php?button=showAnhang&zvg_id={zvg_id}&land_abk={land_abk}&anhession=gutachten",
        "expose": f"https://www.zvg-portal.de/index.php?button=showAnhang&zvg_id={zvg_id}&land_abk={land_abk}&anhession=expose",
        "fotos": f"https://www.zvg-portal.de/index.php?button=showZvgFotos&zvg_id={zvg_id}&land_abk={land_abk}",
        "dokumente": f"https://www.zvg-portal.de/index.php?button=showAnhang&zvg_id={zvg_id}&land_abk={land_abk}&anhession=dokumente",
    }
    
    doc_url = doc_urls.get(doc_type, doc_urls["gutachten"])
    search_url = f"https://www.zvg-portal.de/index.php?button=Suchen&land_abk={land_abk}&ger_id=0&order_by=2"
    detail_url = f"https://www.zvg-portal.de/index.php?button=showZvg&zvg_id={zvg_id}&land_abk={land_abk}"
    
    doc_names = {
        "gutachten": "Gutachten",
        "expose": "Exposé", 
        "fotos": "Fotos",
        "dokumente": "Gerichtsdokumente"
    }
    doc_name = doc_names.get(doc_type, "Dokument")
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{doc_name} wird geladen...</title>
        <style>
            body {{
                font-family: 'IBM Plex Sans', -apple-system, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: #F9FAFB;
            }}
            .loader {{
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                max-width: 400px;
            }}
            .spinner {{
                width: 40px;
                height: 40px;
                border: 3px solid #E5E7EB;
                border-top-color: #DC2626;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
            }}
            @keyframes spin {{
                to {{ transform: rotate(360deg); }}
            }}
            h2 {{ color: #111827; margin: 0 0 0.5rem; font-size: 1.25rem; }}
            p {{ color: #6B7280; margin: 0; font-size: 0.875rem; }}
            .countdown {{ font-size: 1.5rem; font-weight: bold; color: #DC2626; margin: 1rem 0; }}
            .manual-link {{
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid #E5E7EB;
            }}
            a {{
                color: #0052FF;
                text-decoration: none;
            }}
            a:hover {{
                text-decoration: underline;
            }}
            .steps {{
                text-align: left;
                margin-top: 0.5rem;
            }}
            .steps li {{
                margin: 0.5rem 0;
            }}
        </style>
    </head>
    <body>
        <div class="loader">
            <div class="spinner"></div>
            <h2>{doc_name} wird geladen</h2>
            <p>Session wird aufgebaut...</p>
            <div class="countdown" id="countdown">10</div>
            <p>Sekunden bis zum Download</p>
            <div class="manual-link">
                <p><strong>Falls das Dokument nicht lädt:</strong></p>
                <ol class="steps">
                    <li><a href="{search_url}" target="_blank">Zuerst hier klicken (Suche)</a></li>
                    <li><a href="{detail_url}" target="_blank">Dann Termin öffnen</a></li>
                    <li><a href="{doc_url}" target="_blank">Dann {doc_name} öffnen</a></li>
                </ol>
            </div>
        </div>
        
        <iframe id="session-frame-1" style="display:none;" src="{search_url}"></iframe>
        <iframe id="session-frame-2" style="display:none;"></iframe>
        
        <script>
            var seconds = 10;
            var countdownEl = document.getElementById('countdown');
            var step = 0;
            
            // After search page loads, load the detail page
            document.getElementById('session-frame-1').onload = function() {{
                if (step === 0) {{
                    step = 1;
                    // Load detail page to establish full session
                    document.getElementById('session-frame-2').src = "{detail_url}";
                }}
            }};
            
            // Countdown timer
            var timer = setInterval(function() {{
                seconds--;
                countdownEl.textContent = seconds;
                if (seconds <= 0) {{
                    clearInterval(timer);
                    window.location.href = "{doc_url}";
                }}
            }}, 1000);
        </script>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

async def fetch_foreclosures_from_portal(bundesland_code: str) -> List[dict]:
    """Fetch real foreclosure listings from zvg-portal.de for a specific state"""
    results = []
    base_url = "https://www.zvg-portal.de"
    
    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as http_client:
            # Make a search request
            search_data = {
                "land_abk": bundesland_code,
                "ger_id": "0",
                "order_by": "2"
            }
            
            response = await http_client.post(
                f"{base_url}/index.php?button=Suchen",
                data=search_data,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
                }
            )
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'lxml')
                
                # Find all links to detail pages (format: index.php?button=showZvg&zvg_id=XXXXX&land_abk=XX)
                detail_links = soup.find_all('a', href=lambda h: h and 'showZvg' in str(h) and 'zvg_id' in str(h))
                
                for link in detail_links:
                    try:
                        href = link.get('href', '')
                        
                        # Extract zvg_id from the link
                        zvg_id_match = re.search(r'zvg_id=(\d+)', href)
                        if not zvg_id_match:
                            continue
                        zvg_id = zvg_id_match.group(1)
                        
                        # Extract aktenzeichen from link text
                        aktenzeichen_text = link.get_text(strip=True)
                        aktenzeichen = aktenzeichen_text.replace('(Detailansicht)', '').strip()
                        
                        # Navigate to parent row structure to get other data
                        # The structure is: TR > TD > a (aktenzeichen link)
                        parent_row = link.find_parent('tr')
                        if not parent_row:
                            continue
                        
                        # Find all subsequent rows until the next <hr> separator
                        current_element = parent_row
                        gericht = ""
                        objekt_lage = ""
                        verkehrswert = ""
                        termin_text = ""
                        pdf_link = ""
                        
                        while current_element:
                            current_element = current_element.find_next_sibling('tr')
                            if not current_element:
                                break
                            
                            # Check if we hit a separator
                            hr = current_element.find('hr')
                            if hr:
                                break
                            
                            row_text = current_element.get_text(strip=True)
                            tds = current_element.find_all('td')
                            
                            if len(tds) >= 2:
                                label = tds[0].get_text(strip=True).lower()
                                value = tds[1].get_text(strip=True) if len(tds) > 1 else ""
                                
                                if 'amtsgericht' in label:
                                    gericht = value.replace('in Bayern', '').replace('in Baden-Württemberg', '').strip()
                                    if not gericht:
                                        gericht = f"AG {BUNDESLAENDER.get(bundesland_code, bundesland_code)}"
                                elif 'objekt' in label or 'lage' in label:
                                    objekt_lage = value
                                elif 'verkehrswert' in label:
                                    # Clean up verkehrswert
                                    vw_text = tds[1].get_text(separator=' ', strip=True)
                                    # Extract first number
                                    vw_match = re.search(r'([\d.,]+)\s*€?', vw_text)
                                    if vw_match:
                                        verkehrswert = vw_match.group(1).strip()
                                        if not '€' in verkehrswert:
                                            verkehrswert += ' €'
                                elif 'termin' in label:
                                    termin_text = value
                                
                                # Check for PDF link
                                pdf_a = current_element.find('a', href=lambda h: h and 'showAnhang' in str(h))
                                if pdf_a:
                                    pdf_link = pdf_a.get('href', '')
                                    if pdf_link and not pdf_link.startswith('http'):
                                        pdf_link = f"{base_url}/{pdf_link}"
                        
                        # Parse termin (date and time)
                        termin_datum = ""
                        termin_zeit = ""
                        if termin_text:
                            # Format: "Mittwoch, 08. April 2026, 09:30 Uhr"
                            date_match = re.search(r'(\d{1,2})\.\s*(\w+)\s*(\d{4})', termin_text)
                            time_match = re.search(r'(\d{1,2}:\d{2})\s*Uhr', termin_text)
                            
                            if date_match:
                                day = date_match.group(1)
                                month_name = date_match.group(2)
                                year = date_match.group(3)
                                
                                # Convert German month to number
                                months = {
                                    'januar': '01', 'februar': '02', 'märz': '03', 'april': '04',
                                    'mai': '05', 'juni': '06', 'juli': '07', 'august': '08',
                                    'september': '09', 'oktober': '10', 'november': '11', 'dezember': '12'
                                }
                                month = months.get(month_name.lower(), '01')
                                termin_datum = f"{day.zfill(2)}.{month}.{year}"
                            
                            if time_match:
                                termin_zeit = f"{time_match.group(1)} Uhr"
                        
                        # Parse objekt_lage to get type and address
                        objekt_typ = "Sonstiges"
                        objekt_typ_id = "18"
                        adresse = ""
                        ort = ""
                        plz = ""
                        
                        if objekt_lage:
                            # Split by ":" - usually "Type: Address"
                            parts = objekt_lage.split(':', 1)
                            if len(parts) >= 2:
                                type_part = parts[0].strip()
                                address_part = parts[1].strip()
                                
                                # Determine object type
                                for type_id, type_name in OBJEKT_TYPEN.items():
                                    if type_name.lower() in type_part.lower():
                                        objekt_typ = type_name
                                        objekt_typ_id = type_id
                                        break
                                
                                # Parse address
                                adresse = address_part
                                # Try to extract PLZ and Ort
                                plz_match = re.search(r'(\d{5})\s+(.+?)(?:,|$)', address_part)
                                if plz_match:
                                    plz = plz_match.group(1)
                                    ort = plz_match.group(2).strip()
                        
                        # Build the full link
                        full_link = href if href.startswith('http') else f"{base_url}/{href}"
                        
                        result = {
                            "aktenzeichen": aktenzeichen,
                            "gericht": gericht if gericht else f"AG {BUNDESLAENDER.get(bundesland_code, bundesland_code)}",
                            "bundesland": BUNDESLAENDER.get(bundesland_code, bundesland_code),
                            "bundesland_code": bundesland_code,
                            "termin_datum": termin_datum,
                            "termin_zeit": termin_zeit,
                            "objekt_typ": objekt_typ,
                            "objekt_typ_id": objekt_typ_id,
                            "beschreibung": objekt_lage,
                            "adresse": adresse,
                            "plz": plz,
                            "ort": ort,
                            "verkehrswert": verkehrswert,
                            "zvg_id": zvg_id,
                            "link": full_link,
                            "pdf_link": pdf_link
                        }
                        results.append(result)
                        
                    except Exception as e:
                        logger.error(f"Error parsing foreclosure: {e}")
                        continue
                
                logger.info(f"Fetched {len(results)} real foreclosures from {BUNDESLAENDER.get(bundesland_code)}")
            else:
                logger.error(f"Failed to fetch from portal: {response.status_code}")
                
    except Exception as e:
        logger.error(f"Error fetching foreclosures: {e}")
    
    return results

def generate_demo_foreclosures(bundesland_code: str) -> List[dict]:
    """Generate demo foreclosure data for testing when live data is unavailable"""
    import random
    from datetime import datetime, timedelta
    
    gerichte = {
        "bw": ["AG Stuttgart", "AG Mannheim", "AG Karlsruhe", "AG Freiburg", "AG Heidelberg"],
        "by": ["AG München", "AG Nürnberg", "AG Augsburg", "AG Würzburg", "AG Regensburg"],
        "he": ["AG Frankfurt", "AG Wiesbaden", "AG Darmstadt", "AG Kassel", "AG Offenbach"],
        "rp": ["AG Mainz", "AG Koblenz", "AG Trier", "AG Ludwigshafen", "AG Kaiserslautern"]
    }
    
    orte = {
        "bw": [("70173", "Stuttgart"), ("68159", "Mannheim"), ("76131", "Karlsruhe"), ("79098", "Freiburg")],
        "by": [("80331", "München"), ("90402", "Nürnberg"), ("86150", "Augsburg"), ("97070", "Würzburg")],
        "he": [("60311", "Frankfurt"), ("65183", "Wiesbaden"), ("64283", "Darmstadt"), ("34117", "Kassel")],
        "rp": [("55116", "Mainz"), ("56068", "Koblenz"), ("54290", "Trier"), ("67059", "Ludwigshafen")]
    }
    
    objekt_typen_demo = [
        ("3", "Einfamilienhaus", "85.000 - 350.000 €"),
        ("4", "Mehrfamilienhaus", "250.000 - 800.000 €"),
        ("5", "Eigentumswohnung (1-2 Zimmer)", "45.000 - 150.000 €"),
        ("6", "Eigentumswohnung (3-4 Zimmer)", "80.000 - 280.000 €"),
        ("8", "Gewerbeeinheit", "100.000 - 500.000 €"),
        ("15", "Baugrundstück", "50.000 - 200.000 €"),
        ("2", "Doppelhaushälfte", "120.000 - 400.000 €"),
    ]
    
    results = []
    num_entries = random.randint(3, 8)
    
    for i in range(num_entries):
        gericht = random.choice(gerichte.get(bundesland_code, ["AG Unbekannt"]))
        plz, ort = random.choice(orte.get(bundesland_code, [("00000", "Unbekannt")]))
        objekt = random.choice(objekt_typen_demo)
        
        # Generate future date
        days_ahead = random.randint(14, 90)
        termin_date = datetime.now() + timedelta(days=days_ahead)
        termin_datum = termin_date.strftime("%d.%m.%Y")
        termin_zeit = f"{random.randint(9, 14)}:{random.choice(['00', '30'])} Uhr"
        
        # Generate aktenzeichen - realistic German court format
        abt = random.randint(1, 9)
        buchstabe = random.choice(['', 'a', 'b', 'c'])
        nr = random.randint(1, 999)
        jahr = random.randint(2022, 2025)
        # Format: "007 K 0123/2024" or "3a K 45/2023"
        aktenzeichen = f"{abt:03d}{buchstabe} K {nr:04d}/{jahr}"
        
        # Generate verkehrswert
        verkehrswert_range = objekt[2]
        min_val, max_val = verkehrswert_range.replace("€", "").replace(".", "").replace(" ", "").split("-")
        verkehrswert = f"{random.randint(int(min_val), int(max_val)):,} €".replace(",", ".")
        
        # Generate unique zvg_id for link - use realistic format for ZVG portal
        zvg_id = random.randint(100000, 999999)
        
        # The actual ZVG portal link format for viewing a specific foreclosure
        # Format: index.php?button=showZvg&zvg_id=XXXXX&land_abk=XX
        portal_link = f"https://www.zvg-portal.de/index.php?button=showZvg&zvg_id={zvg_id}&land_abk={bundesland_code}"
        
        results.append({
            "aktenzeichen": aktenzeichen,
            "gericht": gericht,
            "bundesland": BUNDESLAENDER.get(bundesland_code, bundesland_code),
            "bundesland_code": bundesland_code,
            "termin_datum": termin_datum,
            "termin_zeit": termin_zeit,
            "objekt_typ": OBJEKT_TYPEN.get(objekt[0], "Sonstiges"),
            "objekt_typ_id": objekt[0],
            "beschreibung": f"{objekt[1]} in {ort}, ca. {random.randint(60, 250)} m²",
            "plz": plz,
            "ort": ort,
            "verkehrswert": verkehrswert,
            "zvg_id": str(zvg_id),
            "link": portal_link
        })
    
    return results

async def classify_foreclosure(foreclosure: dict, rules: List[dict]) -> str:
    """Classify a foreclosure based on rules"""
    objekt_typ_id = foreclosure.get("objekt_typ_id", "18")
    
    for rule in rules:
        if rule.get("active", True) and objekt_typ_id in rule.get("objekt_typ_ids", []):
            return rule.get("name", "Sonstiges")
    
    return "Sonstiges"

# ============== API ROUTES ==============

@api_router.get("/")
async def root():
    return {"message": "ZVG Portal Termin-Extraktor API"}

@api_router.get("/bundeslaender")
async def get_bundeslaender():
    """Get list of supported states"""
    return [{"code": code, "name": name} for code, name in BUNDESLAENDER.items()]

@api_router.get("/objekt-typen")
async def get_objekt_typen():
    """Get list of property types"""
    return [{"id": id, "name": name} for id, name in OBJEKT_TYPEN.items()]

# Foreclosures endpoints
@api_router.get("/foreclosures", response_model=List[ForeclosureResponse])
async def get_foreclosures(
    bundesland: Optional[str] = None,
    objekt_typ: Optional[str] = None,
    klassifizierung: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    search: Optional[str] = None
):
    """Get all foreclosures with optional filters"""
    query = {}
    
    if bundesland:
        query["bundesland_code"] = bundesland
    if objekt_typ:
        query["objekt_typ_id"] = objekt_typ
    if klassifizierung:
        query["klassifizierung"] = klassifizierung
    if search:
        query["$or"] = [
            {"aktenzeichen": {"$regex": search, "$options": "i"}},
            {"gericht": {"$regex": search, "$options": "i"}},
            {"ort": {"$regex": search, "$options": "i"}},
            {"beschreibung": {"$regex": search, "$options": "i"}}
        ]
    
    foreclosures = await db.foreclosures.find(query, {"_id": 0}).sort("termin_datum", -1).to_list(1000)
    
    # Filter by price (post-query since verkehrswert is stored as string)
    if price_min is not None or price_max is not None:
        filtered = []
        for f in foreclosures:
            if f.get('verkehrswert'):
                # Parse price from string like "123.456 €"
                try:
                    price_str = f['verkehrswert'].replace('€', '').replace('.', '').replace(',', '').strip()
                    price = int(price_str)
                    if price_min is not None and price < price_min:
                        continue
                    if price_max is not None and price > price_max:
                        continue
                    filtered.append(f)
                except:
                    filtered.append(f)  # Include if price can't be parsed
            else:
                filtered.append(f)  # Include if no price
        foreclosures = filtered
    
    # Convert datetime to string
    for f in foreclosures:
        if isinstance(f.get('created_at'), datetime):
            f['created_at'] = f['created_at'].isoformat()
        elif isinstance(f.get('created_at'), str):
            pass
        else:
            f['created_at'] = datetime.now(timezone.utc).isoformat()
    
    return foreclosures

@api_router.get("/foreclosures/{foreclosure_id}")
async def get_foreclosure(foreclosure_id: str):
    """Get a single foreclosure by ID"""
    foreclosure = await db.foreclosures.find_one({"id": foreclosure_id}, {"_id": 0})
    if not foreclosure:
        raise HTTPException(status_code=404, detail="Foreclosure not found")
    
    if isinstance(foreclosure.get('created_at'), datetime):
        foreclosure['created_at'] = foreclosure['created_at'].isoformat()
    
    return foreclosure

@api_router.post("/fetch", response_model=FetchStatus)
async def trigger_fetch(background_tasks: BackgroundTasks):
    """Trigger manual fetch of foreclosures from zvg-portal.de"""
    # Get settings
    settings = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    if not settings:
        settings = {"selected_bundeslaender": ["bw", "by", "he", "rp"]}
    
    # Get classification rules
    rules = await db.classification_rules.find({"active": True}, {"_id": 0}).to_list(100)
    if not rules:
        rules = DEFAULT_CLASSIFICATION_RULES
    
    new_count = 0
    total_count = 0
    
    for bundesland_code in settings.get("selected_bundeslaender", ["bw", "by", "he", "rp"]):
        foreclosures = await fetch_foreclosures_from_portal(bundesland_code)
        
        for f_data in foreclosures:
            total_count += 1
            
            # Check if already exists
            existing = await db.foreclosures.find_one({
                "aktenzeichen": f_data["aktenzeichen"],
                "gericht": f_data["gericht"]
            })
            
            if not existing:
                # Classify
                classification = await classify_foreclosure(f_data, rules)
                f_data["klassifizierung"] = classification
                f_data["id"] = str(uuid.uuid4())
                f_data["created_at"] = datetime.now(timezone.utc).isoformat()
                
                await db.foreclosures.insert_one(f_data)
                new_count += 1
    
    # Create notification
    if new_count > 0:
        notification = {
            "id": str(uuid.uuid4()),
            "message": f"{new_count} neue Zwangsversteigerungstermine gefunden",
            "type": "success",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        # Send email if enabled
        if settings.get("email_notifications_enabled") and settings.get("notification_email"):
            background_tasks.add_task(
                send_notification_email,
                settings["notification_email"],
                new_count
            )
    
    return FetchStatus(
        status="success",
        message=f"Datenabfrage abgeschlossen. {new_count} neue Termine gefunden.",
        new_count=new_count,
        total_count=total_count
    )

@api_router.delete("/foreclosures")
async def clear_foreclosures():
    """Clear all foreclosures"""
    await db.foreclosures.delete_many({})
    return {"status": "success", "message": "Alle Termine gelöscht"}

# Classification Rules endpoints
@api_router.get("/classification-rules", response_model=List[ClassificationRule])
async def get_classification_rules():
    """Get all classification rules"""
    rules = await db.classification_rules.find({}, {"_id": 0}).to_list(100)
    if not rules:
        # Initialize with default rules
        for rule in DEFAULT_CLASSIFICATION_RULES:
            await db.classification_rules.insert_one(rule)
        rules = DEFAULT_CLASSIFICATION_RULES
    return rules

@api_router.post("/classification-rules", response_model=ClassificationRule)
async def create_classification_rule(rule: ClassificationRuleCreate):
    """Create a new classification rule"""
    rule_dict = rule.model_dump()
    rule_dict["id"] = str(uuid.uuid4())
    await db.classification_rules.insert_one(rule_dict)
    return ClassificationRule(**rule_dict)

@api_router.put("/classification-rules/{rule_id}")
async def update_classification_rule(rule_id: str, rule: ClassificationRuleCreate):
    """Update a classification rule"""
    rule_dict = rule.model_dump()
    result = await db.classification_rules.update_one(
        {"id": rule_id},
        {"$set": rule_dict}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "success"}

@api_router.delete("/classification-rules/{rule_id}")
async def delete_classification_rule(rule_id: str):
    """Delete a classification rule"""
    result = await db.classification_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "success"}

# Settings endpoints
@api_router.get("/settings")
async def get_settings():
    """Get application settings"""
    try:
        settings = await db.settings.find_one({"id": "settings"}, {"_id": 0})
        if not settings:
            # Create default settings with all states
            default_settings = {
                "id": "settings",
                "email_notifications_enabled": False,
                "notification_email": None,
                "selected_bundeslaender": ["bw", "by", "he", "rp", "th", "sn", "nw", "ni", "st", "br", "be", "sh", "mv"]
            }
            await db.settings.insert_one(default_settings)
            return default_settings
        return settings
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        # Return defaults on error
        return {
            "id": "settings",
            "email_notifications_enabled": False,
            "notification_email": None,
            "selected_bundeslaender": ["bw", "by", "he", "rp", "th", "sn", "nw", "ni", "st", "br", "be", "sh", "mv"]
        }

@api_router.put("/settings")
async def update_settings(settings_update: SettingsUpdate):
    """Update application settings"""
    update_dict = {k: v for k, v in settings_update.model_dump().items() if v is not None}
    
    existing = await db.settings.find_one({"id": "settings"})
    if existing:
        await db.settings.update_one({"id": "settings"}, {"$set": update_dict})
    else:
        settings = Settings(**update_dict)
        await db.settings.insert_one(settings.model_dump())
    
    return await get_settings()

# Notifications endpoints
@api_router.get("/notifications")
async def get_notifications():
    """Get all notifications"""
    notifications = await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    await db.notifications.update_one({"id": notification_id}, {"$set": {"read": True}})
    return {"status": "success"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read():
    """Mark all notifications as read"""
    await db.notifications.update_many({}, {"$set": {"read": True}})
    return {"status": "success"}

@api_router.delete("/notifications")
async def clear_notifications():
    """Clear all notifications"""
    await db.notifications.delete_many({})
    return {"status": "success"}

# Email endpoints
async def send_notification_email(recipient: str, new_count: int):
    """Send email notification about new foreclosures"""
    if not resend.api_key:
        logger.warning("Resend API key not configured")
        return
    
    html_content = f"""
    <html>
    <body style="font-family: 'IBM Plex Sans', sans-serif; padding: 20px;">
        <h2 style="color: #0052FF;">Neue Zwangsversteigerungstermine</h2>
        <p>Es wurden <strong>{new_count}</strong> neue Termine gefunden.</p>
        <p>Besuchen Sie das Dashboard, um die Details anzusehen.</p>
        <hr style="border: 1px solid #E5E7EB; margin: 20px 0;">
        <p style="color: #6B7280; font-size: 12px;">ZVG Portal Termin-Extraktor</p>
    </body>
    </html>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [recipient],
        "subject": f"[ZVG-Extraktor] {new_count} neue Zwangsversteigerungstermine",
        "html": html_content
    }
    
    try:
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {recipient}")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")

@api_router.post("/test-email")
async def test_email(email: EmailRequest):
    """Test email sending"""
    if not resend.api_key:
        raise HTTPException(status_code=400, detail="Resend API key not configured")
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email.recipient_email],
        "subject": email.subject,
        "html": email.html_content
    }
    
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "success", "email_id": result.get("id")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# Statistics endpoint
@api_router.get("/statistics")
async def get_statistics():
    """Get dashboard statistics"""
    total = await db.foreclosures.count_documents({})
    
    # Count by classification
    pipeline = [
        {"$group": {"_id": "$klassifizierung", "count": {"$sum": 1}}}
    ]
    by_classification = await db.foreclosures.aggregate(pipeline).to_list(100)
    
    # Count by state
    pipeline = [
        {"$group": {"_id": "$bundesland", "count": {"$sum": 1}}}
    ]
    by_state = await db.foreclosures.aggregate(pipeline).to_list(100)
    
    return {
        "total": total,
        "by_classification": {item["_id"]: item["count"] for item in by_classification if item["_id"]},
        "by_state": {item["_id"]: item["count"] for item in by_state if item["_id"]}
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
