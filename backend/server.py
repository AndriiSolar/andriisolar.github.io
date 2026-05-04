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
    zvg_id: Optional[str] = None
    land_abk: Optional[str] = None
    pdf_doc_type: Optional[str] = None
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
    zvg_id: Optional[str] = None
    land_abk: Optional[str] = None
    pdf_doc_type: Optional[str] = None
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

DEFAULT_CLASSIFICATION_RULES = [
    {"id": "1", "name": "Wohnhäuser", "objekt_typ_ids": ["1", "2", "3", "19", "4"], "active": True},
    {"id": "2", "name": "Wohnungen", "objekt_typ_ids": ["5", "6", "7"], "active": True},
    {"id": "3", "name": "Gewerbe", "objekt_typ_ids": ["8", "13", "14"], "active": True},
    {"id": "4", "name": "Grundstücke", "objekt_typ_ids": ["15", "16", "17"], "active": True},
    {"id": "5", "name": "Stellplätze", "objekt_typ_ids": ["9", "10", "11"], "active": True},
    {"id": "6", "name": "Sonstiges", "objekt_typ_ids": ["12", "18"], "active": True},
]

# ============== ZVG PORTAL PROXY ==============

zvg_sessions = {}

async def get_zvg_session(bundesland_code: str) -> httpx.Cookies:
    """Get or create a session with ZVG portal cookies"""
    import time
    
    session_key = bundesland_code
    current_time = time.time()
    
    if session_key in zvg_sessions:
        session_data = zvg_sessions[session_key]
        if current_time - session_data['created'] < 600:  # 10 minutes
            return session_data['cookies']
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        await client.get(
            "https://www.zvg-portal.de/index.php?button=Termine%20suchen",
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
        )
        
        await client.post(
            "https://www.zvg-portal.de/index.php?button=Suchen",
            data={"land_abk": bundesland_code, "ger_id": "0", "order_by": "2"},
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Content-Type": "application/x-www-form-urlencoded",
            }
        )
        
        zvg_sessions[session_key] = {
            'cookies': client.cookies,
            'created': current_time
        }
        
        return client.cookies

