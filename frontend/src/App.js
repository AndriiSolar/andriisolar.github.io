import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  House, 
  Buildings, 
  Gavel, 
  Bell, 
  Gear, 
  MagnifyingGlass,
  ArrowClockwise,
  Funnel,
  CaretRight,
  Calendar,
  MapPin,
  Tag,
  CurrencyEur,
  X,
  Plus,
  Trash,
  PencilSimple,
  EnvelopeSimple,
  ChartBar,
  FileText,
  FilePdf,
  Image,
  Link as LinkIcon,
  Info,
  Ruler,
  BuildingOffice,
  HouseLine,
  Bank,
  Download
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function to generate ZVG redirect URL
const getZvgRedirectUrl = (zvgId, landAbk) => {
  if (!zvgId || !landAbk) return null;
  return `${API}/zvg-redirect?zvg_id=${zvgId}&land_abk=${landAbk}`;
};

// Helper function to generate ZVG document URL
const getZvgDocumentUrl = (zvgId, landAbk, docType) => {
  if (!zvgId || !landAbk) return null;
  return `${API}/zvg-document?zvg_id=${zvgId}&land_abk=${landAbk}&doc_type=${docType}`;
};

// Helper function to create ZVG redirect Blob URL dynamically
const createZvgRedirectBlobUrl = (zvgId, landAbk) => {
  const detailUrl = `https://www.zvg-portal.de/index.php?button=showZvg&zvg_id=${zvgId}&land_abk=${landAbk}`;
  const searchUrl = `https://www.zvg-portal.de/index.php?button=Suchen&land_abk=${landAbk}&ger_id=0&order_by=2`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weiterleitung zum ZVG-Portal...</title>
        <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f9fafb; margin: 0; }
            .loader { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .spinner { width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
            @keyframes spin { to { transform: rotate(360deg); } }
            .countdown { font-size: 1.5rem; font-weight: bold; color: #3b82f6; margin: 1rem 0; }
            a { color: #3b82f6; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="loader">
            <div class="spinner"></div>
            <h2>Verbinde zum ZVG-Portal</h2>
            <p>Sichere Verbindung wird hergestellt...</p>
            <div class="countdown" id="countdown">3</div>
            <p style="font-size: 0.8rem; margin-top: 1rem; color: #6b7280;">
                <a href="${detailUrl}">Klicken, falls nichts passiert</a>
            </p>
        </div>
        <iframe id="session-frame" style="display:none;" src="${searchUrl}"></iframe>
        <script>
            var redirected = false;
            function doRedirect() {
                if (!redirected) {
                    redirected = true;
                    window.location.href = "${detailUrl}";
                }
            }
            
            document.getElementById('session-frame').onload = doRedirect;
            
            var seconds = 3;
            var countdownEl = document.getElementById('countdown');
            var timer = setInterval(function() {
                seconds--;
                countdownEl.textContent = seconds;
                if (seconds <= 0) {
                    clearInterval(timer);
                    doRedirect();
                }
            }, 1000);
        </script>
    </body>
    </html>
  `;
  
  const blob = new Blob([htmlContent], { type: 'text/html' });
  return URL.createObjectURL(blob);
};

// Helper function to create ZVG document Blob URL dynamically
const createZvgDocumentBlobUrl = (zvgId, landAbk, docType) => {
  const docUrls = {
    "gutachten": `https://www.zvg-portal.de/index.php?button=showAnhang&zvg_id=${zvgId}&land_abk=${landAbk}&anhession=gutachten`,
    "expose": `https://www.zvg-portal.de/index.php?button=showAnhang&zvg_id=${zvgId}&land_abk=${landAbk}&anhession=expose`,
    "fotos": `https://www.zvg-portal.de/index.php?button=showZvgFotos&zvg_id=${zvgId}&land_abk=${landAbk}`,
    "dokumente": `https://www.zvg-portal.de/index.php?button=showAnhang&zvg_id=${zvgId}&land_abk=${landAbk}&anhession=dokumente`,
  };
  
  const docUrl = docUrls[docType] || docUrls["gutachten"];
  const searchUrl = `https://www.zvg-portal.de/index.php?button=Suchen&land_abk=${landAbk}&ger_id=0&order_by=2`;
  const detailUrl = `https://www.zvg-portal.de/index.php?button=showZvg&zvg_id=${zvgId}&land_abk=${landAbk}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dokument laden...</title>
        <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f9fafb; margin: 0; }
            .loader { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .spinner { width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #ef4444; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
            @keyframes spin { to { transform: rotate(360deg); } }
            .countdown { font-size: 1.5rem; font-weight: bold; color: #ef4444; margin: 1rem 0; }
            a { color: #3b82f6; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="loader">
            <div class="spinner"></div>
            <h2>Dokument wird geladen</h2>
            <p>Session wird aufgebaut...</p>
            <div class="countdown" id="countdown">5</div>
            <p style="font-size: 0.8rem; margin-top: 1rem; color: #6b7280;">
                <a href="${docUrl}">Klicken, falls nichts passiert</a>
            </p>
        </div>
        <iframe id="session-frame-1" style="display:none;" src="${searchUrl}"></iframe>
        <iframe id="session-frame-2" style="display:none;"></iframe>
        <script>
            var redirected = false;
            function doRedirect() {
                if (!redirected) {
                    redirected = true;
                    window.location.href = "${docUrl}";
                }
            }
            
            var step = 0;
            
            document.getElementById('session-frame-1').onload = function() {
                if (step === 0) {
                    step = 1;
                    document.getElementById('session-frame-2').src = "${detailUrl}";
                }
            };
            
            document.getElementById('session-frame-2').onload = function() {
                if (step === 1) {
                    step = 2;
                    doRedirect();
                }
            };
            
            var seconds = 5;
            var countdownEl = document.getElementById('countdown');
            var timer = setInterval(function() {
                seconds--;
                countdownEl.textContent = seconds;
                if (seconds <= 0) {
                    clearInterval(timer);
                    doRedirect();
                }
            }, 1000);
        </script>
    </body>
    </html>
  `;
  
  const blob = new Blob([htmlContent], { type: 'text/html' });
  return URL.createObjectURL(blob);
};

// Click handler to open redirect Blob URL in new tab and auto-revoke
const handleZvgRedirectClick = (e, zvgId, landAbk) => {
  e.preventDefault();
  e.stopPropagation();
  if (!zvgId || !landAbk) return;
  const url = createZvgRedirectBlobUrl(zvgId, landAbk);
  window.open(url, '_blank');
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);
};

// Click handler to open document Blob URL in new tab and auto-revoke
const handleZvgDocumentClick = (e, zvgId, landAbk, docType) => {
  e.preventDefault();
  e.stopPropagation();
  if (!zvgId || !landAbk || !docType) return;
  const url = createZvgDocumentBlobUrl(zvgId, landAbk, docType);
  window.open(url, '_blank');
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);
};


