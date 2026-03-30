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
  Check,
  Plus,
  Trash,
  PencilSimple,
  EnvelopeSimple,
  ChartBar
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Classification badge colors
const CLASSIFICATION_COLORS = {
  "Wohnhäuser": "bg-blue-100 text-blue-700",
  "Wohnungen": "bg-purple-100 text-purple-700",
  "Gewerbe": "bg-amber-100 text-amber-700",
  "Grundstücke": "bg-green-100 text-green-700",
  "Stellplätze": "bg-slate-100 text-slate-700",
  "Sonstiges": "bg-gray-100 text-gray-700",
};

// Bundesländer mapping
const BUNDESLAENDER = {
  bw: "Baden-Württemberg",
  by: "Bayern",
  he: "Hessen",
  rp: "Rheinland-Pfalz",
};

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

  // Fetch data
  const fetchForeclosures = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterBundesland !== "all") params.append("bundesland", filterBundesland);
      if (filterKlassifizierung !== "all") params.append("klassifizierung", filterKlassifizierung);
      if (filterObjektTyp !== "all") params.append("objekt_typ", filterObjektTyp);
      
      const response = await axios.get(`${API}/foreclosures?${params.toString()}`);
      setForeclosures(response.data);
    } catch (error) {
      console.error("Error fetching foreclosures:", error);
      toast.error("Fehler beim Laden der Termine");
    }
  }, [filterBundesland, filterKlassifizierung, filterObjektTyp]);

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
  }, [filterBundesland, filterKlassifizierung, filterObjektTyp, fetchForeclosures]);

  // Actions
  const triggerFetch = async () => {
    setFetching(true);
    try {
      const response = await axios.post(`${API}/fetch`);
      toast.success(response.data.message);
      await Promise.all([
        fetchForeclosures(),
        fetchStatistics(),
        fetchNotifications(),
      ]);
    } catch (error) {
      console.error("Error triggering fetch:", error);
      toast.error("Fehler bei der Datenabfrage");
    } finally {
      setFetching(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const response = await axios.put(`${API}/settings`, newSettings);
      setSettings(response.data);
      toast.success("Einstellungen gespeichert");
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Fehler beim Speichern");
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

  return (
    <div className="app-container" data-testid="app-container">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <header className="app-header flex items-center justify-between" data-testid="app-header">
        <div className="flex items-center gap-3">
          <Gavel size={28} weight="fill" className="text-[#0052FF]" />
          <h1 className="text-xl font-semibold text-[#111827]">
            ZVG Termin-Extraktor
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
            {fetching ? "Lädt..." : "Daten abrufen"}
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
                <span className="font-semibold text-sm">Benachrichtigungen</span>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllNotificationsRead} className="text-xs">
                    Alle gelesen
                  </Button>
                )}
              </div>
              <DropdownMenuSeparator />
              <ScrollArea className="h-64">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-[#6B7280]">
                    Keine Benachrichtigungen
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem key={notification.id} className="flex-col items-start p-3 cursor-default">
                      <div className={`text-sm ${notification.read ? 'text-[#6B7280]' : 'text-[#111827] font-medium'}`}>
                        {notification.message}
                      </div>
                      <div className="text-xs text-[#6B7280] mt-1">
                        {new Date(notification.created_at).toLocaleString('de-DE')}
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
              <span>Dashboard</span>
            </button>
            <button
              data-testid="nav-termine"
              className={`sidebar-item w-full ${activeView === "termine" ? "active" : ""}`}
              onClick={() => setActiveView("termine")}
            >
              <Calendar size={20} />
              <span>Alle Termine</span>
            </button>
            <button
              data-testid="nav-klassifizierung"
              className={`sidebar-item w-full ${activeView === "klassifizierung" ? "active" : ""}`}
              onClick={() => setActiveView("klassifizierung")}
            >
              <Tag size={20} />
              <span>Klassifizierung</span>
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
              setFilterBundesland={setFilterBundesland}
              setFilterKlassifizierung={setFilterKlassifizierung}
              setFilterObjektTyp={setFilterObjektTyp}
              objektTypen={objektTypen}
              classificationRules={classificationRules}
              onOpenDetail={openForeclosureDetail}
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
        <SheetContent className="w-[500px] sm:w-[540px]" data-testid="detail-sheet">
          {selectedForeclosure && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Gavel size={20} className="text-[#0052FF]" />
                  Termindetails
                </SheetTitle>
                <SheetDescription>
                  Aktenzeichen: {selectedForeclosure.aktenzeichen}
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
        <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">Dashboard</h2>
        <p className="text-sm text-[#6B7280] mt-1">Übersicht der Zwangsversteigerungstermine</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Gavel size={24} className="text-[#0052FF]" />}
          label="Gesamt Termine"
          value={statistics?.total || 0}
          testId="stat-total"
        />
        <StatCard
          icon={<House size={24} className="text-blue-600" />}
          label="Wohnhäuser"
          value={statistics?.by_classification?.["Wohnhäuser"] || 0}
          testId="stat-houses"
        />
        <StatCard
          icon={<Buildings size={24} className="text-purple-600" />}
          label="Wohnungen"
          value={statistics?.by_classification?.["Wohnungen"] || 0}
          testId="stat-apartments"
        />
        <StatCard
          icon={<MapPin size={24} className="text-green-600" />}
          label="Grundstücke"
          value={statistics?.by_classification?.["Grundstücke"] || 0}
          testId="stat-land"
        />
      </div>

      {/* By State */}
      {statistics?.by_state && Object.keys(statistics.by_state).length > 0 && (
        <div className="stat-card">
          <h3 className="overline mb-4">Nach Bundesland</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statistics.by_state).map(([state, count]) => (
              <div key={state} className="text-center p-3 bg-[#F9FAFB] rounded-md border border-[#E5E7EB]">
                <div className="text-2xl font-semibold text-[#111827]">{count}</div>
                <div className="text-xs text-[#6B7280] mt-1">{state}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Foreclosures */}
      <div className="table-container">
        <div className="p-4 border-b border-[#E5E7EB]">
          <h3 className="font-semibold text-[#111827]">Neueste Termine</h3>
        </div>
        {foreclosures.length === 0 ? (
          <EmptyState
            message="Keine Termine vorhanden"
            description="Klicken Sie auf 'Daten abrufen' um Termine zu laden"
          />
        ) : (
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Aktenzeichen</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead>Ort</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Verkehrswert</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {foreclosures.slice(0, 10).map((f) => (
                <TableRow 
                  key={f.id} 
                  className="cursor-pointer"
                  onClick={() => onOpenDetail(f)}
                  data-testid={`foreclosure-row-${f.id}`}
                >
                  <TableCell className="font-mono text-sm">{f.aktenzeichen}</TableCell>
                  <TableCell className="font-mono text-sm">{f.termin_datum}</TableCell>
                  <TableCell>{f.ort || f.gericht}</TableCell>
                  <TableCell>
                    <Badge className={`${CLASSIFICATION_COLORS[f.klassifizierung] || CLASSIFICATION_COLORS["Sonstiges"]} border-0`}>
                      {f.klassifizierung}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{f.verkehrswert || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// Termine View Component
function TermineView({ 
  foreclosures, 
  loading, 
  filterBundesland, 
  filterKlassifizierung, 
  filterObjektTyp,
  setFilterBundesland, 
  setFilterKlassifizierung,
  setFilterObjektTyp,
  objektTypen,
  classificationRules,
  onOpenDetail 
}) {
  return (
    <div className="space-y-4" data-testid="termine-view">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">Alle Termine</h2>
        <p className="text-sm text-[#6B7280] mt-1">Durchsuchen und filtern Sie alle Zwangsversteigerungstermine</p>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar flex flex-wrap items-center gap-4" data-testid="filter-bar">
        <div className="flex items-center gap-2">
          <Funnel size={18} className="text-[#6B7280]" />
          <span className="text-sm font-medium text-[#6B7280]">Filter:</span>
        </div>
        
        <Select value={filterBundesland} onValueChange={setFilterBundesland}>
          <SelectTrigger className="w-[180px]" data-testid="filter-bundesland">
            <SelectValue placeholder="Bundesland" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Bundesländer</SelectItem>
            {Object.entries(BUNDESLAENDER).map(([code, name]) => (
              <SelectItem key={code} value={code}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterKlassifizierung} onValueChange={setFilterKlassifizierung}>
          <SelectTrigger className="w-[180px]" data-testid="filter-klassifizierung">
            <SelectValue placeholder="Klassifizierung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {classificationRules.map(rule => (
              <SelectItem key={rule.id} value={rule.name}>{rule.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterObjektTyp} onValueChange={setFilterObjektTyp}>
          <SelectTrigger className="w-[200px]" data-testid="filter-objekt-typ">
            <SelectValue placeholder="Objekttyp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Objekttypen</SelectItem>
            {objektTypen.map(type => (
              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterBundesland !== "all" || filterKlassifizierung !== "all" || filterObjektTyp !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterBundesland("all");
              setFilterKlassifizierung("all");
              setFilterObjektTyp("all");
            }}
            className="text-[#6B7280]"
            data-testid="clear-filters-btn"
          >
            <X size={16} className="mr-1" />
            Filter zurücksetzen
          </Button>
        )}

        <div className="ml-auto text-sm text-[#6B7280]">
          {foreclosures.length} Ergebnisse
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
            message="Keine Termine gefunden"
            description="Passen Sie Ihre Filter an oder laden Sie neue Daten"
          />
        ) : (
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Aktenzeichen</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead>Gericht</TableHead>
                <TableHead>Bundesland</TableHead>
                <TableHead>Objekttyp</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Verkehrswert</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {foreclosures.map((f) => (
                <TableRow 
                  key={f.id}
                  className="cursor-pointer"
                  onClick={() => onOpenDetail(f)}
                  data-testid={`foreclosure-row-${f.id}`}
                >
                  <TableCell className="font-mono text-sm font-medium">{f.aktenzeichen}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {f.termin_datum}
                    {f.termin_zeit && <span className="text-[#6B7280] ml-1">{f.termin_zeit}</span>}
                  </TableCell>
                  <TableCell className="text-sm">{f.gericht}</TableCell>
                  <TableCell className="text-sm">{f.bundesland}</TableCell>
                  <TableCell className="text-sm">{f.objekt_typ}</TableCell>
                  <TableCell>
                    <Badge className={`${CLASSIFICATION_COLORS[f.klassifizierung] || CLASSIFICATION_COLORS["Sonstiges"]} border-0`}>
                      {f.klassifizierung}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{f.verkehrswert || "-"}</TableCell>
                  <TableCell>
                    <CaretRight size={16} className="text-[#6B7280]" />
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
        toast.success("Regel aktualisiert");
      } else {
        await axios.post(`${API}/classification-rules`, rule);
        toast.success("Regel erstellt");
      }
      setDialogOpen(false);
      setEditingRule(null);
      onRefresh();
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error("Fehler beim Speichern");
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm("Regel wirklich löschen?")) return;
    try {
      await axios.delete(`${API}/classification-rules/${ruleId}`);
      toast.success("Regel gelöscht");
      onRefresh();
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  return (
    <div className="space-y-6" data-testid="klassifizierung-view">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">Klassifizierungsregeln</h2>
          <p className="text-sm text-[#6B7280] mt-1">Definieren Sie, wie Immobilien kategorisiert werden</p>
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
          Neue Regel
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
                <h4 className="font-semibold text-[#111827]">{rule.name}</h4>
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
      toast.error("Bitte Name und mindestens einen Objekttyp angeben");
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
          <DialogTitle>{rule ? "Regel bearbeiten" : "Neue Regel erstellen"}</DialogTitle>
          <DialogDescription>
            Wählen Sie einen Namen und die zugehörigen Objekttypen
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Name der Kategorie</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Wohnhäuser"
              data-testid="rule-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label>Objekttypen</Label>
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
            <Label htmlFor="rule-active">Regel aktiv</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSubmit}
            className="bg-[#0052FF] hover:bg-[#0040CC] text-white"
            data-testid="save-rule-btn"
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Settings Dialog Component
function SettingsDialog({ open, onOpenChange, settings, onSave }) {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedStates, setSelectedStates] = useState(["bw", "by", "he", "rp"]);

  useEffect(() => {
    if (settings) {
      setEmailEnabled(settings.email_notifications_enabled || false);
      setEmail(settings.notification_email || "");
      setSelectedStates(settings.selected_bundeslaender || ["bw", "by", "he", "rp"]);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gear size={20} />
            Einstellungen
          </DialogTitle>
          <DialogDescription>
            Konfigurieren Sie die Datenabfrage und Benachrichtigungen
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Bundesländer Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Bundesländer für Abfrage</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(BUNDESLAENDER).map(([code, name]) => (
                <div key={code} className="flex items-center space-x-2">
                  <Checkbox
                    id={`state-${code}`}
                    checked={selectedStates.includes(code)}
                    onCheckedChange={() => toggleState(code)}
                    data-testid={`state-checkbox-${code}`}
                  />
                  <Label htmlFor={`state-${code}`} className="text-sm cursor-pointer">
                    {name}
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
                <Label className="text-sm font-semibold">E-Mail Benachrichtigungen</Label>
                <p className="text-xs text-[#6B7280] mt-1">
                  Erhalten Sie E-Mails bei neuen Terminen
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
                <Label htmlFor="notification-email" className="text-sm">E-Mail Adresse</Label>
                <div className="flex gap-2">
                  <EnvelopeSimple size={18} className="text-[#6B7280] mt-2" />
                  <Input
                    id="notification-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ihre@email.de"
                    data-testid="notification-email-input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-[#0052FF] hover:bg-[#0040CC] text-white"
            data-testid="save-settings-btn"
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Foreclosure Detail Component
function ForeclosureDetail({ foreclosure }) {
  return (
    <div className="mt-6 space-y-6" data-testid="foreclosure-detail">
      {/* Classification Badge */}
      <Badge className={`${CLASSIFICATION_COLORS[foreclosure.klassifizierung] || CLASSIFICATION_COLORS["Sonstiges"]} border-0 text-sm`}>
        {foreclosure.klassifizierung}
      </Badge>

      {/* Key Info */}
      <div className="grid grid-cols-2 gap-4">
        <DetailItem 
          icon={<Calendar size={18} />} 
          label="Termin" 
          value={`${foreclosure.termin_datum}${foreclosure.termin_zeit ? ` ${foreclosure.termin_zeit}` : ''}`}
          mono
        />
        <DetailItem 
          icon={<Gavel size={18} />} 
          label="Gericht" 
          value={foreclosure.gericht}
        />
        <DetailItem 
          icon={<MapPin size={18} />} 
          label="Bundesland" 
          value={foreclosure.bundesland}
        />
        <DetailItem 
          icon={<House size={18} />} 
          label="Objekttyp" 
          value={foreclosure.objekt_typ}
        />
      </div>

      <Separator />

      {/* Address if available */}
      {(foreclosure.adresse || foreclosure.plz || foreclosure.ort) && (
        <div className="space-y-2">
          <h4 className="overline">Adresse</h4>
          <p className="text-sm">
            {foreclosure.adresse && <span>{foreclosure.adresse}<br /></span>}
            {foreclosure.plz} {foreclosure.ort}
          </p>
        </div>
      )}

      {/* Description */}
      {foreclosure.beschreibung && (
        <div className="space-y-2">
          <h4 className="overline">Beschreibung</h4>
          <p className="text-sm text-[#6B7280]">{foreclosure.beschreibung}</p>
        </div>
      )}

      {/* Verkehrswert */}
      {foreclosure.verkehrswert && (
        <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-4">
          <div className="flex items-center gap-2 text-[#6B7280] text-xs uppercase tracking-wider mb-1">
            <CurrencyEur size={14} />
            Verkehrswert
          </div>
          <div className="text-2xl font-semibold font-mono text-[#111827]">
            {foreclosure.verkehrswert}
          </div>
        </div>
      )}

      {/* Link */}
      {foreclosure.link && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.open(foreclosure.link, '_blank')}
          data-testid="open-portal-link"
        >
          Im ZVG-Portal öffnen
          <CaretRight size={16} className="ml-2" />
        </Button>
      )}
    </div>
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
      <div className="flex items-center gap-1.5 text-[#6B7280]">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-sm text-[#111827] ${mono ? 'font-mono' : ''}`}>{value}</p>
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
