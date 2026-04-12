'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Radar, 
  MapPin, 
  Clock, 
  ChevronRight, 
  MessageCircle, 
  Shield, 
  Zap, 
  ArrowLeft,
  Loader2,
  Filter,
  CheckCircle2,
  Star
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getLeads, createChatThread } from '@/lib/db';
import { TIER_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function LeadsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filterTrade, setFilterTrade] = useState(true);

  useEffect(() => {
    if (profile) {
      loadLeads();
    }
  }, [profile]);

  const loadLeads = async () => {
    setScanning(true);
    try {
      const radius = TIER_CONFIG[profile?.tier as keyof typeof TIER_CONFIG]?.radius || 15;
      const data = await getLeads({
        proLat: profile?.location?.lat,
        proLng: profile?.location?.lng,
        radiusKm: radius,
        category: filterTrade ? profile?.trades || profile?.trade : undefined
      });
      setLeads(data);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
      setTimeout(() => setScanning(false), 1500);
    }
  };

  const handleContact = async (lead: any) => {
    if (!user || !profile) return;
    try {
      const chatId = await createChatThread(lead.jobId, lead.customerId, user.uid);
      router.push(`/messages?chatId=${chatId}`);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  if (authLoading || (loading && leads.length === 0)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic animate-pulse">Synchronizing Regional Intelligence...</p>
      </div>
    );
  }

  const radius = TIER_CONFIG[profile?.tier as keyof typeof TIER_CONFIG]?.radius || 15;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-10">
      {/* Header Area */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.back()}
            className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:scale-110 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-accent font-black uppercase tracking-widest text-[10px] mb-1 italic">
              <span className="w-6 h-[2px] bg-accent"></span>
              Live Area Scan
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900">Mission <span className="text-accent">Leads</span></h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setFilterTrade(!filterTrade);
              setLoading(true);
            }}
            className={cn(
              "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3",
              filterTrade ? "bg-slate-900 text-white shadow-xl" : "bg-white border border-slate-100 text-slate-400"
            )}
          >
            <Filter className={cn("w-4 h-4", filterTrade ? "text-accent" : "text-slate-300")} />
            {filterTrade ? "Matching Trades" : "All Leads"}
          </button>
          
          <button 
            onClick={loadLeads}
            disabled={scanning}
            className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <Radar className="w-4 h-4 text-accent" />}
            Rescan area
          </button>
        </div>
      </header>

      {/* Intelligence Banner */}
      <section className="bg-slate-900 rounded-[3rem] p-10 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-[5rem] -mr-32 -mt-32 animate-pulse" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <h2 className="text-white text-xl font-black uppercase italic tracking-tight">Active Coverage: <span className="text-accent">{radius} KM</span></h2>
            <p className="text-slate-400 text-xs font-medium italic max-w-md">Your {profile?.tier} status allows intelligence gathering within a {radius}km radius of your base station.</p>
          </div>
          <div className="flex items-center gap-6 divide-x divide-white/10">
            <div className="px-6 text-center">
              <p className="text-accent text-3xl font-black tracking-tighter italic">{leads.length}</p>
              <p className="text-[9px] font-black uppercase text-white/40 tracking-widest mt-1">Direct Leads</p>
            </div>
            <div className="px-6 text-center">
              <p className="text-white text-3xl font-black tracking-tighter italic">04</p>
              <p className="text-[9px] font-black uppercase text-white/40 tracking-widest mt-1">High Value</p>
            </div>
          </div>
        </div>
      </section>

      {/* Leads Feed */}
      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="popLayout">
          {leads.map((lead, index) => (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
               className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-accent/20 transition-all flex flex-col md:flex-row items-start md:items-center gap-8 relative overflow-hidden cursor-pointer"
               onClick={() => router.push(`/jobs/view?id=${lead.jobId}`)}
            >
              {/* Highlight bar for trade matches */}
              {profile?.trades?.includes(lead.category) && (
                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-accent" />
              )}
              
              <div className="w-20 h-20 rounded-[1.5rem] bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform overflow-hidden relative">
                {lead.images?.[0] ? (
                  <img src={lead.images[0]} className="w-full h-full object-cover" alt="Lead visual" />
                ) : (
                  <Zap className="w-8 h-8 text-slate-300" />
                )}
                {profile?.trades?.includes(lead.category) && (
                  <div className="absolute -top-1 -right-1 p-1.5 bg-accent rounded-bl-xl border-l border-b border-white">
                    <Star className="w-3 h-3 text-white fill-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500">{lead.category}</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-accent italic">
                    <MapPin className="w-3.5 h-3.5" /> {lead.distance?.toFixed(1) || '?'} KM AWAY
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{lead.title}</h3>
                <p className="text-sm text-slate-500 font-medium line-clamp-2 italic leading-relaxed">{lead.description}</p>
              </div>

              <div className="w-full md:w-auto flex flex-col gap-3 min-w-[200px]">
                <button 
                  onClick={() => handleContact(lead)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-accent hover:shadow-xl transition-all active:scale-95"
                >
                  <MessageCircle className="w-4 h-4" /> Deploy Comms
                </button>
                <div className="flex items-center justify-center gap-4 text-[9px] font-black text-slate-300 uppercase tracking-widest italic pt-2">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> SECURED 2H AGO</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {leads.length === 0 && !loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-32 flex flex-col items-center justify-center text-center space-y-6"
          >
            <div className="w-24 h-24 rounded-[2.5rem] bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
              <Radar className="w-10 h-10 text-slate-200" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase italic">No Active Signals</h3>
              <p className="text-sm text-slate-400 font-medium italic max-w-sm">Regional intelligence reveals no pending missions within your current {radius}km detection range.</p>
            </div>
            <button 
              onClick={() => router.push('/dashboard/tradesman')}
              className="text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/20 pb-1 hover:border-primary transition-all italic"
            >
              Return to HQ
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
