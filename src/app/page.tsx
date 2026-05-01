'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { 
  ArrowRight, 
  Wrench, 
  Zap, 
  Hammer, 
  Droplets, 
  ShieldCheck, 
  MessageCircle, 
  ClipboardCheck, 
  TrendingUp,
  MapPin,
  CheckCircle2,
  Loader2,
  Sparkles
} from 'lucide-react';
import LocationSearch from '@/components/jobs/LocationSearch';

const categories = [
  { name: 'Plumbing', icon: Droplets, color: '#3B82F6' },
  { name: 'Electrical', icon: Zap, color: '#EAB308' },
  { name: 'Handyman', icon: Hammer, color: '#F97316' },
  { name: 'Painting', icon: Wrench, color: '#8B5CF6' },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [searchLocation, setSearchLocation] = React.useState<{address: string, lat: number, lng: number} | null>(null);
  const [problemDescription, setProblemDescription] = React.useState('');
  const [isDiagnosing, setIsDiagnosing] = React.useState(false);

  const handleSearch = async (category?: string) => {
    if (!searchLocation) {
      if (category) {
        router.push(`/search?category=${encodeURIComponent(category)}`);
        return;
      }
      alert("Please select a location first!");
      return;
    }
    
    let finalCategory = category;

    if (!finalCategory && problemDescription) {
       setIsDiagnosing(true);
       try {
          const res = await fetch('/api/ai/diagnose', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ description: problemDescription })
          });
          if (res.ok) {
             const data = await res.json();
             if (data.suggestedTrades && data.suggestedTrades.length > 0) {
                finalCategory = data.suggestedTrades[0];
             }
          }
       } catch (err) {
          console.error("AI diagnosis failed", err);
       } finally {
          setIsDiagnosing(false);
       }
    }

    const query = new URLSearchParams({
      lat: searchLocation.lat.toString(),
      lng: searchLocation.lng.toString(),
      address: searchLocation.address,
      ...(finalCategory && { category: finalCategory })
    }).toString();
    
    router.push(`/search?${query}`);
  };

  return (
    <main className="flex-1 w-full flex flex-col items-center overflow-x-hidden">
      {/* Hero Section */}
      <section className="w-full relative pt-32 pb-24 lg:pt-48 lg:pb-40 overflow-hidden bg-gradient-to-br from-primary/5 via-white to-accent/5">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-[10%] -left-[5%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute top-[20%] -right-[10%] w-[55%] h-[55%] rounded-full bg-accent/5 blur-[100px]" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 py-2 px-5 rounded-full mb-10 border border-primary/20 shadow-sm">
               <ShieldCheck className="w-4 h-4 text-primary" />
               <span className="text-primary font-black text-[10px] uppercase tracking-[0.2em] italic">Premium Trusted Marketplace</span>
            </div>
            
            <h1 className="text-7xl md:text-8xl font-black leading-[0.85] tracking-tighter text-slate-900 group italic uppercase mb-10">
              REPAIR. <br />
              MAINTAIN. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent transition-all duration-500">THRIVE.</span>
            </h1>
            
            <p className="text-xl text-slate-500 font-bold max-w-lg mb-12 leading-relaxed">
              Connecting quality tradesmen and homeowners. The elite platform for service discovery in South Africa.
            </p>

            <div className="max-w-xl mb-12 flex flex-col gap-4">
               <LocationSearch 
                 onLocationSelect={(address: string, lat: number, lng: number) => setSearchLocation({ address, lat, lng })}
                 placeholder="Where do you need help?"
                 className="shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2rem] border-none py-2"
               />
               <textarea 
                 value={problemDescription}
                 onChange={(e) => setProblemDescription(e.target.value)}
                 placeholder="Describe your problem (e.g. My tap is leaking violently)"
                 className="w-full bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2rem] p-6 text-sm font-bold resize-none outline-none focus:border-primary border border-transparent transition-all h-28"
               />
               <button 
                 onClick={() => handleSearch()}
                 disabled={isDiagnosing}
                 className="w-full py-6 bg-primary text-white rounded-[1.5rem] font-black italic uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:scale-100"
               >
                 {isDiagnosing ? (
                   <>
                     <Loader2 className="w-5 h-5 animate-spin" />
                     FixLink AI Diagnosing...
                   </>
                 ) : (
                   <>
                     <Sparkles className="w-5 h-5" />
                     Search Professionals
                   </>
                 )}
               </button>
            </div>

            <div className="flex items-center gap-8">
               <div className="flex -space-x-4">
                  {[1,2,3,4].map(i => (
                     <div key={i} className="w-12 h-12 rounded-full border-4 border-white overflow-hidden shadow-lg">
                        <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="pro" className="w-full h-full object-cover" />
                     </div>
                  ))}
               </div>
               <div>
                  <p className="text-sm font-black text-slate-900 italic">JOIN 2,000+ PROS</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verified & Active</p>
               </div>
            </div>
          </motion.div>

          <div className="relative lg:block hidden">
            {/* Phone Mockup Frame */}
            <motion.div 
              initial={{ opacity: 0, y: 40, rotate: 2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              className="relative mx-auto w-[320px] h-[640px] bg-slate-900 rounded-[3rem] p-4 shadow-[0_50px_100px_-20px_rgba(30,78,121,0.5)] border-[8px] border-slate-800"
            >
              <div className="w-full h-full bg-white rounded-[2.2rem] overflow-hidden relative">
                <img 
                  src="/images/capetown-preview.png" 
                  alt="Search Map" 
                  className="w-full h-full object-cover" 
                />
                
                {/* Simulated App Header in Phone */}
                <div className="absolute top-0 inset-x-0 p-4 bg-white/80 backdrop-blur-md flex items-center justify-between border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center overflow-hidden">
                      <img src="/FixLinkLogo.png" alt="Logo" className="w-full h-full object-contain mix-blend-multiply" />
                    </div>
                    <span className="text-[8px] font-black text-primary italic uppercase">FIX LINK</span>
                  </div>
                  <div className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-full">
                    <MapPin className="w-3 h-3 text-slate-500" />
                  </div>
                </div>

                {/* Floating Map Marker Simulation */}
                <div className="absolute top-1/2 left-1/4 transform -translate-y-1/2">
                   <div className="relative">
                      <div className="absolute -inset-2 bg-primary/20 rounded-full animate-ping" />
                      <div className="relative w-8 h-8 bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                   </div>
                </div>
              </div>
              
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-slate-800 rounded-full" />
            </motion.div>
            
            {/* Floating UI Elements */}
            <motion.div 
               animate={{ y: [0, -10, 0] }}
               transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
               className="absolute top-20 -right-10 bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 flex items-center gap-4 z-20"
            >
               <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-500/20">
                  <ShieldCheck className="w-6 h-6" />
               </div>
               <div>
                  <p className="text-xs font-black text-slate-900 italic">CERTIFIED</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verified Partner</p>
               </div>
            </motion.div>

            <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-primary rounded-full blur-[100px] opacity-10 -z-10" />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="w-full max-w-7xl py-32 px-6">
        <div className="flex flex-col md:flex-row items-end justify-between mb-20 gap-8">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-black mb-6 uppercase tracking-tight">Need something fixed?</h2>
            <p className="text-xl text-muted-foreground font-medium">Select a category to receive instant quotes from top-rated professionals in your area.</p>
          </div>
          <Link href="/services" className="text-primary font-black flex items-center gap-2 group">
             View all services <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              onClick={() => handleSearch(cat.name)}
              className="group cursor-pointer p-10 rounded-[3.5rem] bg-white border border-border shadow-sm hover:shadow-2xl hover:border-primary/20 hover:-translate-y-3 transition-all flex flex-col items-center text-center relative overflow-hidden active:scale-95"
            >
              <div 
                className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: `${cat.color}15` }}
              >
                <cat.icon className="w-10 h-10" style={{ color: cat.color }} />
              </div>
              <h3 className="font-extrabold text-2xl mb-2">{cat.name}</h3>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Verified Pro</p>
              
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-[4rem]" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Value Prop / How it works */}
      <section className="w-full bg-[#0F172A] text-white py-32 px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-12">
              <h2 className="text-5xl md:text-6xl font-black leading-tight uppercase tracking-tighter">
                Smarter <span className="text-accent italic">Workflow</span>. Better <span className="text-blue-400">Results</span>.
              </h2>
              
              <div className="space-y-12">
                {[
                  { icon: MessageCircle, title: 'Encrypted Chat', desc: 'Securely communicate with tradesmen, share high-res photos, and finalize details without leaving the platform.' },
                  { icon: ClipboardCheck, title: 'Smart Invoicing', desc: 'Generate professional PDF invoices instantly. Track payments and history for tax and warranty purposes.' },
                  { icon: TrendingUp, title: 'Live Progress', desc: 'Track your jobs from start to finish. Know exactly when your pro is arriving and when the job is done.' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-8 group">
                    <div className="w-16 h-16 shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all">
                      <item.icon className="w-7 h-7 text-accent group-hover:text-white" />
                    </div>
                    <div className="space-y-2">
                       <h3 className="font-black text-2xl uppercase tracking-tight">{item.title}</h3>
                       <p className="text-gray-400 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center relative">
                <div className="w-full max-w-sm aspect-[9/18.5] bg-[#000] rounded-[4rem] p-4 shadow-[0_0_80px_-15px_rgba(30,78,121,0.5)] relative border-[12px] border-[#1e293b]">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#1e293b] rounded-b-3xl z-20" />
                   <div className="w-full h-full bg-white rounded-[3rem] overflow-hidden flex flex-col p-6 text-foreground shadow-inner">
                      <div className="flex items-center gap-3 mb-10">
                         <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black">FL</div>
                         <div>
                            <p className="text-sm font-black uppercase tracking-tight">FixLink Support</p>
                            <p className="text-xs text-green-500 font-bold flex items-center gap-1">
                               <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active Now
                            </p>
                         </div>
                      </div>
                       <div className="space-y-4">
                          <div className="max-w-[90%] p-5 rounded-[2rem] rounded-tl-none bg-muted font-bold text-xs uppercase tracking-tight text-slate-600">
                             Hi! We've instantly matched 3 certified plumbers near you in Sea Point.
                          </div>
                          
                          <div className="w-full rounded-[2.5rem] overflow-hidden border border-muted/50 shadow-2xl group-hover:scale-[1.02] transition-transform">
                             <img 
                               src="/chat-map-plumbers.png" 
                               alt="Plumbers found on map" 
                               className="w-full h-auto object-cover" 
                             />
                          </div>

                          <div className="max-w-[85%] p-5 rounded-[2rem] rounded-tr-none bg-primary text-white font-black text-xs uppercase tracking-widest ml-auto shadow-xl shadow-primary/20">
                             Awesome, let's get quotes.
                          </div>
                       </div>
                      <div className="mt-auto py-5 border-t border-border flex items-center gap-3">
                         <div className="flex-1 py-3 px-5 bg-muted rounded-full text-xs font-medium text-muted-foreground">Type here...</div>
                         <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white"><ArrowRight className="w-4 h-4" /></div>
                      </div>
                   </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="w-full py-24 px-6 border-t border-border bg-white">
         <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 items-start">
            <div className="space-y-6">
               <Link href="/" className="flex items-center gap-3 group">
                  <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
                     <img 
                       src="/FixLinkLogo.png" 
                       alt="Fix Link" 
                       className="w-full h-full object-contain group-hover:scale-105 transition-transform mix-blend-multiply" 
                     />
                  </div>
                  <span className="font-black text-2xl tracking-tighter text-primary uppercase">FixLink</span>
               </Link>
               <p className="text-muted-foreground font-medium leading-relaxed max-w-xs">
                  Connecting quality trades people with quality customers. South Africa's premium maintenance marketplace.
               </p>
            </div>
            
            <div className="grid grid-cols-2 gap-12 lg:gap-24">
               <div className="space-y-6">
                  <h4 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Company</h4>
                  <div className="flex flex-col gap-4 text-base font-bold text-foreground">
                    <Link href="/about" className="hover:text-primary transition-colors">About Us</Link>
                    <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
                  </div>
               </div>
               <div className="space-y-6">
                  <h4 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Support</h4>
                  <div className="flex flex-col gap-4 text-base font-bold text-foreground">
                    <a href="mailto:info@fixlink.org.za" className="hover:text-primary transition-colors">info@fixlink.org.za</a>
                  </div>
               </div>
            </div>
            
            <div className="space-y-6 bg-muted/30 p-8 rounded-[2.5rem] border border-muted/50">
               <h4 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Subscribe</h4>
               <p className="text-sm font-medium text-muted-foreground">Get the latest tips for home maintenance.</p>
               <div className="flex gap-2">
                  <input type="text" placeholder="Email" className="bg-white border-transparent p-4 rounded-2xl w-full text-sm outline-none focus:border-primary border transition-all" />
                  <button className="bg-primary text-white p-4 rounded-2xl"><ArrowRight className="w-4 h-4" /></button>
               </div>
            </div>
         </div>
         <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-sm text-muted-foreground font-medium">&copy; 2026 FixLink (Pty) Ltd. All rights reserved.</p>
         </div>
      </footer>
    </main>
  );
}
