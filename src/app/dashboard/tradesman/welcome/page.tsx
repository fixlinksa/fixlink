'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Zap, 
  Star, 
  CheckCircle2, 
  ArrowRight,
  MapPin,
  Package,
  FileText,
  TrendingUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { TIER_CONFIG } from '@/lib/constants';
import { updateUserProfile } from '@/lib/db';

export default function WelcomePage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const handleSelectTier = async (tierId: string) => {
    if (!user?.uid) return;
    
    const updates: any = { 
      hasSeenWelcome: true,
      tier: tierId 
    };

    // If upgrading to Gold or Platinum, start a 14-day trial if they haven't had one
    if (tierId !== 'starter' && !profile?.trialStartDate) {
      updates.tierStatus = 'trial';
      updates.trialStartDate = new Date();
    }

    await updateUserProfile(user.uid, updates);
    router.push('/dashboard/tradesman');
  };

  const handleStart = () => handleSelectTier('starter');

  const tiers: any[] = [
    {
      ...TIER_CONFIG.starter,
      icon: Zap,
      description: "Essential intelligence for the focused professional.",
      pros: TIER_CONFIG.starter.features,
      current: profile?.tier === 'starter' || !profile?.tier,
      highlight: false,
      action: "Stay on Starter"
    },
    {
      ...TIER_CONFIG.gold,
      icon: ShieldCheck,
      description: "Advanced operational tools for scaling efficiency.",
      pros: TIER_CONFIG.gold.features,
      current: profile?.tier === 'gold',
      highlight: true,
      action: "Start 14-Day Trial"
    },
    {
      ...TIER_CONFIG.platinum,
      icon: Star,
      description: "Regional dominance and maximum operational reach.",
      pros: TIER_CONFIG.platinum.features,
      current: profile?.tier === 'platinum',
      highlight: false,
      action: "Start 14-Day Trial"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-primary/30 py-20 px-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-primary/10 rounded-full blur-[10rem] -mr-64 -mt-64 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-accent/5 rounded-full blur-[8rem] -ml-48 -mb-48" />

      <div className="max-w-7xl mx-auto relative z-10 text-center space-y-16">
        {/* Welcome Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-center gap-3 text-primary font-black uppercase tracking-[0.4em] text-[10px] italic">
             <span className="w-12 h-[2px] bg-primary"></span>
             Operational Intelligence
             <span className="w-12 h-[2px] bg-primary"></span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic leading-[0.9]">
            Welcome to the <br />
            <span className="text-primary">Hero</span> Network
          </h1>
          <p className="text-xl text-slate-500 font-bold max-w-2xl mx-auto italic leading-relaxed">
            Your profile is active. Deploy now with a <span className="text-accent">14-day free trial</span> on any premium tier, or continue with essential discovery.
          </p>
        </motion.div>

        {/* Tier Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((t, i) => (
            <motion.div 
              key={t.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-10 rounded-[4rem] border transition-all duration-500 group relative overflow-hidden flex flex-col justify-between text-left ${
                t.highlight 
                ? 'bg-white border-accent shadow-[0_0_50px_rgba(249,115,22,0.15)] z-10 scale-105' 
                : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
              }`}
            >
              {t.highlight && (
                <div className="absolute top-0 right-0 px-8 py-3 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-bl-3xl italic">
                  Recommended Deployment
                </div>
              )}

              <div>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-10 transition-transform duration-500 group-hover:scale-110 ${
                  t.highlight ? 'bg-accent/10 text-accent' : 'bg-slate-50 text-slate-400'
                }`}>
                  <t.icon className="w-8 h-8" />
                </div>
                
                <h3 className="text-3xl font-black uppercase italic mb-4 tracking-tighter text-slate-900">{t.name}</h3>
                <p className={`text-sm font-bold italic mb-10 leading-relaxed ${t.highlight ? 'text-slate-600' : 'text-slate-500'}`}>
                  {t.description}
                </p>

                <div className="space-y-4 mb-12">
                  {t.pros.map((pro: string, j: number) => (
                    <div key={j} className="flex items-center gap-3">
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${t.highlight ? 'text-accent' : 'text-slate-400'}`} />
                      <span className={`text-xs font-black uppercase tracking-widest italic ${t.highlight ? 'text-slate-900' : 'text-slate-500'}`}>{pro}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => handleSelectTier(t.id)} 
                  className={`w-full py-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all italic ${
                    t.highlight 
                    ? 'bg-accent text-white hover:scale-105 shadow-xl shadow-accent/20' 
                    : t.id === 'starter'
                    ? 'bg-slate-900 text-white hover:scale-105 shadow-xl'
                    : 'bg-slate-100 text-slate-600 hover:scale-105 hover:bg-slate-200'
                  }`}
                >
                  {t.action} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Final CTA */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="pt-10 relative z-20"
        >
          <button 
            onClick={handleStart}
            className="px-16 py-8 bg-white border-2 border-slate-200 text-slate-400 rounded-[2.5rem] font-black text-[10px] uppercase tracking-[0.3em] italic hover:scale-105 active:scale-95 transition-all mx-auto flex items-center gap-3"
          >
            Skip for now, launch with Starter <ArrowRight className="w-4 h-4" />
          </button>
          <p className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
            Fix Link Hero Protocol • Secure Environment
          </p>
        </motion.div>
      </div>
    </div>
  );
}