@api_router.get("/zvg-redirect")
async def zvg_redirect(zvg_id: str, land_abk: str):
    from fastapi.responses import HTMLResponse
    
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
            body {{ font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f9fafb; margin: 0; }}
            .loader {{ text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
            .spinner {{ width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }}
            @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
            .countdown {{ font-size: 1.5rem; font-weight: bold; color: #3b82f6; margin: 1rem 0; }}
            a {{ color: #3b82f6; text-decoration: none; }}
        </style>
    </head>
    <body>
        <div class="loader">
            <div class="spinner"></div>
            <h2>Verbinde zum ZVG-Portal</h2>
            <p>Sichere Verbindung wird hergestellt...</p>
            <div class="countdown" id="countdown">4</div>
            <p style="font-size: 0.8rem; margin-top: 1rem; color: #6b7280;">
                <a href="{detail_url}">Klicken, falls nichts passiert</a>
            </p>
        </div>
        <iframe id="session-frame" style="display:none;" src="{search_url}"></iframe>
        <script>
            var seconds = 4;
            var countdownEl = document.getElementById('countdown');
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
    from fastapi.responses import HTMLResponse
    
    doc_urls = {
        "gutachten": f"https://www.zvg-portal.de/index.php?button=showAnhang&zvg_id={zvg_id}&land_abk={land_abk}&anhession=gutachten",
        "expose": f"https://www.zvg-portal.de/index.php?button=showAnhang&zvg_id={zvg_id}&land_abk={land_abk}&anhession=expose",
        "fotos": f"https://www.zvg-portal.de/index.php?button=showZvgFotos&zvg_id={zvg_id}&land_abk={land_abk}",
        "dokumente": f"https://www.zvg-portal.de/index.php?button=showAnhang&zvg_id={zvg_id}&land_abk={land_abk}&anhession=dokumente",
    }
    
    doc_url = doc_urls.get(doc_type, doc_urls["gutachten"])
    search_url = f"https://www.zvg-portal.de/index.php?button=Suchen&land_abk={land_abk}&ger_id=0&order_by=2"
    detail_url = f"https://www.zvg-portal.de/index.php?button=showZvg&zvg_id={zvg_id}&land_abk={land_abk}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dokument laden...</title>
        <style>
            body {{ font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f9fafb; margin: 0; }}
            .loader {{ text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
            .spinner {{ width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #ef4444; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }}
            @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
            .countdown {{ font-size: 1.5rem; font-weight: bold; color: #ef4444; margin: 1rem 0; }}
            a {{ color: #3b82f6; text-decoration: none; }}
        </style>
    </head>
    <body>
        <div class="loader">
            <div class="spinner"></div>
            <h2>Dokument wird geladen</h2>
            <p>Session wird aufgebaut...</p>
            <div class="countdown" id="countdown">6</div>
            <p style="font-size: 0.8rem; margin-top: 1rem; color: #6b7280;">
                <a href="{doc_url}">Klicken, falls nichts passiert</a>
            </p>
        </div>
        <iframe id="session-frame-1" style="display:none;" src="{search_url}"></iframe>
        <iframe id="session-frame-2" style="display:none;"></iframe>
        <script>
            var seconds = 6;
            var countdownEl = document.getElementById('countdown');
            var step = 0;
            
            document.getElementById('session-frame-1').onload = function() {{
                if (step === 0) {{
                    step = 1;
                    document.getElementById('session-frame-2').src = "{detail_url}";
                }}
            }};
            
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

# ============== DATA FETCHING ==============

async def fetch_foreclosures_from_portal(bundesland_code: str) -> List[dict]:
    results = []
    base_url = "https://www.zvg-portal.de"
    
    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as http_client:
            search_data = {
                "land_abk": bundesland_code,
                "ger_id": "0",
                "order_by": "2"
            }
            
            response = await http_client.post(
                f"{base_url}/index.php?button=Suchen",
                data=search_data,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Content-Type": "application/x-www-form-urlencoded",
                }
            )
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'lxml')
                detail_links = soup.find_all('a', href=lambda h: h and 'showZvg' in str(h) and 'zvg_id' in str(h))
                
                for link in detail_links:
                    try:
                        href = link.get('href', '')
                        
                        zvg_id_match = re.search(r'zvg_id=(\d+)', href)
                        if not zvg_id_match: continue
                        zvg_id = zvg_id_match.group(1)
                        
                        aktenzeichen_text = link.get_text(strip=True)
                        aktenzeichen = aktenzeichen_text.replace('(Detailansicht)', '').strip()
                        
                        parent_row = link.find_parent('tr')
                        if not parent_row: continue
                        
                        current_element = parent_row
                        gericht = ""
                        objekt_lage = ""
                        verkehrswert = ""
                        termin_text = ""
                        pdf_link = ""
                        
                        while current_element:
                            current_element = current_element.find_next_sibling('tr')
                            if not current_element: break
                            if current_element.find('hr'): break
                            
                            tds = current_element.find_all('td')
                            if len(tds) >= 2:
                                label = tds[0].get_text(strip=True).lower()
                                value = tds[1].get_text(strip=True) if len(tds) > 1 else ""
                                
                                if 'amtsgericht' in label:
                                    gericht = value.replace('in Bayern', '').replace('in Baden-Württemberg', '').strip()
                                    if not gericht: gericht = f"AG {BUNDESLAENDER.get(bundesland_code, bundesland_code)}"
                                elif 'objekt' in label or 'lage' in label:
                                    objekt_lage = value
                                elif 'verkehrswert' in label:
                                    vw_text = tds[1].get_text(separator=' ', strip=True)
                                    vw_match = re.search(r'([\d.,]+)\s*€?', vw_text)
                                    if vw_match:
                                        verkehrswert = vw_match.group(1).strip()
                                        if not '€' in verkehrswert: verkehrswert += ' €'
                                elif 'termin' in label:
                                    termin_text = value
                                
                                pdf_a = current_element.find('a', href=lambda h: h and ('showAnhang' in str(h) or 'showZvgFotos' in str(h)))
                                if pdf_a:
                                    raw_pdf_href = pdf_a.get('href', '')
                                    doc_type = "gutachten"
                                    if "expose" in raw_pdf_href.lower(): doc_type = "expose"
                                    elif "fotos" in raw_pdf_href.lower() or "showzvgfotos" in raw_pdf_href.lower(): doc_type = "fotos"
                                    elif "dokumente" in raw_pdf_href.lower(): doc_type = "dokumente"
                                    
                                    # Store doc_type for frontend to generate URL
                                    pdf_link = doc_type
                        
                        termin_datum = ""
                        termin_zeit = ""
                        if termin_text:
                            date_match = re.search(r'(\d{1,2})\.\s*(\w+)\s*(\d{4})', termin_text)
                            time_match = re.search(r'(\d{1,2}:\d{2})\s*Uhr', termin_text)
                            if date_match:
                                months = {'januar': '01', 'februar': '02', 'märz': '03', 'april': '04', 'mai': '05', 'juni': '06', 'juli': '07', 'august': '08', 'september': '09', 'oktober': '10', 'november': '11', 'dezember': '12'}
                                termin_datum = f"{date_match.group(1).zfill(2)}.{months.get(date_match.group(2).lower(), '01')}.{date_match.group(3)}"
                            if time_match:
                                termin_zeit = f"{time_match.group(1)} Uhr"
                        
                        objekt_typ, objekt_typ_id, adresse, ort, plz = "Sonstiges", "18", "", "", ""
                        if objekt_lage:
                            parts = objekt_lage.split(':', 1)
                            if len(parts) >= 2:
                                for t_id, t_name in OBJEKT_TYPEN.items():
                                    if t_name.lower() in parts[0].lower():
                                        objekt_typ, objekt_typ_id = t_name, t_id
                                        break
                                adresse = parts[1].strip()
                                plz_match = re.search(r'(\d{5})\s+(.+?)(?:,|$)', adresse)
                                if plz_match:
                                    plz, ort = plz_match.group(1), plz_match.group(2).strip()
                        
                        # Store zvg_id and land_abk - frontend generates full URLs
                        results.append({
                            "aktenzeichen": aktenzeichen,
                            "gericht": gericht,
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
                            "land_abk": bundesland_code,
                            "pdf_doc_type": pdf_link
                        })
                    except Exception as e:
                        logger.error(f"Error parsing foreclosure: {e}")
                        continue
            else:
                logger.error(f"Failed to fetch: {response.status_code}")
    except Exception as e:
        logger.error(f"Error fetching: {e}")
    return results

def generate_demo_foreclosures(bundesland_code: str) -> List[dict]:
    import random
    from datetime import datetime, timedelta
    
    results = []
    num_entries = random.randint(3, 8)
    
    for i in range(num_entries):
        zvg_id = random.randint(100000, 999999)
        
        results.append({
            "aktenzeichen": f"00{random.randint(1,9)} K {random.randint(1,999):04d}/2024",
            "gericht": f"AG {BUNDESLAENDER.get(bundesland_code, bundesland_code)}",
            "bundesland": BUNDESLAENDER.get(bundesland_code, bundesland_code),
            "bundesland_code": bundesland_code,
            "termin_datum": (datetime.now() + timedelta(days=random.randint(14, 90))).strftime("%d.%m.%Y"),
            "termin_zeit": "10:00 Uhr",
            "objekt_typ": "Einfamilienhaus",
            "objekt_typ_id": "3",
            "beschreibung": "Demo Objekt",
            "plz": "12345",
            "ort": "Musterstadt",
            "verkehrswert": "250.000 €",
            "zvg_id": str(zvg_id),
            "land_abk": bundesland_code,
            "pdf_doc_type": "gutachten"
        })
    return results

async def classify_foreclosure(foreclosure: dict, rules: List[dict]) -> str:
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
    return [{"code": code, "name": name} for code, name in BUNDESLAENDER.items()]

@api_router.get("/objekt-typen")
async def get_objekt_typen():
    return [{"id": id, "name": name} for id, name in OBJEKT_TYPEN.items()]

@api_router.get("/foreclosures", response_model=List[ForeclosureResponse])
async def get_foreclosures(
    bundesland: Optional[str] = None, objekt_typ: Optional[str] = None,
    klassifizierung: Optional[str] = None, date_from: Optional[str] = None,
    date_to: Optional[str] = None, price_min: Optional[int] = None,
    price_max: Optional[int] = None, search: Optional[str] = None
):
    query = {}
    if bundesland: query["bundesland_code"] = bundesland
    if objekt_typ: query["objekt_typ_id"] = objekt_typ
    if klassifizierung: query["klassifizierung"] = klassifizierung
    if search:
        query["$or"] = [
            {"aktenzeichen": {"$regex": search, "$options": "i"}},
            {"gericht": {"$regex": search, "$options": "i"}},
            {"ort": {"$regex": search, "$options": "i"}},
            {"beschreibung": {"$regex": search, "$options": "i"}}
        ]
    
    foreclosures = await db.foreclosures.find(query, {"_id": 0}).sort("termin_datum", -1).to_list(1000)
    
    if price_min is not None or price_max is not None:
        filtered = []
        for f in foreclosures:
            if f.get('verkehrswert'):
                try:
                    price_str = f['verkehrswert'].replace('€', '').replace('.', '').replace(',', '').strip()
                    price = int(price_str)
                    if price_min is not None and price < price_min: continue
                    if price_max is not None and price > price_max: continue
                    filtered.append(f)
                except: filtered.append(f)
            else: filtered.append(f)
        foreclosures = filtered
    
    for f in foreclosures:
        if isinstance(f.get('created_at'), datetime):
            f['created_at'] = f['created_at'].isoformat()
        elif not isinstance(f.get('created_at'), str):
            f['created_at'] = datetime.now(timezone.utc).isoformat()
            
    return foreclosures

@api_router.get("/foreclosures/{foreclosure_id}")
async def get_foreclosure(foreclosure_id: str):
    foreclosure = await db.foreclosures.find_one({"id": foreclosure_id}, {"_id": 0})
    if not foreclosure: raise HTTPException(status_code=404, detail="Foreclosure not found")
    if isinstance(foreclosure.get('created_at'), datetime):
        foreclosure['created_at'] = foreclosure['created_at'].isoformat()
    return foreclosure

@api_router.post("/fetch", response_model=FetchStatus)
async def trigger_fetch(background_tasks: BackgroundTasks):
    settings = await db.settings.find_one({"id": "settings"}, {"_id": 0}) or {"selected_bundeslaender": ["bw", "by", "he", "rp"]}
    rules = await db.classification_rules.find({"active": True}, {"_id": 0}).to_list(100) or DEFAULT_CLASSIFICATION_RULES
    
    new_count = 0
    total_count = 0
    
    for bundesland_code in settings.get("selected_bundeslaender", ["bw", "by", "he", "rp"]):
        foreclosures = await fetch_foreclosures_from_portal(bundesland_code)
        
        for f_data in foreclosures:
            total_count += 1
            existing = await db.foreclosures.find_one({"aktenzeichen": f_data["aktenzeichen"], "gericht": f_data["gericht"]})
            
            if not existing:
                f_data["klassifizierung"] = await classify_foreclosure(f_data, rules)
                f_data["id"] = str(uuid.uuid4())
                f_data["created_at"] = datetime.now(timezone.utc).isoformat()
                await db.foreclosures.insert_one(f_data)
                new_count += 1
    
    if new_count > 0:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "message": f"{new_count} neue Zwangsversteigerungstermine gefunden",
            "type": "success", "read": False, "created_at": datetime.now(timezone.utc).isoformat()
        })
        if settings.get("email_notifications_enabled") and settings.get("notification_email"):
            background_tasks.add_task(send_notification_email, settings["notification_email"], new_count)
            
    return FetchStatus(status="success", message=f"Abgeschlossen. {new_count} neue Termine.", new_count=new_count, total_count=total_count)

@api_router.delete("/foreclosures")
async def clear_foreclosures():
    await db.foreclosures.delete_many({})
    return {"status": "success", "message": "Alle Termine gelöscht"}

@api_router.get("/classification-rules", response_model=List[ClassificationRule])
async def get_classification_rules():
    rules = await db.classification_rules.find({}, {"_id": 0}).to_list(100)
    if not rules:
        await db.classification_rules.insert_many(DEFAULT_CLASSIFICATION_RULES)
        rules = DEFAULT_CLASSIFICATION_RULES
    return rules

@api_router.post("/classification-rules", response_model=ClassificationRule)
async def create_classification_rule(rule: ClassificationRuleCreate):
    rule_dict = rule.model_dump()
    rule_dict["id"] = str(uuid.uuid4())
    await db.classification_rules.insert_one(rule_dict)
    return ClassificationRule(**rule_dict)

@api_router.put("/classification-rules/{rule_id}")
async def update_classification_rule(rule_id: str, rule: ClassificationRuleCreate):
    result = await db.classification_rules.update_one({"id": rule_id}, {"$set": rule.model_dump()})
    if result.modified_count == 0: raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "success"}

@api_router.delete("/classification-rules/{rule_id}")
async def delete_classification_rule(rule_id: str):
    result = await db.classification_rules.delete_one({"id": rule_id})
    if result.deleted_count == 0: raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "success"}

@api_router.get("/settings")
async def get_settings():
    settings = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    if not settings:
        settings = {"id": "settings", "email_notifications_enabled": False, "notification_email": None, "selected_bundeslaender": ["bw", "by", "he", "rp", "th", "sn", "nw", "ni", "st", "br", "be", "sh", "mv"]}
        await db.settings.insert_one(settings)
    return settings

@api_router.put("/settings")
async def update_settings(settings_update: SettingsUpdate):
    update_dict = {k: v for k, v in settings_update.model_dump().items() if v is not None}
    existing = await db.settings.find_one({"id": "settings"})
    if existing: await db.settings.update_one({"id": "settings"}, {"$set": update_dict})
    else: await db.settings.insert_one(Settings(**update_dict).model_dump())
    return await get_settings()

@api_router.get("/notifications")
async def get_notifications():
    return await db.notifications.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    await db.notifications.update_one({"id": notification_id}, {"$set": {"read": True}})
    return {"status": "success"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read():
    await db.notifications.update_many({}, {"$set": {"read": True}})
    return {"status": "success"}

@api_router.delete("/notifications")
async def clear_notifications():
    await db.notifications.delete_many({})
    return {"status": "success"}

async def send_notification_email(recipient: str, new_count: int):
    if not resend.api_key: return
    html_content = f"<html><body><h2>Neue Termine</h2><p>{new_count} neue Termine gefunden.</p></body></html>"
    try: await asyncio.to_thread(resend.Emails.send, {"from": SENDER_EMAIL, "to": [recipient], "subject": f"{new_count} neue Termine", "html": html_content})
    except Exception as e: logger.error(f"Failed to send email: {e}")

@api_router.get("/statistics")
async def get_statistics():
    total = await db.foreclosures.count_documents({})
    by_classification = await db.foreclosures.aggregate([{"$group": {"_id": "$klassifizierung", "count": {"$sum": 1}}}]).to_list(100)
    by_state = await db.foreclosures.aggregate([{"$group": {"_id": "$bundesland", "count": {"$sum": 1}}}]).to_list(100)
    return {"total": total, "by_classification": {item["_id"]: item["count"] for item in by_classification if item["_id"]}, "by_state": {item["_id"]: item["count"] for item in by_state if item["_id"]}}

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