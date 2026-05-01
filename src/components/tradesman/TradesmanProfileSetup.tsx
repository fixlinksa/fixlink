'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, 
  MapPin, 
  Building2, 
  ArrowRight, 
  CheckCircle2,
  Droplets,
  Zap,
  Hammer,
  Paintbrush
} from 'lucide-react';
import LocationSearch from '@/components/jobs/LocationSearch';
import { updateUserProfile } from '@/lib/db';
import { cn } from '@/lib/utils';

const trades = [
  { id: 'Plumbing', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'Electrical', icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { id: 'Handyman', icon: Hammer, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'Painting', icon: Paintbrush, color: 'text-purple-500', bg: 'bg-purple-50' },
];

interface TradesmanProfileSetupProps {
  userId: string;
  onComplete: () => void;
}

export default function TradesmanProfileSetup({ userId, onComplete }: TradesmanProfileSetupProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    trades: [] as string[],
    address: '',
    location: { lat: 0, lng: 0 },
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    accountType: '',
    branchCode: ''
  });

  const handleNext = async () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      setLoading(true);
      try {
        await updateUserProfile(userId, {
          businessName: formData.businessName,
          trade: formData.trades[0] || '', // Primary trade for backwards compat
          trades: formData.trades,
          address: formData.address,
          location: formData.location,
          bankName: formData.bankName,
          accountHolder: formData.accountHolder,
          accountNumber: formData.accountNumber,
          accountType: formData.accountType,
          branchCode: formData.branchCode,
        });
        onComplete();
      } catch (error) {
        console.error("Error updating profile:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-xl flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 md:p-12 rounded-[2rem] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-[#FFD700] to-orange-500" />
        
        {/* Progress Indicators */}
        <div className="flex justify-between items-center px-4 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex-1 flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                step >= s ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-300'
              }`}>
                {s}
              </div>
              {s < 4 && (
                <div className={`h-1 flex-1 mx-2 rounded-full transition-all ${
                  step > s ? 'bg-primary/50' : 'bg-slate-50'
                }`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">Your Trade</h2>
                <p className="text-muted-foreground font-medium">Select your primary area of expertise.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {trades.map((t) => {
                  const isSelected = formData.trades.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          trades: isSelected 
                            ? prev.trades.filter(id => id !== t.id)
                            : [...prev.trades, t.id]
                        }));
                      }}
                      className={cn(
                        "p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 group px-4 text-center",
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/20 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110", t.bg)}>
                         <t.icon className={cn("w-8 h-8", t.color)} />
                      </div>
                      <span className="font-bold text-sm tracking-wide uppercase">{t.id}</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <button 
                disabled={formData.trades.length === 0}
                onClick={handleNext}
                className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">Business Info</h2>
                <p className="text-muted-foreground font-medium">How should customers see your business?</p>
              </div>
              <div className="space-y-4">
                <div className="relative group">
                  <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary" />
                  <input 
                    type="text"
                    placeholder="Company Name (e.g. Pro Plumbing Co)"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium tracking-wide transition-all shadow-sm"
                  />
                </div>
              </div>
              <button 
                disabled={!formData.businessName}
                onClick={handleNext}
                className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">Service Area</h2>
                <p className="text-muted-foreground font-medium">Set your business location to find local leads (70km radius).</p>
              </div>
              <LocationSearch 
                onLocationSelect={(address, lat, lng) => setFormData({ ...formData, address, location: { lat, lng } })}
                placeholder="Business Address"
                className="shadow-inner"
              />
              <button 
                disabled={!formData.address}
                onClick={handleNext}
                className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >

              <div>
                <h2 className="text-3xl font-black tracking-tight mb-2 uppercase italic">Banking Details</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Prints directly on your Estimates & Invoices</p>
              </div>
              
              <div className="space-y-4">
                 <input 
                   type="text"
                   placeholder="Bank Name (e.g. FNB)"
                   value={formData.bankName}
                   onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                   className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold transition-all shadow-sm"
                 />
                 <input 
                   type="text"
                   placeholder="Account Holder Name"
                   value={formData.accountHolder}
                   onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                   className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold transition-all shadow-sm"
                 />
                 <input 
                   type="text"
                   placeholder="Account Number"
                   value={formData.accountNumber}
                   onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                   className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold transition-all shadow-sm"
                 />
                  <input 
                    type="text"
                    placeholder="Account Type (e.g. Savings)"
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold transition-all shadow-sm"
                  />
                  <input 
                    type="text"
                    placeholder="Branch Code"
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold transition-all shadow-sm"
                  />
              </div>

              <button 
                disabled={loading}
                onClick={handleNext}
                className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? "Saving..." : "Start Working"} <CheckCircle2 className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
