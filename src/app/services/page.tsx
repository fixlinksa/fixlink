'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ArrowRight, 
  ChevronRight, 
  Sparkles,
  ShieldCheck,
  Star
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TRADE_CATEGORIES } from '@/lib/trades-config';
import Navbar from '@/components/shared/navbar';

export default function ServicesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const router = useRouter();

  // Unified search and filter logic
  const filteredCategories = useMemo(() => {
    let result = TRADE_CATEGORIES;
    
    // Filter by active category
    if (activeCategory !== 'all') {
      result = result.filter(cat => cat.id === activeCategory);
    }

    // Filter by search query
    if (searchQuery) {
      result = result.map(cat => ({
        ...cat,
        trades: cat.trades.filter(trade => 
          trade.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.trades.length > 0);
    }

    return result;
  }, [searchQuery, activeCategory]);

  const handleTradeClick = (tradeName: string) => {
    const query = new URLSearchParams({ category: tradeName }).toString();
    router.push(`/search?${query}`);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      {/* Premium Hero Section */}
      <section className="relative pt-40 pb-24 overflow-hidden bg-[#0F172A] text-white">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-0">
          <div className="absolute -top-[10%] -left-[5%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute top-[20%] -right-[10%] w-[55%] h-[55%] rounded-full bg-accent/10 blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 py-2 px-5 rounded-full mb-8 backdrop-blur-sm"
          >
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-white font-black text-[10px] uppercase tracking-[0.2em] italic">Full Ecosystem Capability</span>
          </motion.div>
          
          <h1 className="text-6xl md:text-8xl font-black leading-tight tracking-tighter uppercase italic mb-8">
            Our <span className="text-accent">Specialized</span> <br />
            Service <span className="text-blue-400">Network</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto mb-12">
            Explore 47 high-performance trade categories. From mission-critical repairs to premium home renovations.
          </p>

          {/* Integrated Search Bar */}
          <div className="max-w-2xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-[2rem] blur opacity-25 group-focus-within:opacity-50 transition-opacity" />
            <div className="relative flex items-center bg-white rounded-3xl overflow-hidden shadow-2xl">
              <Search className="ml-8 w-6 h-6 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search for a specific trade (e.g. Electrician, Tiler...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-7 px-6 text-slate-900 font-bold outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Category Navigation (Sticky) */}
      <div className="sticky top-20 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 py-4 overflow-x-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-4">
          <button 
            onClick={() => setActiveCategory('all')}
            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
              activeCategory === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            All Services
          </button>
          {TRADE_CATEGORIES.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${
                activeCategory === cat.id ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <cat.icon className="w-4 h-4" />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Directory Display */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-6 py-20">
        <div className="space-y-24">
          {filteredCategories.map((category) => (
            <motion.div 
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-12"
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10 shadow-inner">
                  <category.icon className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900">{category.name}</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Available Nationwide</p>
                </div>
                <div className="flex-1 h-px bg-slate-200 ml-4 hidden md:block" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.trades.map((trade, idx) => (
                  <motion.div
                    key={trade.name}
                    whileHover={{ y: -5, scale: 1.02 }}
                    className="group cursor-pointer bg-white p-8 rounded-[2.5rem] border border-slate-200 hover:border-primary/30 shadow-sm hover:shadow-2xl transition-all relative overflow-hidden"
                    onClick={() => handleTradeClick(trade.name)}
                  >
                    <div className="flex items-start justify-between relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                        <trade.icon className="w-7 h-7" />
                      </div>
                      <div className="flex items-center gap-1 bg-green-50 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase italic tracking-widest">
                        <ShieldCheck className="w-3 h-3" /> Active
                      </div>
                    </div>

                    <div className="mt-8 relative z-10">
                      <h3 className="text-xl font-black tracking-tight text-slate-900 group-hover:text-primary transition-colors leading-tight mb-2">
                        {trade.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                        Instant Quotes <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </p>
                    </div>

                    <div className="absolute bottom-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                      <trade.icon className="w-24 h-24" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
               <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-10 h-10 text-slate-300" />
               </div>
               <h3 className="text-2xl font-black text-slate-900 uppercase italic">No Specializations Found</h3>
               <p className="text-slate-400 font-bold mt-2">Try searching for a different keyword like "Electrical" or "Pipe"</p>
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary py-24 px-6 text-white text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent opacity-10 rounded-full blur-[100px] -mr-48 -mt-48" />
        <div className="max-w-4xl mx-auto relative z-10 space-y-8">
          <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter leading-none">
            Can't find your <span className="text-accent">mission</span> category?
          </h2>
          <p className="text-lg font-medium opacity-80">
            Our AI engine can diagnose any maintenance issue and match you with the right elite professional.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <button 
              onClick={() => router.push('/#hero')}
              className="px-10 py-5 bg-white text-primary font-black rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 uppercase tracking-widest text-xs"
            >
              Try AI Diagnosis <Sparkles className="w-4 h-4" />
            </button>
            <button className="px-10 py-5 bg-primary-dark border border-white/20 text-white font-black rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs">
              Contact Command Center
            </button>
          </div>
        </div>
      </section>

      <footer className="w-full py-12 px-6 border-t border-slate-200 bg-white text-center">
        <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.2em]">Validated FixLink Ecosystem • Build 2.0</p>
      </footer>
    </main>
  );
}
