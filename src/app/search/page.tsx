'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  MapPin, 
  Star, 
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  SearchIcon,
  User,
  Shield,
  Phone,
  Mail,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '@/context/AuthContext';
import { TRADES } from '@/lib/constants';
import { createChatThread, getUsersByRole, getProsByTrade, getDistance, extractCoordinates } from '@/lib/db';

// Helper to normalize search categories to exact database trade labels
const normalizeTrade = (query: string): string => {
  const q = query.toLowerCase();
  if (q === 'general services') return 'General Services';
  
  // Mapping of common categories to exact TRADES list entries
  const mapping: { [key: string]: string } = {
    'plumbing': 'Plumbers',
    'electrical': 'Electricians (Domestic & Industrial)',
    'handyman': 'Handymen (General Maintenance)',
    'painting': 'Painters & Decorators (Interior & Exterior)',
    'carpentry': 'Carpenters (Rough & Finishing)',
    'cooling': 'Air Conditioning & HVAC Technicians',
    'security': 'Security System & CCTV Installers',
    'roofing': 'Roofing Specialists (Thatch, Tile, & Sheet Metal)',
  };

  if (mapping[q]) return mapping[q];
  
  // Fuzzy match against TRADES list
  const closest = TRADES.find(t => t.toLowerCase().includes(q) || q.includes(t.toLowerCase().split(' ')[0].toLowerCase()));
  return closest || query;
};

const ContactButtons = ({ pro, className = "" }: { pro: any, className?: string }) => {
  const phone = pro.phone || pro.contactPhone;
  const whatsappUrl = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : '#';
  const telUrl = phone ? `tel:${phone}` : '#';
  const mailUrl = pro.email ? `mailto:${pro.email}` : '#';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {phone && (
        <>
          <a 
            href={whatsappUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-green-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="w-5 h-5" />
          </a>
          <a 
            href={telUrl} 
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-primary/20"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="w-5 h-5" />
          </a>
        </>
      )}
      {pro.email && (
        <a 
          href={mailUrl} 
          className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-black/20"
          onClick={(e) => e.stopPropagation()}
        >
          <Mail className="w-5 h-5" />
        </a>
      )}
    </div>
  );
};

// Dynamically import Leaflet with no SSR and proper typing
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const ZoomControl = dynamic(
  () => import('react-leaflet').then((mod) => mod.ZoomControl),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import('react-leaflet').then((mod) => mod.Tooltip),
  { ssr: false }
) as any;

// Map initialization is handled within the component to prevent SSR errors

// Search results will be fetched from Firestore real-time

