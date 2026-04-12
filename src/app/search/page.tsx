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
  Shield
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '@/context/AuthContext';
import { TRADES } from '@/lib/constants';
import { createChatThread, getUsersByRole, getProsByTrade, getDistance } from '@/lib/db';

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
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import('react-leaflet').then((mod) => mod.Tooltip),
  { ssr: false }
);

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
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [pros, setPros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPro, setSelectedPro] = useState<any | null>(null);
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
        const normalized = normalizeTrade(selectedTrade);
        
        // Use specialized query if a trade is selected
        let allPros: any[] = [];
        if (normalized !== 'General Services') {
           allPros = await getProsByTrade(normalized, 
             latParam ? parseFloat(latParam) : undefined, 
             lngParam ? parseFloat(lngParam) : undefined
           );
           
           // BROAD DISCOVERY FALLBACK: If no results for specific trade, fetch all nearby pros
           if (allPros.length === 0) {
              const nearbyPros = await getUsersByRole('tradesman');
              allPros = nearbyPros;
           }
        } else {
           allPros = await getUsersByRole('tradesman');
        }
        
        const baseLat = latParam ? parseFloat(latParam) : -33.9249;
        const baseLng = lngParam ? parseFloat(lngParam) : 18.4241;

        // Map to UI format
        const mappedPros = allPros
          .map(p => {
            // Robust parsing: handle strings and various object formats
            const rawLat = p.location?.lat ?? (Array.isArray(p.location) ? p.location[0] : null);
            const rawLng = p.location?.lng ?? (Array.isArray(p.location) ? p.location[1] : null);
            
            const proLat = typeof rawLat === 'string' ? parseFloat(rawLat) : (typeof rawLat === 'number' ? rawLat : null);
            const proLng = typeof rawLng === 'string' ? parseFloat(rawLng) : (typeof rawLng === 'number' ? rawLng : null);
            const hasLocation = proLat !== null && !isNaN(proLat) && proLng !== null && !isNaN(proLng);
            
            const dist = hasLocation ? getDistance(baseLat, baseLng, proLat, proLng) : 999;
            
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
              location: hasLocation ? [proLat, proLng] : null,
              verified: true,
              tier: p.tier,
              distance: dist,
              isAvailable: p.isAvailable !== false
            };
          })
          .filter(p => p.isAvailable && (p.distance <= 500 || !p.location)); // Only Available pros. Massive discovery radius for diagnostic visibility

        // Filter and sort by distance
        const finalResults = mappedPros.sort((a, b) => a.distance - b.distance);
        setPros(finalResults);
      } catch (error) {
        console.error('Search fetch failed:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPros();
  }, [selectedTrade, latParam, lngParam]); 

  // Filter for both List and Map
  const filteredPros = pros.filter(pro => 
    selectedTrade === 'General Services' || 
    (pro.trades && pro.trades.some((t: string) => t.toLowerCase() === selectedTrade.toLowerCase())) ||
    (pro.trade && pro.trade.toLowerCase() === selectedTrade.toLowerCase())
  );

  // Filter specifically for markers (must have location)
  const mapMarkers = filteredPros.filter(pro => pro.location !== null);

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
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-slate-900 mb-4 uppercase italic">
            Found {filteredPros.length} <span className="text-primary">Professionals</span>
          </h1>
          <p className="text-slate-400 font-bold text-sm uppercase mb-6 flex items-center gap-2">
             <MapPin className="w-4 h-4" /> Results near <span className="text-slate-900">{locationParam}</span>
          </p>
          
          <div className="relative inline-block w-full max-w-sm">
            <button 
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className="flex items-center justify-between w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-900 font-bold hover:border-primary transition-all"
            >
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-primary" />
                <span className="truncate">{selectedTrade}</span>
              </div>
              <motion.div animate={{ rotate: isCategoryOpen ? 180 : 0 }}>
                <Navigation className="w-4 h-4 text-slate-400 rotate-90" />
              </motion.div>
            </button>

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
                        setIsCategoryOpen(false);
                      }}
                      className="px-4 py-3 rounded-xl text-left text-xs font-black uppercase tracking-widest hover:bg-slate-50 hover:text-primary transition-all"
                    >
                      All Services
                    </button>
                    {TRADES.map((trade) => (
                      <button
                        key={trade}
                        onClick={() => {
                          setSelectedTrade(trade);
                          setIsCategoryOpen(false);
                        }}
                        className={`px-4 py-3 rounded-xl text-left text-xs font-black uppercase tracking-widest transition-all ${selectedTrade === trade ? 'bg-primary/5 text-primary' : 'hover:bg-slate-50 text-slate-600 hover:text-primary'}`}
                      >
                        {trade}
                      </button>
                    ))}
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
          {filteredPros.map((pro, index) => (
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

                  <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                    <button 
                      onClick={() => handleContact(pro)}
                      className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Hire Specialist
                    </button>
                    <button 
                      onClick={() => handleContact(pro)}
                      className="w-14 h-14 border-2 border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center hover:border-primary hover:text-primary transition-all"
                    >
                      <MessageSquare className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredPros.length === 0 && (
             <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-8">
                   <SearchIcon className="w-12 h-12 text-muted-foreground opacity-20" />
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-4 lowercase">No pros found nearby.</h2>
                <p className="text-muted-foreground max-w-md font-medium mb-12">
                   Try expanding your search or selecting a different category. We're growing fast!
                </p>
                <Link href="/" className="px-10 py-5 bg-primary text-white rounded-3xl font-black shadow-xl shadow-primary/20">
                   Go Back Home
                </Link>
             </div>
          )}
        </div>

        {/* Dynamic Map - 5 or 12 columns */}
        <div className={`${activeTab === 'map' ? 'lg:col-span-12' : 'lg:col-span-5'} sticky top-32 h-[calc(100vh-140px)] ${activeTab === 'list' ? 'hidden lg:block' : 'col-span-1 block'}`}>
          <div className="w-full h-full bg-slate-100 rounded-[3rem] border border-slate-200 overflow-hidden shadow-2xl relative transition-all duration-500">
            <div className="absolute inset-0 z-0 bg-[#e5e7eb]">
                <MapContainer 
                  center={centerPosition} 
                  zoom={zoomLevel} 
                  style={{ height: '100%', width: '100%' }}
                  {...({ scrollWheelZoom: false } as any)}
                >
                  <MapEffect activeTab={activeTab} markers={mapMarkers} />
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
                      eventHandlers={{
                        click: () => setSelectedPro(pro),
                      }}
                    >
                      <Tooltip permanent direction="top" className="custom-map-tooltip">
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

            {/* Selected Pro Details Card */}
            <AnimatePresence>
              {selectedPro && (
                <motion.div 
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 100 }}
                  className="absolute bottom-10 left-10 right-10 z-[1000]"
                >
                  <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl border border-slate-100 flex items-center gap-6 relative max-w-2xl mx-auto overflow-hidden">
                    <button 
                      onClick={() => setSelectedPro(null)}
                      className="absolute top-4 right-6 text-slate-300 hover:text-slate-600 font-bold text-xl transition-colors"
                    >
                      &times;
                    </button>

                    <div className="w-24 h-24 rounded-3xl overflow-hidden bg-slate-100 shrink-0 shadow-lg flex items-center justify-center">
                       {selectedPro.image ? (
                         <img 
                          src={selectedPro.image} 
                          alt={selectedPro.name} 
                          className="w-full h-full object-cover"
                         />
                       ) : (
                         <User className="w-10 h-10 text-slate-300" />
                       )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight truncate">
                          {selectedPro.name}
                        </h3>
                        <ShieldCheck className="w-5 h-5 text-primary" />
                      </div>
                      
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4 italic opacity-70">
                         {selectedPro.trade}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                        <div className="flex items-center gap-1">
                           <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                           <span className="text-slate-900">{selectedPro.rating.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                           <MapPin className="w-3.5 h-3.5 text-slate-400" />
                           <span>{selectedPro.distance.toFixed(1)}km</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleContact(selectedPro)}
                        className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
                      >
                         Message & Hire
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                    Analyzing <span className="text-primary italic">500km radius</span>...
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