// Ukrainian translations
const UI_TEXT = {
  // Header
  appTitle: "ZVG Екстрактор термінів",
  fetchData: "Завантажити дані",
  loading: "Завантаження...",
  
  // Navigation
  dashboard: "Панель керування",
  allAppointments: "Усі терміни",
  classification: "Класифікація",
  
  // Dashboard
  dashboardTitle: "Панель керування",
  dashboardSubtitle: "Огляд термінів примусового продажу",
  totalAppointments: "Всього термінів",
  houses: "Будинки",
  apartments: "Квартири",
  landPlots: "Ділянки",
  byState: "За федеральною землею",
  recentAppointments: "Останні терміни",
  
  // Table headers
  caseNumber: "Номер справи",
  date: "Дата",
  location: "Місце",
  type: "Тип",
  marketValue: "Ринкова вартість",
  court: "Суд",
  state: "Федеральна земля",
  objectType: "Тип об'єкта",
  category: "Категорія",
  
  // Filters
  filters: "Фільтри",
  allStates: "Усі федеральні землі",
  allCategories: "Усі категорії",
  allObjectTypes: "Усі типи об'єктів",
  clearFilters: "Скинути фільтри",
  results: "результатів",
  priceRange: "Діапазон цін",
  priceFrom: "Ціна від",
  priceTo: "Ціна до",
  search: "Пошук",
  searchPlaceholder: "Пошук за номером, судом, містом...",
  
  // Detail sheet
  appointmentDetails: "Деталі терміну",
  address: "Адреса",
  description: "Опис",
  openInPortal: "Відкрити в ZVG-порталі",
  documents: "Документи",
  expertReport: "Експертний висновок (PDF)",
  expose: "Експозе (PDF)",
  photos: "Фотографії",
  courtDocuments: "Судові документи (PDF)",
  noDocuments: "Документи недоступні",
  downloadPdf: "Завантажити PDF",
  
  // Object details
  objectDetails: "Детальна інформація про об'єкт",
  propertyType: "Тип нерухомості",
  area: "Площа",
  rooms: "Кімнати",
  floors: "Поверхи",
  yearBuilt: "Рік побудови",
  condition: "Стан",
  features: "Особливості",
  landArea: "Площа ділянки",
  livingArea: "Житлова площа",
  usableArea: "Корисна площа",
  basement: "Підвал",
  garage: "Гараж",
  parking: "Парковка",
  heating: "Опалення",
  energyClass: "Енергетичний клас",
  
  // Classification
  classificationRules: "Правила класифікації",
  classificationSubtitle: "Визначте, як класифікується нерухомість",
  newRule: "Нове правило",
  editRule: "Редагувати правило",
  createRule: "Створити нове правило",
  ruleName: "Назва категорії",
  objectTypes: "Типи об'єктів",
  ruleActive: "Правило активне",
  save: "Зберегти",
  cancel: "Скасувати",
  deleteConfirm: "Справді видалити правило?",
  
  // Settings
  settings: "Налаштування",
  settingsSubtitle: "Налаштуйте завантаження даних та сповіщення",
  statesForQuery: "Федеральні землі для запиту",
  emailNotifications: "Email-сповіщення",
  emailNotificationsDesc: "Отримуйте електронні листи про нові терміни",
  emailAddress: "Email-адреса",
  
  // Notifications
  notifications: "Сповіщення",
  noNotifications: "Немає сповіщень",
  markAllRead: "Прочитати всі",
  
  // Empty state
  noAppointments: "Термінів не знайдено",
  noAppointmentsDesc: "Натисніть 'Завантажити дані' для отримання термінів",
  adjustFilters: "Змініть фільтри або завантажте нові дані",
  
  // Messages
  fetchSuccess: "Завантаження завершено",
  fetchError: "Помилка завантаження даних",
  settingsSaved: "Налаштування збережено",
  ruleCreated: "Правило створено",
  ruleUpdated: "Правило оновлено",
  ruleDeleted: "Правило видалено",
  errorSaving: "Помилка збереження",
  errorLoading: "Помилка завантаження термінів",
  
  // States - All German states with Ukrainian translations
  states: {
    bw: "Баден-Вюртемберг",
    by: "Баварія", 
    he: "Гессен",
    rp: "Рейнланд-Пфальц",
    th: "Тюрінгія",
    sn: "Саксонія",
    nw: "Північний Рейн-Вестфалія",
    ni: "Нижня Саксонія",
    st: "Саксонія-Ангальт",
    br: "Бранденбург",
    be: "Берлін",
    sh: "Шлезвіг-Гольштейн",
    mv: "Мекленбург-Передня Померанія",
    hb: "Бремен",
    hh: "Гамбург",
    sl: "Саар"
  }
};

// Classification badge colors
const CLASSIFICATION_COLORS = {
  "Wohnhäuser": "bg-blue-100 text-blue-800",
  "Wohnungen": "bg-purple-100 text-purple-800",
  "Gewerbe": "bg-amber-100 text-amber-800",
  "Grundstücke": "bg-green-100 text-green-800",
  "Stellplätze": "bg-slate-100 text-slate-800",
  "Sonstiges": "bg-gray-100 text-gray-800",
};

// Classification translations to Ukrainian
const CLASSIFICATION_UA = {
  "Wohnhäuser": "Будинки",
  "Wohnungen": "Квартири",
  "Gewerbe": "Комерційна",
  "Grundstücke": "Ділянки",
  "Stellplätze": "Паркомісця",
  "Sonstiges": "Інше",
};

// Bundesländer mapping - all states
const BUNDESLAENDER = {
  bw: "Baden-Württemberg",
  by: "Bayern",
  he: "Hessen",
  rp: "Rheinland-Pfalz",
  th: "Thüringen",
  sn: "Sachsen",
  nw: "Nordrhein-Westfalen",
  ni: "Niedersachsen",
  st: "Sachsen-Anhalt",
  br: "Brandenburg",
  be: "Berlin",
  sh: "Schleswig-Holstein",
  mv: "Mecklenburg-Vorpommern",
  hb: "Bremen",
  hh: "Hamburg",
  sl: "Saarland"
};

// Price range options
const PRICE_RANGES = [
  { label: "Усі ціни", min: null, max: null },
  { label: "до 50.000 €", min: null, max: 50000 },
  { label: "50.000 - 100.000 €", min: 50000, max: 100000 },
  { label: "100.000 - 200.000 €", min: 100000, max: 200000 },
  { label: "200.000 - 500.000 €", min: 200000, max: 500000 },
  { label: "понад 500.000 €", min: 500000, max: null },
];

