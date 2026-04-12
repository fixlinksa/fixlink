'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { TIER_CONFIG, TierId } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { updateUserProfile } from '@/lib/db';
import { 
  Check, 
  Zap, 
  Star, 
  ShieldCheck, 
  Clock, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TierSelector({ onComplete }: { onComplete?: () => void }) {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const [showTrialModal, setShowTrialModal] = useState<{ tierId: TierId; name: string } | null>(null);

  const handleUpgrade = async (tierId: TierId) => {
    if (!user || !profile) return;
    const tierName = tierId === 'missing' ? 'Link Pro' : 'Link Legend';
    setShowTrialModal({ tierId, name: tierName });
  };

  const confirmElevation = async () => {
    if (!showTrialModal || !user || !profile) return;
    
    setLoading(showTrialModal.tierId);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      await updateUserProfile(user.uid, {
        tier: showTrialModal.tierId,
        tierStatus: 'trial',
        tierTrialExpiresAt: expiresAt,
        preTrialTier: profile.tier || 'starter'
      });
      
      setShowTrialModal(null);
      if (onComplete) {
        onComplete();
      } else {
        router.push('/dashboard/tradesman');
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
    } finally {
      setLoading(null);
    }
  };

  const tiers = [
    {
      ...TIER_CONFIG.starter,
      icon: ShieldCheck,
      description: 'The foundation for your professional journey.',
      features: ['15km Visibility Radius', 'Basic Profile', 'Lead Access']
    },
    {
      ...TIER_CONFIG.missing,
      icon: Zap,
      description: 'Power up your business with full invoicing and estimates.',
      features: ['50km Visibility Radius', 'Unlimited Invoices', 'Unlimited Estimates', '150 Inventory Items']
    },
    {
      ...TIER_CONFIG.legend,
      icon: Star,
      description: 'The ultimate professional ecosystem with regional flexibility.',
      features: ['70km Visibility Radius', 'Show Public Ratings', 'Regional Flexibility', '500 Inventory Items']
    }
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
        {tiers.map((tier) => {
          const isCurrent = profile?.tier === tier.id && profile?.tierStatus === 'active';
          const isTrial = profile?.tier === tier.id && profile?.tierStatus === 'trial';
          const isDisabled = tier.id === 'starter' || isCurrent || isTrial;

          return (
            <motion.div
              key={tier.id}
              whileHover={!isDisabled ? { y: -5 } : {}}
              className={cn(
                "p-8 rounded-[2.5rem] border bg-white flex flex-col justify-between transition-all relative overflow-hidden",
                isCurrent ? "border-primary shadow-xl ring-1 ring-primary/20" : 
                isTrial ? "border-accent shadow-xl ring-1 ring-accent/20" : "border-slate-100 shadow-sm"
              )}
            >
              {isTrial && (
                <div className="absolute top-4 right-4 bg-accent/10 text-accent px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 z-10">
                  <Clock className="w-3 h-3" /> Trial Active
                </div>
              )}
              
              <div>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mb-6",
                  tier.id === 'starter' ? "bg-slate-100 text-slate-500" :
                  tier.id === 'missing' ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                )}>
                  <tier.icon className="w-6 h-6" />
                </div>
                
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">{tier.name}</h3>
                <p className="text-slate-500 text-xs font-medium leading-relaxed mb-6">{tier.description}</p>
                
                <div className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-green-500" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleUpgrade(tier.id as TierId)}
                disabled={isDisabled || loading !== null}
                className={cn(
                  "w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 italic",
                  isCurrent ? "bg-slate-50 text-slate-400 cursor-default" :
                  isTrial ? "bg-accent/10 text-accent cursor-default" :
                  tier.id === 'starter' ? "bg-slate-50 text-slate-400 cursor-default" :
                  "bg-slate-900 text-white hover:bg-primary hover:scale-[1.02] active:scale-95 shadow-xl shadow-black/10"
                )}
              >
                {loading === tier.id ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isCurrent ? (
                  "Current Plan"
                ) : isTrial ? (
                  "Trialing"
                ) : (
                  <>
                    Start 14-Day Trial <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Trial Elevation Modal */}
      <AnimatePresence>
        {showTrialModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 sm:p-12">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTrialModal(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] p-10 md:p-14 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-accent" />
              
              <div className="flex flex-col items-center text-center space-y-8">
                <div className="w-20 h-20 rounded-[2rem] bg-accent/10 flex items-center justify-center text-accent">
                  <Zap className="w-10 h-10 fill-current" />
                </div>
                
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent italic">Enterprise Elevation</p>
                  <h2 className="text-4xl font-black uppercase italic tracking-tighter">14-Day <span className="text-primary">Trial</span></h2>
                </div>

                <div className="space-y-6 text-left">
                  <div className="flex gap-5 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Star className="w-5 h-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black uppercase tracking-tight italic">Full Platform Access</p>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">During the trial, you'll have access to all leads, invoices, and advanced business features.</p>
                    </div>
                  </div>

                  <div className="flex gap-5 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black uppercase tracking-tight italic">Admin Approval Required</p>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">After 14 days, your tier will revert to Starter unless an administrator approves the upgrade.</p>
                    </div>
                  </div>
                </div>

                <div className="w-full flex flex-col gap-4">
                  <button 
                    onClick={confirmElevation}
                    disabled={loading !== null}
                    className="w-full py-5 bg-primary text-white rounded-3xl font-black uppercase tracking-widest text-xs italic shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? "Elevating..." : "Elevate to " + showTrialModal.name} <ArrowRight className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setShowTrialModal(null)}
                    className="w-full py-5 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
