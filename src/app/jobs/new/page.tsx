'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  ArrowRight, 
  Camera, 
  MapPin, 
  CheckCircle2, 
  Droplets, 
  Zap, 
  Hammer, 
  Paintbrush,
  Sparkles,
  AlertTriangle,
  Wrench,
  Activity,
  Search,
  ShieldCheck,
  Hammer as HammerIcon,
  Droplets as WaterIcon,
  Home,
  Grid
} from 'lucide-react';


import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createJob } from '@/lib/db';
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { TRADES } from '@/lib/constants';
import LocationSearch from '@/components/jobs/LocationSearch';
import { smartCompressImage } from '@/lib/image-utils';

const TRADE_ICONS: Record<string, any> = {
  "Plumbers": Droplets,
  "Electricians (Domestic & Industrial)": Zap,
  "Carpenters (Rough & Finishing)": Hammer,
  "Painters & Decorators (Interior & Exterior)": Paintbrush,
  "Handymen (General Maintenance)": Wrench,
  "Pool Maintenance & Repair Technicians": Droplets,
  "Security System & CCTV Installers": ShieldCheck,
  "Solar & Inverter Installers": Zap,
  "Gardeners & Landscapers": Sparkles,
  "Air Conditioning & HVAC Technicians": Activity,
  "Locksmiths": ShieldCheck,
  "Tilers (Wall & Floor)": Grid,
  "Bricklayers": Hammer,
  "Roofing Specialists (Thatch, Tile, & Sheet Metal)": Home,
};