// Helper to handle map resizing and fitting when layout/results change
const MapEffect = ({ activeTab, markers }: { activeTab: string; markers: any[] }) => {
  const map = (require('react-leaflet') as any).useMap();
  
  React.useEffect(() => {
    // Invalidate size on tab change to fix Leaflet rendering issues
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [activeTab, map]);

  React.useEffect(() => {
    if (markers.length > 0) {
      const L = require('leaflet');
      // Filter out any markers that might have invalid coordinates during rendering
      const validPoints = markers
        .filter(m => m.location && Array.isArray(m.location))
        .map(m => m.location as [number, number]);
      
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [markers, map]);

  return null;
};

function SearchResultsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q') || searchParams.get('category') || 'General Services';
  const locationParam = searchParams.get('address') || searchParams.get('loc') || 'Central Cape Town';
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('map');
  const [selectedTrade, setSelectedTrade] = useState<string>(queryParam);
  const [tradeSearch, setTradeSearch] = useState<string>('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [pros, setPros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapIcons, setMapIcons] = useState<any>(null);

  // Initialize Leaflet icons safely on the client
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const L = require('leaflet');
      const icons = {
        default: L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        }),
        center: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      };
      L.Marker.prototype.options.icon = icons.default;
      setMapIcons(icons);
    }
  }, []);

  // Dynamic Center based on search params
  const centerPosition: any = latParam && lngParam 
    ? [parseFloat(latParam), parseFloat(lngParam)]
    : [-33.9249, 18.4241];
  
  const zoomLevel = latParam && lngParam ? 14 : 12;

  React.useEffect(() => {
    const fetchPros = async () => {
      setLoading(true);
      try {
        // 1. Fetch professionals using the Optimized Discovery Engine
        let allPros: any[] = [];
        const normalized = normalizeTrade(selectedTrade);
        
        if (normalized !== 'General Services') {
           allPros = await getProsByTrade(
             normalized, 
             latParam ? parseFloat(latParam) : undefined, 
             lngParam ? parseFloat(lngParam) : undefined
           );
        } else {
           // If 'General Services', fetch all nearby with the same proximity rules
           allPros = await getProsByTrade(
             'General Services',
             latParam ? parseFloat(latParam) : undefined, 
             lngParam ? parseFloat(lngParam) : undefined
           );
        }
        
        const baseLat = latParam ? parseFloat(latParam) : -33.9249;
        const baseLng = lngParam ? parseFloat(lngParam) : 18.4241;

        // 2. Map Result to UI Schema (TRUSTING the 70km filter from db.ts)
        const mappedPros = allPros.map(p => {
          const coords = extractCoordinates(p.location);
          const hasLocation = coords !== null;
          
          return {
            id: p.id,
            name: p.fullName || p.businessName || 'Pro',
            trade: p.trade || (p.trades && p.trades[0]) || 'Generalist',
            trades: p.trades || [p.trade].filter(Boolean),
            rating: p.rating || 5.0,
            reviews: p.reviewCount || 0,
            description: p.businessName || 'Professional trade specialist registered on Fix Link.',
            image: p.imageUrl || null,
            featured: p.tier === 'legend',
            location: hasLocation ? [coords.lat, coords.lng] : null,
            verified: true,
            tier: p.tier,
            distance: p.distance ?? 999,
            isAvailable: p.isAvailable !== false
          };
        });

        // 3. Final Deployment synchronization
        setPros(mappedPros);
      } catch (error) {
        console.error('Search fetch failed:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPros();
  }, [selectedTrade, latParam, lngParam]); 

  // Filter specifically for markers (must have location)
  // We trust 'pros' which is already filtered by normalized trade and 70km radius in fetchPros
  const mapMarkers = pros.filter(pro => pro.location !== null);

  const handleContact = async (pro: any) => {
    if (!user) {
      router.push(`/login?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    
    try {
      // Use a special jobId prefix for search-initiated contacts without a specific job yet
      const inquiryJobId = `inquiry_${pro.id}`;
      await createChatThread(inquiryJobId, user.uid, pro.id);
      router.push('/chat');
    } catch (err) {
      console.error("Failed to start chat:", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs mb-3">
            <span className="w-8 h-[2px] bg-primary"></span>
            Search Results
          </div>
            <h1 className="text-4xl font-black text-slate-900 leading-tight italic tracking-tighter uppercase">
              {pros.length} {pros.length === 1 ? 'Expert' : 'Experts'} <span className="text-primary tracking-normal">Found</span>
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
               <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest px-3 py-1 bg-slate-100 rounded-full">
                 Fleet Sync: <span className="text-primary italic">Localized Discovery active</span>
               </p>
               <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest px-3 py-1 bg-slate-100 rounded-full">
                 Radius: <span className="text-primary italic">Strict 70km</span>
               </p>
               <p className="text-slate-400 font-bold text-[8px] uppercase tracking-widest px-2 py-0.5 border border-slate-100 rounded-md">
                 Ver: 1.0.4-Sync
               </p>
            </div>
          <p className="text-slate-400 font-bold text-sm uppercase mb-6 flex items-center gap-2">
             <MapPin className="w-4 h-4" /> Results near <span className="text-slate-900">{locationParam}</span>
          </p>
          
          <div className="relative inline-block w-full max-w-sm">
            <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-primary group-focus-within:scale-110 transition-transform" />
              <input 
                type="text"
                placeholder="Type and select trade..."
                value={isCategoryOpen ? tradeSearch : selectedTrade}
                onFocus={() => {
                  setTradeSearch('');
                  setIsCategoryOpen(true);
                }}
                onChange={(e) => setTradeSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 p-6 rounded-2xl pl-14 text-sm font-bold outline-none focus:border-primary transition-all shadow-sm"
              />
            </div>

            <AnimatePresence>
              {isCategoryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute z-50 left-0 right-0 mt-2 p-4 bg-white rounded-3xl border border-slate-100 shadow-2xl max-h-96 overflow-y-auto"
                >
                  <div className="grid grid-cols-1 gap-1">
                    <button
                      onClick={() => {
                        setSelectedTrade('General Services');
                        setTradeSearch('');
                        setIsCategoryOpen(false);
                      }}
                      className="px-4 py-3 rounded-xl text-left text-xs font-black uppercase tracking-widest hover:bg-slate-50 hover:text-primary transition-all"
                    >
                      All Services
                    </button>
                    {TRADES.filter(t => t.toLowerCase().includes(tradeSearch.toLowerCase())).map((trade) => (
                      <button
                        key={trade}
                        onClick={() => {
                          setSelectedTrade(trade);
                          setTradeSearch(trade);
                          setIsCategoryOpen(false);
                        }}
                        className={`px-4 py-3 rounded-xl text-left text-xs font-black uppercase tracking-widest transition-all ${selectedTrade === trade ? 'bg-primary/5 text-primary' : 'hover:bg-slate-50 text-slate-600 hover:text-primary'}`}
                      >
                        {trade}
                      </button>
                    ))}
                    {TRADES.filter(t => t.toLowerCase().includes(tradeSearch.toLowerCase())).length === 0 && (
                      <p className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 italic">No matching trades</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('list')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${activeTab === 'list' ? 'bg-white shadow-md text-primary scale-95' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ListView
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${activeTab === 'map' ? 'bg-white shadow-md text-primary scale-95' : 'text-slate-500 hover:text-slate-700'}`}
          >
           MapView
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Results Sidebar / Content - 7 columns */}
        <div className={`lg:col-span-7 space-y-6 ${activeTab === 'map' ? 'hidden' : 'block'}`}>
          {pros.map((pro, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={pro.id}
              className="group bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-primary/5 transition-all relative overflow-hidden"
            >
              {pro.featured && (
                <div className="absolute top-0 right-0 px-8 py-2 bg-accent text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-bl-3xl shadow-lg">
                  Top Rated
                </div>
              )}
              
              <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-48 h-48 rounded-[2rem] overflow-hidden bg-slate-100 relative shadow-inner flex items-center justify-center">
                  {pro.image ? (
                    <img src={pro.image} alt={pro.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <User className="w-12 h-12 text-slate-300" />
                  )}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/90 backdrop-blur-md rounded-xl shadow-lg flex items-center gap-1">
                    <Star className="w-3 h-3 text-accent fill-accent" />
                    <span className="text-[10px] font-black">{pro.rating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">{pro.name}</h3>
                        {pro.verified && <CheckCircle2 className="w-5 h-5 text-primary" />}
                      </div>
                      <p className="text-primary font-black uppercase tracking-widest text-[10px] italic">{pro.trade}</p>
                    </div>

                  <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 font-medium">
                    {pro.description}
                  </p>

                  <div className="flex flex-wrap gap-3 py-2">
                    <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                       <MapPin className="w-3 h-3 text-primary" /> {pro.distance ? pro.distance.toFixed(1) : '0.0'} km away
                    </div>
                    <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                       <ShieldCheck className="w-3 h-3 text-primary" /> Verified Pro
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 gap-4">
                      <div className="flex-1">
                        <button 
                          onClick={() => handleContact(pro)}
                          className="w-full py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          Message & Hire
                        </button>
                      </div>
                      <ContactButtons pro={pro} />
                    </div>
                </div>
              </div>
            </motion.div>
          ))}

          {pros.length === 0 && (
             <div className="flex flex-col items-center justify-center py-24 px-6 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 shadow-xl">
                   <Navigation className="w-10 h-10 text-primary animate-pulse" />
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-4 italic uppercase">No Experts in Range</h2>
                <div className="max-w-md space-y-4 mb-10">
                   <p className="text-slate-500 font-bold leading-relaxed">
                      We strictly scan within a <span className="text-primary italic">70km radius</span> of 
                      <span className="text-slate-900 ml-1 italic">{locationParam.split(',')[0]}</span>.
                   </p>
                   <p className="text-slate-400 text-sm">
                      There are currently no <span className="text-slate-900">{selectedTrade}</span> specialists 
                      visible in this exact zone.
                   </p>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  <button 
                    onClick={() => {
                      setTradeSearch('General Services');
                      setIsCategoryOpen(true);
                    }}
                    className="px-8 py-5 bg-primary text-white rounded-3xl font-black shadow-xl shadow-primary/20 hover:scale-[1.05] transition-all uppercase text-xs tracking-widest"
                  >
                    Try Broad Category
                  </button>
                  <Link href="/" className="px-8 py-5 bg-white border-2 border-slate-200 text-slate-900 rounded-3xl font-black shadow-lg hover:bg-slate-50 transition-all uppercase text-xs tracking-widest">
                    Change Location
                  </Link>
                </div>
             </div>
          )}
        </div>

        {/* Dynamic Map - 5 or 12 columns */}
        <div className={`${activeTab === 'map' ? 'lg:col-span-12' : 'lg:col-span-5'} sticky top-32 h-[calc(100vh-140px)] ${activeTab === 'list' ? 'hidden lg:block' : 'col-span-1 block'}`}>
          <div className="w-full h-full bg-slate-100 rounded-[3rem] border border-slate-200 overflow-hidden shadow-2xl relative transition-all duration-500">
            <div className="absolute inset-0 z-0 bg-[#e5e7eb]">
                <MapContainer 
                  key={`${latParam}-${lngParam}-${selectedTrade}`}
                  center={centerPosition} 
                  zoom={zoomLevel} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                  {...({ 
                    scrollWheelZoom: true,
                    touchZoom: true,
                    dragging: true,
                    doubleClickZoom: true
                  } as any)}
                >
                  <MapEffect activeTab={activeTab} markers={mapMarkers} />
                  <ZoomControl position="bottomright" />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    {...({} as any)}
                  />
                  
                   {/* Search Center Reference Marker */}
                   {latParam && lngParam && mapIcons && !isNaN(parseFloat(latParam)) && !isNaN(parseFloat(lngParam)) && (
                     <Marker position={[parseFloat(latParam), parseFloat(lngParam)] as [number, number]} {...({ icon: mapIcons.center } as any)}>
                       <Popup>
                         <div className="p-2 font-black text-primary uppercase text-[10px] tracking-[0.2em] text-center border-b border-slate-100 mb-2 italic">
                           Search Center
                         </div>
                         <div className="text-slate-900 font-bold text-center text-xs">
                           {locationParam}
                         </div>
                       </Popup>
                     </Marker>
                   )}

                   {mapMarkers.map(pro => (
                    <Marker 
                      key={pro.id} 
                      position={pro.location as any}
                    >
                      <Tooltip 
                        permanent={true} 
                        direction="top" 
                        className="custom-map-tooltip"
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black uppercase tracking-tighter text-slate-900 bg-white px-2 py-0.5 rounded shadow-sm">
                            {pro.name}
                          </span>
                          <span className="text-[7px] font-black uppercase tracking-widest text-primary bg-white/90 px-1 rounded-sm mt-0.5">
                            {pro.trade?.split(' ')[0]}
                          </span>
                        </div>
                      </Tooltip>
                      <Popup>
                        <div className="w-[280px] bg-white rounded-[2rem] overflow-hidden -m-[1px]">
                          {/* Pro Header Image */}
                          <div className="h-28 w-full relative overflow-hidden bg-slate-100 flex items-center justify-center">
                             {pro.image || pro.companyLogoUrl ? (
                               <img 
                                 src={pro.image || pro.companyLogoUrl} 
                                 alt={pro.name} 
                                 className="w-full h-full object-cover"
                               />
                             ) : (
                               <User className="w-8 h-8 text-slate-300" />
                             )}
                             <div className="absolute top-3 right-3 px-3 py-1 bg-white/90 backdrop-blur-md rounded-lg shadow-sm flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 text-accent fill-accent" />
                                <span className="text-[10px] font-black">{pro.rating?.toFixed(1) || '5.0'}</span>
                             </div>
                          </div>
                          
                          {/* Content */}
                          <div className="p-5 space-y-4">
                             <div>
                                <h4 className="font-black text-slate-900 uppercase italic tracking-tight leading-none mb-1">{pro.name}</h4>
                                <p className="text-[9px] font-black text-primary uppercase tracking-widest italic opacity-70">
                                   {pro.trade || (pro.trades && pro.trades[0])}
                                </p>
                             </div>

                             <div className="flex items-center gap-3">
                                <div className="flex-1 py-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center gap-2">
                                   <MapPin className="w-3 h-3 text-primary" />
                                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                      {pro.distance ? `${pro.distance.toFixed(1)}km` : 'Nearby'}
                                   </span>
                                </div>
                                <div className="flex-1 py-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center gap-2">
                                   <ShieldCheck className="w-3 h-3 text-primary" />
                                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Verified</span>
                                </div>
                             </div>

                             <button 
                               onClick={() => handleContact(pro)}
                               className="w-full py-4 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-center"
                             >
                                Message & Hire
                             </button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
            </div>

            {/* Overlays */}
            <div className="absolute top-6 left-6 right-6 z-10 pointer-events-none flex flex-col gap-3">
              <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-2xl shadow-black/10 border border-white/50 w-fit">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Navigation className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] italic">Scan Complete</p>
                    <p className="text-xs font-black text-slate-900 truncate max-w-[150px]">{locationParam.split(',')[0]}</p>
                  </div>
                </div>
              </div>

              {/* Diagnostic Counter */}
              <div className="bg-primary text-white rounded-xl px-4 py-2 w-fit shadow-xl text-[10px] font-black uppercase tracking-widest italic animate-bounce">
                {mapMarkers.length} Professionals Visible
              </div>
            </div>

            <div className="absolute bottom-6 right-6 z-10 w-64 flex flex-col gap-3 pointer-events-none">
               <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-5 shadow-2xl border border-white/10 pointer-events-auto">
                  <div className="flex items-center justify-between mb-3">
                     <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] italic">System Status</p>
                     <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-glow"></span>
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Live</span>
                     </div>
                  </div>
                  <p className="text-white font-bold text-xs leading-relaxed opacity-80 mb-4">
                    Analyzing <span className="text-primary italic">70km radius</span>...
                  </p>
                  <button className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/40 hover:scale-[1.02] active:scale-95 transition-all">
                    Refine Search Area
                  </button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <Search className="w-10 h-10 text-primary opacity-20" />
        </motion.div>
      </div>
    }>
      <SearchResultsContent />
    </Suspense>
  );
}