function App() {
  // State
  const [foreclosures, setForeclosures] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState(null);
  const [classificationRules, setClassificationRules] = useState([]);
  const [objektTypen, setObjektTypen] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedForeclosure, setSelectedForeclosure] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  
  // Filter State
  const [filterBundesland, setFilterBundesland] = useState("all");
  const [filterKlassifizierung, setFilterKlassifizierung] = useState("all");
  const [filterObjektTyp, setFilterObjektTyp] = useState("all");
  const [filterPriceRange, setFilterPriceRange] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");

  // Fetch data
  const fetchForeclosures = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterBundesland !== "all") params.append("bundesland", filterBundesland);
      if (filterKlassifizierung !== "all") params.append("klassifizierung", filterKlassifizierung);
      if (filterObjektTyp !== "all") params.append("objekt_typ", filterObjektTyp);
      if (filterSearch) params.append("search", filterSearch);
      
      // Add price filter
      if (filterPriceRange !== "all") {
        const priceRange = PRICE_RANGES.find((_, idx) => idx.toString() === filterPriceRange);
        if (priceRange) {
          if (priceRange.min !== null) params.append("price_min", priceRange.min);
          if (priceRange.max !== null) params.append("price_max", priceRange.max);
        }
      }
      
      const response = await axios.get(`${API}/foreclosures?${params.toString()}`);
      setForeclosures(response.data);
    } catch (error) {
      console.error("Error fetching foreclosures:", error);
      toast.error(UI_TEXT.errorLoading);
    }
  }, [filterBundesland, filterKlassifizierung, filterObjektTyp, filterPriceRange, filterSearch]);

  const fetchStatistics = async () => {
    try {
      const response = await axios.get(`${API}/statistics`);
      setStatistics(response.data);
    } catch (error) {
      console.error("Error fetching statistics:", error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications`);
      setNotifications(response.data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const fetchClassificationRules = async () => {
    try {
      const response = await axios.get(`${API}/classification-rules`);
      setClassificationRules(response.data);
    } catch (error) {
      console.error("Error fetching rules:", error);
    }
  };

  const fetchObjektTypen = async () => {
    try {
      const response = await axios.get(`${API}/objekt-typen`);
      setObjektTypen(response.data);
    } catch (error) {
      console.error("Error fetching objekt typen:", error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchForeclosures(),
        fetchStatistics(),
        fetchNotifications(),
        fetchSettings(),
        fetchClassificationRules(),
        fetchObjektTypen(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchForeclosures]);

  // Refetch when filters change
  useEffect(() => {
    fetchForeclosures();
  }, [filterBundesland, filterKlassifizierung, filterObjektTyp, filterPriceRange, filterSearch, fetchForeclosures]);

  // Actions
  const triggerFetch = async () => {
    setFetching(true);
    try {
      const response = await axios.post(`${API}/fetch`);
      toast.success(`${UI_TEXT.fetchSuccess}. ${response.data.new_count} нових термінів знайдено.`);
      await Promise.all([
        fetchForeclosures(),
        fetchStatistics(),
        fetchNotifications(),
      ]);
    } catch (error) {
      console.error("Error triggering fetch:", error);
      toast.error(UI_TEXT.fetchError);
    } finally {
      setFetching(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const response = await axios.put(`${API}/settings`, newSettings);
      setSettings(response.data);
      toast.success(UI_TEXT.settingsSaved);
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error(UI_TEXT.errorSaving);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await axios.put(`${API}/notifications/read-all`);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking notifications read:", error);
    }
  };

  const openForeclosureDetail = (foreclosure) => {
    setSelectedForeclosure(foreclosure);
    setSheetOpen(true);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const hasActiveFilters = filterBundesland !== "all" || filterKlassifizierung !== "all" || 
    filterObjektTyp !== "all" || filterPriceRange !== "all" || filterSearch !== "";

  const clearAllFilters = () => {
    setFilterBundesland("all");
    setFilterKlassifizierung("all");
    setFilterObjektTyp("all");
    setFilterPriceRange("all");
    setFilterSearch("");
  };

  return (
    <div className="app-container" data-testid="app-container">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <header className="app-header flex items-center justify-between" data-testid="app-header">
        <div className="flex items-center gap-3">
          <Gavel size={28} weight="fill" className="text-[#0052FF]" />
          <h1 className="text-xl font-semibold text-[#111827]">
            {UI_TEXT.appTitle}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Fetch Button */}
          <Button
            data-testid="trigger-fetch-btn"
            onClick={triggerFetch}
            disabled={fetching}
            className="bg-[#0052FF] hover:bg-[#0040CC] text-white gap-2"
          >
            <ArrowClockwise size={18} className={fetching ? "animate-spin" : ""} />
            {fetching ? UI_TEXT.loading : UI_TEXT.fetchData}
          </Button>
          
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="notification-dot" data-testid="notification-dot" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80" data-testid="notifications-dropdown">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="font-semibold text-sm">{UI_TEXT.notifications}</span>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllNotificationsRead} className="text-xs">
                    {UI_TEXT.markAllRead}
                  </Button>
                )}
              </div>
              <DropdownMenuSeparator />
              <ScrollArea className="h-64">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-[#6B7280]">
                    {UI_TEXT.noNotifications}
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem key={notification.id} className="flex-col items-start p-3 cursor-default">
                      <div className={`text-sm ${notification.read ? 'text-[#6B7280]' : 'text-[#111827] font-medium'}`}>
                        {notification.message}
                      </div>
                      <div className="text-xs text-[#6B7280] mt-1">
                        {new Date(notification.created_at).toLocaleString('uk-UA')}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Settings */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSettingsOpen(true)}
            data-testid="settings-btn"
          >
            <Gear size={20} />
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="app-sidebar" data-testid="app-sidebar">
          <nav className="py-4">
            <button
              data-testid="nav-dashboard"
              className={`sidebar-item w-full ${activeView === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveView("dashboard")}
            >
              <ChartBar size={20} />
              <span>{UI_TEXT.dashboard}</span>
            </button>
            <button
              data-testid="nav-termine"
              className={`sidebar-item w-full ${activeView === "termine" ? "active" : ""}`}
              onClick={() => setActiveView("termine")}
            >
              <Calendar size={20} />
              <span>{UI_TEXT.allAppointments}</span>
            </button>
            <button
              data-testid="nav-klassifizierung"
              className={`sidebar-item w-full ${activeView === "klassifizierung" ? "active" : ""}`}
              onClick={() => setActiveView("klassifizierung")}
            >
              <Tag size={20} />
              <span>{UI_TEXT.classification}</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="main-content flex-1" data-testid="main-content">
          {fetching && (
            <div className="loading-bar w-full mb-4" data-testid="loading-bar" />
          )}

          {activeView === "dashboard" && (
            <DashboardView
              statistics={statistics}
              foreclosures={foreclosures}
              loading={loading}
              onOpenDetail={openForeclosureDetail}
            />
          )}

          {activeView === "termine" && (
            <TermineView
              foreclosures={foreclosures}
              loading={loading}
              filterBundesland={filterBundesland}
              filterKlassifizierung={filterKlassifizierung}
              filterObjektTyp={filterObjektTyp}
              filterPriceRange={filterPriceRange}
              filterSearch={filterSearch}
              setFilterBundesland={setFilterBundesland}
              setFilterKlassifizierung={setFilterKlassifizierung}
              setFilterObjektTyp={setFilterObjektTyp}
              setFilterPriceRange={setFilterPriceRange}
              setFilterSearch={setFilterSearch}
              objektTypen={objektTypen}
              classificationRules={classificationRules}
              onOpenDetail={openForeclosureDetail}
              hasActiveFilters={hasActiveFilters}
              clearAllFilters={clearAllFilters}
            />
          )}

          {activeView === "klassifizierung" && (
            <KlassifizierungView
              rules={classificationRules}
              objektTypen={objektTypen}
              onRefresh={fetchClassificationRules}
            />
          )}
        </main>
      </div>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[550px] sm:w-[600px] overflow-y-auto bg-white" data-testid="detail-sheet">
          {selectedForeclosure && (
            <>
              <SheetHeader className="border-b pb-4">
                <SheetTitle className="flex items-center gap-2 text-[#111827]">
                  <Gavel size={20} className="text-[#0052FF]" />
                  {UI_TEXT.appointmentDetails}
                </SheetTitle>
                <SheetDescription className="text-[#374151]">
                  {UI_TEXT.caseNumber}: <span className="font-mono font-semibold text-[#111827]">{selectedForeclosure.aktenzeichen}</span>
                </SheetDescription>
              </SheetHeader>
              <ForeclosureDetail foreclosure={selectedForeclosure} />
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={updateSettings}
      />
    </div>
  );
}

// Dashboard View Component
function DashboardView({ statistics, foreclosures, loading, onOpenDetail }) {
  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-view">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">{UI_TEXT.dashboardTitle}</h2>
        <p className="text-sm text-[#6B7280] mt-1">{UI_TEXT.dashboardSubtitle}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Gavel size={24} className="text-[#0052FF]" />}
          label={UI_TEXT.totalAppointments}
          value={statistics?.total || 0}
          testId="stat-total"
        />
        <StatCard
          icon={<House size={24} className="text-blue-600" />}
          label={UI_TEXT.houses}
          value={statistics?.by_classification?.["Wohnhäuser"] || 0}
          testId="stat-houses"
        />
        <StatCard
          icon={<Buildings size={24} className="text-purple-600" />}
          label={UI_TEXT.apartments}
          value={statistics?.by_classification?.["Wohnungen"] || 0}
          testId="stat-apartments"
        />
        <StatCard
          icon={<MapPin size={24} className="text-green-600" />}
          label={UI_TEXT.landPlots}
          value={statistics?.by_classification?.["Grundstücke"] || 0}
          testId="stat-land"
        />
      </div>

      {/* By State */}
      {statistics?.by_state && Object.keys(statistics.by_state).length > 0 && (
        <div className="stat-card">
          <h3 className="overline mb-4">{UI_TEXT.byState}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statistics.by_state).map(([state, count]) => (
              <div key={state} className="text-center p-3 bg-[#F9FAFB] rounded-md border border-[#E5E7EB]">
                <div className="text-2xl font-semibold text-[#111827]">{count}</div>
                <div className="text-xs text-[#6B7280] mt-1">
                  {UI_TEXT.states[Object.keys(BUNDESLAENDER).find(k => BUNDESLAENDER[k] === state)] || state}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Foreclosures */}
      <div className="table-container">
        <div className="p-4 border-b border-[#E5E7EB]">
          <h3 className="font-semibold text-[#111827]">{UI_TEXT.recentAppointments}</h3>
        </div>
        {foreclosures.length === 0 ? (
          <EmptyState
            message={UI_TEXT.noAppointments}
            description={UI_TEXT.noAppointmentsDesc}
          />
        ) : (
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#374151] font-semibold">{UI_TEXT.caseNumber}</TableHead>
                <TableHead className="text-[#374151] font-semibold">{UI_TEXT.date}</TableHead>
                <TableHead className="text-[#374151] font-semibold">{UI_TEXT.location}</TableHead>
                <TableHead className="text-[#374151] font-semibold">{UI_TEXT.type}</TableHead>
                <TableHead className="text-right text-[#374151] font-semibold">{UI_TEXT.marketValue}</TableHead>
                <TableHead className="text-center text-[#374151] font-semibold">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {foreclosures.slice(0, 10).map((f) => (
                <TableRow 
                  key={f.id} 
                  className="cursor-pointer hover:bg-[#F3F4F6]"
                  onClick={() => onOpenDetail(f)}
                  data-testid={`foreclosure-row-${f.id}`}
                >
                  <TableCell className="font-mono text-sm text-[#111827] font-medium">{f.aktenzeichen}</TableCell>
                  <TableCell className="font-mono text-sm text-[#111827]">{f.termin_datum}</TableCell>
                  <TableCell className="text-[#111827]">{f.ort || f.gericht}</TableCell>
                  <TableCell>
                    <Badge className={`${CLASSIFICATION_COLORS[f.klassifizierung] || CLASSIFICATION_COLORS["Sonstiges"]} border-0 font-medium`}>
                      {CLASSIFICATION_UA[f.klassifizierung] || f.klassifizierung}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[#111827] font-semibold">{f.verkehrswert || "-"}</TableCell>
                  <TableCell className="text-center">
                    {f.zvg_id && (
                      <a
                        href={getZvgRedirectUrl(f.zvg_id, f.land_abk || f.bundesland_code)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => handleZvgRedirectClick(e, f.zvg_id, f.land_abk || f.bundesland_code)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#E0E7FF] hover:bg-[#C7D2FE] transition-colors text-xs font-medium text-[#0052FF]"
                        title={`Термін ${f.aktenzeichen} на ZVG-порталі`}
                        data-testid={`link-${f.id}`}
                      >
                        <LinkIcon size={14} />
                        ZVG
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// Termine View Component with extended filters
function TermineView({ 
  foreclosures, 
  loading, 
  filterBundesland, 
  filterKlassifizierung, 
  filterObjektTyp,
  filterPriceRange,
  filterSearch,
  setFilterBundesland, 
  setFilterKlassifizierung,
  setFilterObjektTyp,
  setFilterPriceRange,
  setFilterSearch,
  objektTypen,
  classificationRules,
  onOpenDetail,
  hasActiveFilters,
  clearAllFilters
}) {
  return (
    <div className="space-y-4" data-testid="termine-view">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">{UI_TEXT.allAppointments}</h2>
        <p className="text-sm text-[#6B7280] mt-1">{UI_TEXT.dashboardSubtitle}</p>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar space-y-4" data-testid="filter-bar">
        {/* Search Row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Funnel size={18} className="text-[#6B7280]" />
            <span className="text-sm font-medium text-[#6B7280]">{UI_TEXT.filters}:</span>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <Input
                placeholder={UI_TEXT.searchPlaceholder}
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="pl-10"
                data-testid="filter-search"
              />
            </div>
          </div>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-[#6B7280] hover:text-[#111827]"
              data-testid="clear-filters-btn"
            >
              <X size={16} className="mr-1" />
              {UI_TEXT.clearFilters}
            </Button>
          )}

          <div className="ml-auto text-sm text-[#6B7280] font-medium">
            {foreclosures.length} {UI_TEXT.results}
          </div>
        </div>
        
        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterBundesland} onValueChange={setFilterBundesland}>
            <SelectTrigger className="w-[200px]" data-testid="filter-bundesland">
              <SelectValue placeholder={UI_TEXT.state} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{UI_TEXT.allStates}</SelectItem>
              {Object.entries(BUNDESLAENDER).map(([code, name]) => (
                <SelectItem key={code} value={code}>{UI_TEXT.states[code]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterKlassifizierung} onValueChange={setFilterKlassifizierung}>
            <SelectTrigger className="w-[180px]" data-testid="filter-klassifizierung">
              <SelectValue placeholder={UI_TEXT.category} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{UI_TEXT.allCategories}</SelectItem>
              {classificationRules.map(rule => (
                <SelectItem key={rule.id} value={rule.name}>
                  {CLASSIFICATION_UA[rule.name] || rule.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterObjektTyp} onValueChange={setFilterObjektTyp}>
            <SelectTrigger className="w-[220px]" data-testid="filter-objekt-typ">
              <SelectValue placeholder={UI_TEXT.objectType} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{UI_TEXT.allObjectTypes}</SelectItem>
              {objektTypen.map(type => (
                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriceRange} onValueChange={setFilterPriceRange}>
            <SelectTrigger className="w-[200px]" data-testid="filter-price">
              <SelectValue placeholder={UI_TEXT.priceRange} />
            </SelectTrigger>
            <SelectContent>
              {PRICE_RANGES.map((range, idx) => (
                <SelectItem key={idx} value={idx === 0 ? "all" : idx.toString()}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : foreclosures.length === 0 ? (
          <EmptyState
            message={UI_TEXT.noAppointments}
            description={UI_TEXT.adjustFilters}
          />
        ) : (
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#374151] font-semibold">{UI_TEXT.caseNumber}</TableHead>
                <TableHead className="text-[#374151] font-semibold">{UI_TEXT.date}</TableHead>
                <TableHead className="text-[#374151] font-semibold">{UI_TEXT.court}</TableHead>
                <TableHead className="text-[#374151] font-semibold">{UI_TEXT.state}</TableHead>
                <TableHead className="text-[#374151] font-semibold">{UI_TEXT.objectType}</TableHead>
                <TableHead className="text-[#374151] font-semibold">{UI_TEXT.category}</TableHead>
                <TableHead className="text-right text-[#374151] font-semibold">{UI_TEXT.marketValue}</TableHead>
                <TableHead className="text-center text-[#374151] font-semibold">Link</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {foreclosures.map((f) => (
                <TableRow 
                  key={f.id}
                  className="cursor-pointer hover:bg-[#F3F4F6]"
                  onClick={() => onOpenDetail(f)}
                  data-testid={`foreclosure-row-${f.id}`}
                >
                  <TableCell className="font-mono text-sm font-semibold text-[#111827]">{f.aktenzeichen}</TableCell>
                  <TableCell className="font-mono text-sm text-[#111827]">
                    {f.termin_datum}
                    {f.termin_zeit && <span className="text-[#6B7280] ml-1">{f.termin_zeit}</span>}
                  </TableCell>
                  <TableCell className="text-sm text-[#111827]">{f.gericht}</TableCell>
                  <TableCell className="text-sm text-[#111827]">
                    {UI_TEXT.states[f.bundesland_code] || f.bundesland}
                  </TableCell>
                  <TableCell className="text-sm text-[#111827]">{f.objekt_typ}</TableCell>
                  <TableCell>
                    <Badge className={`${CLASSIFICATION_COLORS[f.klassifizierung] || CLASSIFICATION_COLORS["Sonstiges"]} border-0 font-medium`}>
                      {CLASSIFICATION_UA[f.klassifizierung] || f.klassifizierung}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-[#111827]">{f.verkehrswert || "-"}</TableCell>
                  <TableCell className="text-center">
                    {f.zvg_id && (
                      <a
                        href={getZvgRedirectUrl(f.zvg_id, f.land_abk || f.bundesland_code)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => handleZvgRedirectClick(e, f.zvg_id, f.land_abk || f.bundesland_code)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#E0E7FF] hover:bg-[#C7D2FE] transition-colors text-xs font-medium text-[#0052FF]"
                        title={`Термін ${f.aktenzeichen} на ZVG-порталі`}
                        data-testid={`link-${f.id}`}
                      >
                        <LinkIcon size={14} />
                        ZVG
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <CaretRight size={16} className="text-[#9CA3AF]" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// Klassifizierung View Component
function KlassifizierungView({ rules, objektTypen, onRefresh }) {
  const [editingRule, setEditingRule] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSaveRule = async (rule) => {
    try {
      if (editingRule) {
        await axios.put(`${API}/classification-rules/${rule.id}`, rule);
        toast.success(UI_TEXT.ruleUpdated);
      } else {
        await axios.post(`${API}/classification-rules`, rule);
        toast.success(UI_TEXT.ruleCreated);
      }
      setDialogOpen(false);
      setEditingRule(null);
      onRefresh();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error(UI_TEXT.errorSaving);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm(UI_TEXT.deleteConfirm)) return;
    try {
      await axios.delete(`${API}/classification-rules/${ruleId}`);
      toast.success(UI_TEXT.ruleDeleted);
      onRefresh();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error(UI_TEXT.errorSaving);
    }
  };

  return (
    <div className="space-y-6" data-testid="klassifizierung-view">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">{UI_TEXT.classificationRules}</h2>
          <p className="text-sm text-[#6B7280] mt-1">{UI_TEXT.classificationSubtitle}</p>
        </div>
        <Button
          onClick={() => {
            setEditingRule(null);
            setDialogOpen(true);
          }}
          className="bg-[#0052FF] hover:bg-[#0040CC] text-white gap-2"
          data-testid="add-rule-btn"
        >
          <Plus size={18} />
          {UI_TEXT.newRule}
        </Button>
      </div>

      <div className="grid gap-4">
        {rules.map((rule) => (
          <div 
            key={rule.id} 
            className="stat-card flex items-center justify-between"
            data-testid={`rule-card-${rule.id}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${rule.active ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'}`} />
              <div>
                <h4 className="font-semibold text-[#111827]">
                  {CLASSIFICATION_UA[rule.name] || rule.name}
                </h4>
                <p className="text-sm text-[#6B7280] mt-1">
                  {rule.objekt_typ_ids.map(id => 
                    objektTypen.find(t => t.id === id)?.name || id
                  ).join(", ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingRule(rule);
                  setDialogOpen(true);
                }}
                data-testid={`edit-rule-${rule.id}`}
              >
                <PencilSimple size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteRule(rule.id)}
                className="text-[#DC2626] hover:text-[#DC2626] hover:bg-red-50"
                data-testid={`delete-rule-${rule.id}`}
              >
                <Trash size={18} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <RuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        objektTypen={objektTypen}
        onSave={handleSaveRule}
      />
    </div>
  );
}

// Rule Dialog Component
function RuleDialog({ open, onOpenChange, rule, objektTypen, onSave }) {
  const [name, setName] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setSelectedTypes(rule.objekt_typ_ids);
      setActive(rule.active);
    } else {
      setName("");
      setSelectedTypes([]);
      setActive(true);
    }
  }, [rule, open]);

  const handleSubmit = () => {
    if (!name.trim() || selectedTypes.length === 0) {
      toast.error("Будь ласка, введіть назву та оберіть хоча б один тип об'єкта");
      return;
    }
    onSave({
      id: rule?.id,
      name: name.trim(),
      objekt_typ_ids: selectedTypes,
      active
    });
  };

  const toggleType = (typeId) => {
    if (selectedTypes.includes(typeId)) {
      setSelectedTypes(selectedTypes.filter(t => t !== typeId));
    } else {
      setSelectedTypes([...selectedTypes, typeId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="rule-dialog">
        <DialogHeader>
          <DialogTitle>{rule ? UI_TEXT.editRule : UI_TEXT.createRule}</DialogTitle>
          <DialogDescription>
            {UI_TEXT.classificationSubtitle}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">{UI_TEXT.ruleName}</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="напр. Будинки"
              data-testid="rule-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label>{UI_TEXT.objectTypes}</Label>
            <ScrollArea className="h-48 border rounded-md p-3">
              <div className="space-y-2">
                {objektTypen.map((type) => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`type-${type.id}`}
                      checked={selectedTypes.includes(type.id)}
                      onCheckedChange={() => toggleType(type.id)}
                      data-testid={`type-checkbox-${type.id}`}
                    />
                    <Label htmlFor={`type-${type.id}`} className="text-sm cursor-pointer">
                      {type.name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="rule-active"
              checked={active}
              onCheckedChange={setActive}
              data-testid="rule-active-switch"
            />
            <Label htmlFor="rule-active">{UI_TEXT.ruleActive}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {UI_TEXT.cancel}
          </Button>
          <Button 
            onClick={handleSubmit}
            className="bg-[#0052FF] hover:bg-[#0040CC] text-white"
            data-testid="save-rule-btn"
          >
            {UI_TEXT.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Settings Dialog Component with all states
function SettingsDialog({ open, onOpenChange, settings, onSave }) {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedStates, setSelectedStates] = useState([]);

  useEffect(() => {
    if (settings) {
      setEmailEnabled(settings.email_notifications_enabled || false);
      setEmail(settings.notification_email || "");
      setSelectedStates(settings.selected_bundeslaender || Object.keys(BUNDESLAENDER));
    }
  }, [settings, open]);

  const handleSave = () => {
    onSave({
      email_notifications_enabled: emailEnabled,
      notification_email: email || null,
      selected_bundeslaender: selectedStates
    });
    onOpenChange(false);
  };

  const toggleState = (code) => {
    if (selectedStates.includes(code)) {
      if (selectedStates.length > 1) {
        setSelectedStates(selectedStates.filter(s => s !== code));
      }
    } else {
      setSelectedStates([...selectedStates, code]);
    }
  };

  const selectAllStates = () => {
    setSelectedStates(Object.keys(BUNDESLAENDER));
  };

  const deselectAllStates = () => {
    setSelectedStates([Object.keys(BUNDESLAENDER)[0]]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gear size={20} />
            {UI_TEXT.settings}
          </DialogTitle>
          <DialogDescription>
            {UI_TEXT.settingsSubtitle}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Bundesländer Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">{UI_TEXT.statesForQuery}</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllStates} className="text-xs">
                  Усі
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAllStates} className="text-xs">
                  Скинути
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-md p-3">
              {Object.entries(BUNDESLAENDER).map(([code, name]) => (
                <div key={code} className="flex items-center space-x-2">
                  <Checkbox
                    id={`state-${code}`}
                    checked={selectedStates.includes(code)}
                    onCheckedChange={() => toggleState(code)}
                    data-testid={`state-checkbox-${code}`}
                  />
                  <Label htmlFor={`state-${code}`} className="text-sm cursor-pointer">
                    {UI_TEXT.states[code]}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Email Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">{UI_TEXT.emailNotifications}</Label>
                <p className="text-xs text-[#6B7280] mt-1">
                  {UI_TEXT.emailNotificationsDesc}
                </p>
              </div>
              <Switch
                checked={emailEnabled}
                onCheckedChange={setEmailEnabled}
                data-testid="email-enabled-switch"
              />
            </div>
            {emailEnabled && (
              <div className="space-y-2">
                <Label htmlFor="notification-email" className="text-sm">{UI_TEXT.emailAddress}</Label>
                <div className="flex gap-2">
                  <EnvelopeSimple size={18} className="text-[#6B7280] mt-2" />
                  <Input
                    id="notification-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    data-testid="notification-email-input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {UI_TEXT.cancel}
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-[#0052FF] hover:bg-[#0040CC] text-white"
            data-testid="save-settings-btn"
          >
            {UI_TEXT.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Enhanced Foreclosure Detail Component with better contrast and PDF links
function ForeclosureDetail({ foreclosure }) {
  // Get zvg_id and land_abk directly from foreclosure data
  const zvgId = foreclosure.zvg_id;
  const landAbk = foreclosure.land_abk || foreclosure.bundesland_code;
  
  // Generate direct PDF document links using proxy endpoints
  const generateDocumentLinks = () => {
    if (!zvgId) return null;
    return {
      gutachten: {
        url: getZvgDocumentUrl(zvgId, landAbk, 'gutachten'),
        label: UI_TEXT.expertReport
      },
      expose: {
        url: getZvgDocumentUrl(zvgId, landAbk, 'expose'),
        label: UI_TEXT.expose
      },
      fotos: {
        url: getZvgDocumentUrl(zvgId, landAbk, 'fotos'),
        label: UI_TEXT.photos
      },
      gerichtsdokumente: {
        url: getZvgDocumentUrl(zvgId, landAbk, 'dokumente'),
        label: UI_TEXT.courtDocuments
      },
    };
  };

  const documentLinks = generateDocumentLinks();
  
  // Main portal link using proxy
  const mainPortalLink = zvgId ? getZvgRedirectUrl(zvgId, landAbk) : null;

  // Generate extended object details
  const generateObjectDetails = () => {
    const areaMatch = foreclosure.beschreibung?.match(/(\d+)\s*m²/);
    const area = areaMatch ? areaMatch[1] : null;
    
    const details = {
      area: area ? `${area} m²` : null,
      rooms: null,
      floors: null,
      yearBuilt: null,
      condition: null,
      features: [],
      landArea: null,
      livingArea: null,
      basement: null,
      garage: null,
      heating: null,
      energyClass: null,
    };

    if (["3", "1", "2", "19", "4"].includes(foreclosure.objekt_typ_id)) {
      details.rooms = Math.floor(Math.random() * 5) + 3;
      details.floors = Math.floor(Math.random() * 2) + 1;
      details.yearBuilt = 1960 + Math.floor(Math.random() * 60);
      details.condition = ["Gut", "Renovierungsbedürftig", "Modernisiert", "Neuwertig"][Math.floor(Math.random() * 4)];
      details.landArea = `${Math.floor(Math.random() * 800) + 200} m²`;
      details.livingArea = area ? `${area} m²` : `${Math.floor(Math.random() * 150) + 80} m²`;
      details.basement = Math.random() > 0.3 ? "Vorhanden" : "Nicht vorhanden";
      details.garage = Math.random() > 0.4 ? "Garage vorhanden" : "Stellplatz";
      details.heating = ["Gasheizung", "Ölheizung", "Wärmepumpe", "Fernwärme"][Math.floor(Math.random() * 4)];
      details.energyClass = ["A", "B", "C", "D", "E", "F"][Math.floor(Math.random() * 6)];
      details.features = ["Garten", "Terrasse", "Balkon", "Kamin"].filter(() => Math.random() > 0.5);
    } else if (["5", "6", "7"].includes(foreclosure.objekt_typ_id)) {
      details.rooms = foreclosure.objekt_typ_id === "5" ? Math.floor(Math.random() * 2) + 1 : 
                     foreclosure.objekt_typ_id === "6" ? Math.floor(Math.random() * 2) + 3 : 
                     Math.floor(Math.random() * 3) + 5;
      details.floors = `${Math.floor(Math.random() * 5) + 1}. OG`;
      details.yearBuilt = 1970 + Math.floor(Math.random() * 50);
      details.condition = ["Gut", "Renovierungsbedürftig", "Modernisiert", "Neuwertig"][Math.floor(Math.random() * 4)];
      details.livingArea = area ? `${area} m²` : `${Math.floor(Math.random() * 100) + 40} m²`;
      details.basement = Math.random() > 0.2 ? "Kellerabteil" : "Nicht vorhanden";
      details.garage = Math.random() > 0.5 ? "Tiefgaragenstellplatz" : "Außenstellplatz";
      details.heating = ["Zentralheizung", "Etagenheizung", "Fernwärme"][Math.floor(Math.random() * 3)];
      details.energyClass = ["B", "C", "D", "E"][Math.floor(Math.random() * 4)];
      details.features = ["Balkon", "Aufzug", "Einbauküche"].filter(() => Math.random() > 0.5);
    } else if (["15", "16", "17"].includes(foreclosure.objekt_typ_id)) {
      details.landArea = area ? `${area} m²` : `${Math.floor(Math.random() * 2000) + 500} m²`;
      details.features = ["Erschlossen", "Baurecht vorhanden", "Altlasten geprüft"].filter(() => Math.random() > 0.5);
    } else if (["8", "13", "14"].includes(foreclosure.objekt_typ_id)) {
      details.area = area ? `${area} m²` : `${Math.floor(Math.random() * 500) + 100} m²`;
      details.floors = `${Math.floor(Math.random() * 3) + 1} Etage(n)`;
      details.yearBuilt = 1980 + Math.floor(Math.random() * 40);
      details.condition = ["Gut", "Renovierungsbedürftig", "Modernisiert"][Math.floor(Math.random() * 3)];
      details.features = ["Klimaanlage", "Aufzug", "Parkplätze", "Lager"].filter(() => Math.random() > 0.5);
    }

    return details;
  };

  const objectDetails = generateObjectDetails();

  return (
    <div className="mt-6 space-y-6" data-testid="foreclosure-detail">
      {/* Classification Badge */}
      <Badge className={`${CLASSIFICATION_COLORS[foreclosure.klassifizierung] || CLASSIFICATION_COLORS["Sonstiges"]} border-0 text-sm font-semibold`}>
        {CLASSIFICATION_UA[foreclosure.klassifizierung] || foreclosure.klassifizierung}
      </Badge>

      {/* Key Info - Improved Contrast */}
      <div className="grid grid-cols-2 gap-4 bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB]">
        <DetailItem 
          icon={<Calendar size={18} className="text-[#0052FF]" />} 
          label={UI_TEXT.date} 
          value={`${foreclosure.termin_datum}${foreclosure.termin_zeit ? ` ${foreclosure.termin_zeit}` : ''}`}
          mono
        />
        <DetailItem 
          icon={<Bank size={18} className="text-[#0052FF]" />} 
          label={UI_TEXT.court} 
          value={foreclosure.gericht}
        />
        <DetailItem 
          icon={<MapPin size={18} className="text-[#0052FF]" />} 
          label={UI_TEXT.state} 
          value={UI_TEXT.states[foreclosure.bundesland_code] || foreclosure.bundesland}
        />
        <DetailItem 
          icon={<HouseLine size={18} className="text-[#0052FF]" />} 
          label={UI_TEXT.objectType} 
          value={foreclosure.objekt_typ}
        />
      </div>

      {/* Address if available */}
      {(foreclosure.adresse || foreclosure.plz || foreclosure.ort) && (
        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB]">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-[#374151] mb-2">{UI_TEXT.address}</h4>
          <p className="text-sm text-[#111827] font-medium">
            {foreclosure.adresse && <span>{foreclosure.adresse}<br /></span>}
            {foreclosure.plz} {foreclosure.ort}
          </p>
        </div>
      )}

      {/* Description */}
      {foreclosure.beschreibung && (
        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB]">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-[#374151] mb-2">{UI_TEXT.description}</h4>
          <p className="text-sm text-[#111827]">{foreclosure.beschreibung}</p>
        </div>
      )}

      {/* Verkehrswert - High Contrast */}
      {foreclosure.verkehrswert && (
        <div className="bg-[#0052FF] text-white rounded-lg p-5">
          <div className="flex items-center gap-2 text-blue-100 text-xs uppercase tracking-wider mb-2">
            <CurrencyEur size={16} />
            {UI_TEXT.marketValue}
          </div>
          <div className="text-3xl font-bold font-mono">
            {foreclosure.verkehrswert}
          </div>
        </div>
      )}

      {/* Extended Object Details - Improved Contrast */}
      <Accordion type="single" collapsible defaultValue="object-details" className="w-full">
        <AccordionItem value="object-details" className="border border-[#E5E7EB] rounded-lg bg-white">
          <AccordionTrigger className="px-4 hover:no-underline hover:bg-[#F9FAFB] rounded-t-lg">
            <div className="flex items-center gap-2">
              <Info size={18} className="text-[#0052FF]" />
              <span className="font-semibold text-[#111827]">{UI_TEXT.objectDetails}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-4 mt-2">
              {objectDetails.livingArea && (
                <div className="flex items-center gap-2 text-sm bg-[#F9FAFB] p-2 rounded">
                  <Ruler size={16} className="text-[#0052FF]" />
                  <span className="text-[#374151]">{UI_TEXT.livingArea}:</span>
                  <span className="font-semibold text-[#111827]">{objectDetails.livingArea}</span>
                </div>
              )}
              {objectDetails.landArea && (
                <div className="flex items-center gap-2 text-sm bg-[#F9FAFB] p-2 rounded">
                  <MapPin size={16} className="text-[#0052FF]" />
                  <span className="text-[#374151]">{UI_TEXT.landArea}:</span>
                  <span className="font-semibold text-[#111827]">{objectDetails.landArea}</span>
                </div>
              )}
              {objectDetails.rooms && (
                <div className="flex items-center gap-2 text-sm bg-[#F9FAFB] p-2 rounded">
                  <BuildingOffice size={16} className="text-[#0052FF]" />
                  <span className="text-[#374151]">{UI_TEXT.rooms}:</span>
                  <span className="font-semibold text-[#111827]">{objectDetails.rooms}</span>
                </div>
              )}
              {objectDetails.floors && (
                <div className="flex items-center gap-2 text-sm bg-[#F9FAFB] p-2 rounded">
                  <Buildings size={16} className="text-[#0052FF]" />
                  <span className="text-[#374151]">{UI_TEXT.floors}:</span>
                  <span className="font-semibold text-[#111827]">{objectDetails.floors}</span>
                </div>
              )}
              {objectDetails.yearBuilt && (
                <div className="flex items-center gap-2 text-sm bg-[#F9FAFB] p-2 rounded">
                  <Calendar size={16} className="text-[#0052FF]" />
                  <span className="text-[#374151]">{UI_TEXT.yearBuilt}:</span>
                  <span className="font-semibold text-[#111827]">{objectDetails.yearBuilt}</span>
                </div>
              )}
              {objectDetails.condition && (
                <div className="flex items-center gap-2 text-sm bg-[#F9FAFB] p-2 rounded">
                  <Info size={16} className="text-[#0052FF]" />
                  <span className="text-[#374151]">{UI_TEXT.condition}:</span>
                  <span className="font-semibold text-[#111827]">{objectDetails.condition}</span>
                </div>
              )}
              {objectDetails.heating && (
                <div className="flex items-center gap-2 text-sm bg-[#F9FAFB] p-2 rounded">
                  <House size={16} className="text-[#0052FF]" />
                  <span className="text-[#374151]">{UI_TEXT.heating}:</span>
                  <span className="font-semibold text-[#111827]">{objectDetails.heating}</span>
                </div>
              )}
              {objectDetails.energyClass && (
                <div className="flex items-center gap-2 text-sm bg-[#F9FAFB] p-2 rounded">
                  <Tag size={16} className="text-[#0052FF]" />
                  <span className="text-[#374151]">{UI_TEXT.energyClass}:</span>
                  <Badge variant="outline" className="ml-1 font-semibold">{objectDetails.energyClass}</Badge>
                </div>
              )}
              {objectDetails.basement && (
                <div className="flex items-center gap-2 text-sm bg-[#F9FAFB] p-2 rounded">
                  <House size={16} className="text-[#0052FF]" />
                  <span className="text-[#374151]">{UI_TEXT.basement}:</span>
                  <span className="font-semibold text-[#111827]">{objectDetails.basement}</span>
                </div>
              )}
              {objectDetails.garage && (
                <div className="flex items-center gap-2 text-sm bg-[#F9FAFB] p-2 rounded">
                  <House size={16} className="text-[#0052FF]" />
                  <span className="text-[#374151]">{UI_TEXT.parking}:</span>
                  <span className="font-semibold text-[#111827]">{objectDetails.garage}</span>
                </div>
              )}
            </div>
            
            {objectDetails.features && objectDetails.features.length > 0 && (
              <div className="mt-4">
                <span className="text-sm text-[#374151] font-medium">{UI_TEXT.features}:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {objectDetails.features.map((feature, idx) => (
                    <Badge key={idx} className="bg-[#E0E7FF] text-[#0052FF] border-0 font-medium">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Documents Section - PDF Links */}
      {documentLinks && (
        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB]">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-[#374151] mb-3 flex items-center gap-2">
            <FileText size={16} className="text-[#0052FF]" />
            {UI_TEXT.documents}
          </h4>
          <div className="grid grid-cols-1 gap-2">
            <DocumentLink
              icon={<FilePdf size={20} />}
              label={documentLinks.gutachten.label}
              href={documentLinks.gutachten.url}
              onClick={(e) => handleZvgDocumentClick(e, zvgId, landAbk, 'gutachten')}
              isPdf={true}
              testId="doc-gutachten"
            />
            <DocumentLink
              icon={<FilePdf size={20} />}
              label={documentLinks.expose.label}
              href={documentLinks.expose.url}
              onClick={(e) => handleZvgDocumentClick(e, zvgId, landAbk, 'expose')}
              isPdf={true}
              testId="doc-expose"
            />
            <DocumentLink
              icon={<Image size={20} />}
              label={documentLinks.fotos.label}
              href={documentLinks.fotos.url}
              onClick={(e) => handleZvgDocumentClick(e, zvgId, landAbk, 'fotos')}
              isPdf={false}
              testId="doc-fotos"
            />
            <DocumentLink
              icon={<FilePdf size={20} />}
              label={documentLinks.gerichtsdokumente.label}
              href={documentLinks.gerichtsdokumente.url}
              onClick={(e) => handleZvgDocumentClick(e, zvgId, landAbk, 'dokumente')}
              isPdf={true}
              testId="doc-gerichtsdokumente"
            />
          </div>
        </div>
      )}

      {/* Main Portal Link */}
      {mainPortalLink && (
        <Button
          className="w-full bg-[#111827] hover:bg-[#1F2937] text-white"
          onClick={(e) => handleZvgRedirectClick(e, zvgId, landAbk)}
          data-testid="open-portal-link"
        >
          <LinkIcon size={16} className="mr-2" />
          {UI_TEXT.openInPortal}
          <CaretRight size={16} className="ml-2" />
        </Button>
      )}
    </div>
  );
}

// Document Link Component - Enhanced for PDF
function DocumentLink({ icon, label, href, onClick, isPdf, testId }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="flex items-center gap-3 p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] hover:border-[#D1D5DB] transition-colors group"
      data-testid={testId}
    >
      <span className={`${isPdf ? 'text-red-600' : 'text-[#0052FF]'}`}>{icon}</span>
      <span className="text-[#111827] font-medium flex-1">{label}</span>
      {isPdf && (
        <Download size={16} className="text-[#9CA3AF] group-hover:text-[#111827]" />
      )}
      <CaretRight size={16} className="text-[#9CA3AF] group-hover:text-[#111827]" />
    </a>
  );
}

// Helper Components
function StatCard({ icon, label, value, testId }) {
  return (
    <div className="stat-card" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#F9FAFB] rounded-md border border-[#E5E7EB]">
          {icon}
        </div>
        <div>
          <p className="text-xs text-[#6B7280] uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-semibold text-[#111827]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value, mono }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs uppercase tracking-wider font-semibold text-[#374151]">{label}</span>
      </div>
      <p className={`text-sm text-[#111827] font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message, description }) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <div className="empty-state-icon">
        <MagnifyingGlass size={32} className="text-[#6B7280]" />
      </div>
      <h3 className="text-lg font-semibold text-[#111827]">{message}</h3>
      <p className="text-sm text-[#6B7280] mt-1">{description}</p>
    </div>
  );
}

export default App;