export default function NewJobPage() {
  const [step, setStep] = useState(1);
  const [tradeSearch, setTradeSearch] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    categories: [] as string[],
    description: '',
    budget: '',
    images: [] as string[],
    address: '',
    lat: null as number | null,
    lng: null as number | null
  });
  
  const filteredTrades = TRADES.filter(t => 
    t.toLowerCase().includes(tradeSearch.toLowerCase())
  );

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const { user } = useAuth();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAnalyzeProblem = async () => {
    if (!formData.description || formData.description.length < 10) return;
    
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: formData.description })
      });
      
      const contentType = res.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");

      if (!res.ok) {
        if (res.status === 429) {
          alert("The Strategic Intelligence engine is cooling down. Please wait 30 seconds.");
          return;
        }
        
        let errorMessage = "Intelligence Protocol Failure";
        if (isJson) {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } else {
          const text = await res.text();
          console.error("Non-JSON error response:", text);
        }
        throw new Error(errorMessage);
      }

      if (!isJson) {
        throw new Error("Received invalid response from intelligence server.");
      }

      const data = await res.json();
      setAiResult(data);
      setFormData(prev => ({ 
        ...prev, 
        title: data.proposedTitle || prev.title,
        categories: data.suggestedTrades && data.suggestedTrades.length > 0 
          ? data.suggestedTrades 
          : prev.categories
      }));
      nextStep();
    } catch (err: any) {
      console.error("AI Analysis failed:", err);
      alert(`AI Analysis Offline: ${err.message || 'Please select categories manually.'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const compressedBase64 = await smartCompressImage(file);
      const storageRef = ref(storage, `jobs/${user.uid}/${Date.now()}-${file.name}`);
      await uploadString(storageRef, compressedBase64, 'data_url');
      const url = await getDownloadURL(storageRef);
      setFormData(prev => ({ ...prev, images: [...prev.images, url] }));
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePostJob = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const job = await createJob({
        title: formData.title,
        description: formData.description,
        categories: formData.categories,
        category: formData.categories[0], // Backwards compat
        budget: formData.budget,
        images: formData.images,
        customerId: user.uid,
        customerName: user.displayName || 'Customer',
        customerEmail: user.email || '',
        status: 'pending',
        location: {
          address: formData.address,
          lat: formData.lat,
          lng: formData.lng
        },
      });
      router.push(`/jobs/view?id=${job.id}`);
    } catch (err) {
      console.error("Post job failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };
  const router = useRouter();

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="min-h-screen bg-background flex flex-col p-6">
      <header className="flex items-center justify-between mb-10">
        <button onClick={() => step > 1 ? prevStep() : router.back()} className="p-3 rounded-2xl bg-white border border-border shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-1.5">
           {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${
                 step >= i ? 'w-8 bg-primary' : 'w-4 bg-muted'
              }`} />
           ))}
        </div>
        <div className="w-11" /> {/* Spacer */}
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-8"
            >
              <div>
                <h1 className="text-3xl font-black mb-2 tracking-tight uppercase italic">What's the <span className="text-primary">Problem?</span></h1>
                <p className="text-muted-foreground font-medium italic">Explain what needs fixing in your own words. Our AI will analyze the best approach.</p>
              </div>

              <div className="space-y-4">
                <textarea 
                  autoFocus
                  placeholder="e.g. My pool pump is making a high-pitched screaming noise and there are bubbles coming out of the jets..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-8 bg-white rounded-[2.5rem] border border-border shadow-2xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-lg min-h-[250px] leading-relaxed transition-all"
                />
              </div>

              <button 
                onClick={handleAnalyzeProblem}
                disabled={formData.description.length < 15 || isAnalyzing}
                className="w-full py-6 rounded-2xl bg-primary text-white font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
                {isAnalyzing ? 'Analyzing Mission...' : 'Run Analysis'}
              </button>

              <button 
                onClick={nextStep}
                className="w-full py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all hover:bg-slate-200"
              >
                Skip to Manual Selection
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-8"
            >
              {aiResult && (
                <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                  {/* Glowing background effect */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full -mr-32 -mt-32 transition-all group-hover:bg-primary/30" />
                  
                  <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] italic shadow-lg",
                      aiResult.urgency === 'Emergency' ? 'bg-red-500 text-white shadow-red-500/20' : 
                      aiResult.urgency === 'High' ? 'bg-orange-500 text-white shadow-orange-500/20' : 
                      'bg-primary text-white shadow-primary/20'
                    )}>
                      {aiResult.urgency} Urgency
                    </div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Strategic Intelligence Analysis</div>
                  </div>

                  <h3 className="text-2xl font-black uppercase italic leading-tight mb-6 relative z-10">{aiResult.proposedTitle}</h3>
                  
                  <p className="text-slate-400 text-sm font-medium italic mb-8 leading-relaxed relative z-10">
                    "{aiResult.analysis}"
                  </p>

                  {aiResult.potentialParts?.length > 0 && (
                    <div className="space-y-3 relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Probable Components Required</p>
                      <div className="flex flex-wrap gap-2">
                        {aiResult.potentialParts.map((part: string) => (
                          <div key={part} className="px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-bold text-slate-300 backdrop-blur-sm transition-colors hover:bg-white/10">
                            + {part}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}


              <div>
                <h1 className="text-2xl font-black mb-2 tracking-tight uppercase italic">Confirm <span className="text-primary">Categories</span></h1>
                <p className="text-muted-foreground font-medium italic mb-6">The AI identified these experts as the best fit for your mission.</p>
                
                {aiResult?.suggestedTrades?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    {aiResult.suggestedTrades.map((trade: string) => {
                      const isSelected = formData.categories.includes(trade);
                      const Icon = TRADE_ICONS[trade] || Wrench;
                      return (
                        <button
                          key={`suggested-${trade}`}
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              categories: isSelected 
                                ? prev.categories.filter(id => id !== trade)
                                : [...prev.categories, trade]
                            }));
                          }}
                          className={cn(
                            "relative p-8 rounded-[2.5rem] border-2 text-left transition-all group overflow-hidden shadow-sm hover:shadow-xl hover:scale-[1.02]",
                            isSelected ? "border-primary bg-primary/5 shadow-primary/10" : "border-slate-100 bg-white"
                          )}
                        >
                          <div className="flex flex-col gap-5 relative z-10">
                            <div className={cn(
                              "w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all duration-500 group-hover:rotate-12",
                              isSelected ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                            )}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Recommended Force</p>
                              <h4 className="font-black text-base leading-tight italic">{trade}</h4>
                            </div>
                          </div>
                          
                          {isSelected && (
                            <div className="absolute top-8 right-8">
                              <CheckCircle2 className="w-6 h-6 text-primary" />
                            </div>
                          )}
                          
                          {/* Subtle background decoration */}
                          <div className={cn(
                            "absolute -bottom-6 -right-6 w-24 h-24 opacity-[0.03] transition-all duration-700 group-hover:scale-125 group-hover:-rotate-12",
                            isSelected ? "text-primary" : "text-slate-900"
                          )}>
                            <Icon className="w-full h-full" />
                          </div>
                        </button>
                      );
                    })}

                  </div>
                )}
              </div>

              <div className="relative group">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Search className="w-4 h-4" />
                </div>
                <input 
                  type="text"
                  placeholder="Manual trade search..."
                  value={tradeSearch}
                  onChange={(e) => setTradeSearch(e.target.value)}
                  className="w-full p-6 pl-14 bg-white rounded-2xl border border-border shadow-inner focus:border-primary outline-none font-bold italic"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                {filteredTrades.map((trade) => {
                  const isSelected = formData.categories.includes(trade);
                  const isAiSuggested = aiResult?.suggestedTrades?.includes(trade);
                  
                  return (
                    <button
                      key={trade}
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          categories: isSelected 
                            ? prev.categories.filter(id => id !== trade)
                            : [...prev.categories, trade]
                        }));
                      }}
                      className={cn(
                        "p-5 rounded-2xl border-2 transition-all flex items-center justify-between gap-4",
                        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-white',
                        isAiSuggested && !isSelected && 'border-primary/30 border-dashed bg-primary/5'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm tracking-tight">{trade}</span>
                        {isAiSuggested && (
                          <div className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase rounded-md italic">Recommended</div>
                        )}
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={nextStep}
                disabled={formData.categories.length === 0}
                className="w-full py-5 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 flex items-center justify-center disabled:opacity-50 transition-all mt-4"
              >
                Continue Mission <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-8"
            >
              <div>
                <h1 className="text-3xl font-black mb-2 tracking-tight uppercase italic italic">Deployment <span className="text-primary">Zone</span></h1>
                <p className="text-muted-foreground font-medium italic">Where and what needs fixing?</p>
              </div>

              <div className="flex flex-col gap-6">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block italic">Task Location (Autocomplete)</label>
                    <LocationSearch 
                      placeholder="Street address, city, etc."
                      onLocationSelect={(address, lat, lng) => {
                        setFormData(prev => ({ ...prev, address, lat, lng }));
                      }}
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block italic">Job Title (AI Suggested)</label>
                    <input 
                      type="text"
                      placeholder="e.g. Broken master bathroom tap"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full p-6 bg-white rounded-2xl border border-border focus:ring-2 focus:ring-primary outline-none font-bold italic"
                    />
                 </div>
              </div>

              <button 
                onClick={nextStep}
                disabled={!formData.title || !formData.address}
                className="w-full py-5 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 flex items-center justify-center disabled:opacity-50 transition-all"
              >
                Proceed to Specs <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-8"
            >
              <div>
                <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Budget & Photos</h1>
                <p className="text-muted-foreground font-medium italic">Photos help you get more accurate quotes.</p>
              </div>

              <div className="flex flex-col gap-10">
                 <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-3 block">Estimated Budget (Optional)</label>
                    <div className="relative">
                       <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-muted-foreground italic">R</span>
                       <input 
                        type="number"
                        placeholder="0.00"
                        value={formData.budget}
                        onChange={(e) => setFormData({...formData, budget: e.target.value})}
                        className="w-full p-6 pl-12 bg-white rounded-2xl border border-border shadow-inner focus:ring-2 focus:ring-primary outline-none font-black italic text-lg"
                       />
                    </div>
                 </div>

                  <div className="grid grid-cols-3 gap-3">
                    {formData.images.map((url, idx) => (
                      <div key={idx} className="aspect-square rounded-2xl bg-muted overflow-hidden relative group">
                        <img src={url} alt="Job" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setFormData(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))}
                          className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-black"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    
                    {formData.images.length < 6 && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="aspect-square rounded-2xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-all text-muted-foreground"
                      >
                        {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                        <span className="text-[10px] font-bold uppercase tracking-widest">{isUploading ? 'Syncing...' : 'Add Photo'}</span>
                      </button>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                    />
                  </div>
              </div>

              <button 
                onClick={nextStep}
                className="w-full py-5 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 flex items-center justify-center transition-all mt-4"
              >
                Final Review <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-8"
            >
              <div className="text-center flex flex-col items-center">
                <div className="w-20 h-20 rounded-3xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500 mb-6 shadow-glow">
                   <CheckCircle2 className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-extrabold mb-2 tracking-tight text-foreground uppercase italic">Mission <span className="text-primary">Ready</span></h1>
                <p className="text-muted-foreground text-center font-medium max-w-sm italic">
                   Deploying: <span className="font-bold text-foreground">"{formData.title}"</span>
                </p>
              </div>

              <div className="p-10 rounded-[3rem] bg-slate-900 text-white border border-white/5 shadow-2xl space-y-8 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
                 
                 <div className="flex border-b border-white/5 pb-6 justify-between items-center">
                    <div>
                      <span className="text-slate-500 uppercase tracking-[0.2em] text-[9px] font-black block mb-1">Target Force</span>
                      <div className="flex flex-wrap gap-2">
                        {formData.categories.map((cat, i) => (
                          <span key={i} className="text-white italic font-black text-sm">
                            {cat}{i < formData.categories.length - 1 ? ',' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                       <Zap className="w-6 h-6 text-primary" />
                    </div>
                 </div>

                 
                 <div className="flex border-b border-white/5 pb-6 justify-between items-center">
                    <div>
                      <span className="text-slate-500 uppercase tracking-[0.2em] text-[9px] font-black block mb-1">Deployment Zone</span>
                      <span className="text-white italic font-bold text-sm line-clamp-1">{formData.address}</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                       <MapPin className="w-6 h-6 text-slate-400" />
                    </div>
                 </div>

                 <div className="flex justify-between items-center">
                    <div>
                      <span className="text-slate-500 uppercase tracking-[0.2em] text-[9px] font-black block mb-1">Financial Allocation</span>
                      <span className="text-white italic font-black text-2xl">R {formData.budget || 'TBD'}</span>
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest italic",
                      formData.budget ? "bg-green-500/20 text-green-400 border border-green-500/20" : "bg-white/5 text-slate-500"
                    )}>
                      {formData.budget ? 'Capped' : 'Uncapped'}
                    </div>
                 </div>
              </div>

              <button 
                onClick={handlePostJob}
                disabled={isSubmitting}
                className="w-full py-7 rounded-[2rem] bg-primary text-white font-black uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(var(--primary-rgb),0.3)] flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 group"
              >
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    <Zap className="w-6 h-6 fill-current transition-transform group-hover:scale-125" />
                    <span className="text-lg">Deploy Mission</span>
                  </>
                )}
              </button>

            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

