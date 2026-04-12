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
  Paintbrush 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { createJob } from '@/lib/db';
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Loader2 } from 'lucide-react';

import { TRADES } from '@/lib/constants';
import LocationSearch from '@/components/jobs/LocationSearch';

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
  const { user } = useAuth();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.1));
        };
      };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const compressedBase64 = await compressImage(file);
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
           {[1, 2, 3, 4].map((i) => (
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
                <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Select Category</h1>
                <p className="text-muted-foreground font-medium italic">Search and select the trades you need.</p>
              </div>

              <div className="relative group">
                <input 
                  type="text"
                  placeholder="Search trades (e.g. Plumbing)..."
                  value={tradeSearch}
                  onChange={(e) => setTradeSearch(e.target.value)}
                  className="w-full p-6 bg-white rounded-2xl border border-border shadow-inner focus:border-primary outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                {filteredTrades.map((trade) => {
                  const isSelected = formData.categories.includes(trade);
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
                      className={`p-5 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-white'
                      }`}
                    >
                      <span className="font-bold text-sm tracking-tight">{trade}</span>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={nextStep}
                disabled={formData.categories.length === 0}
                className="w-full py-5 rounded-2xl bg-primary text-white font-bold shadow-xl shadow-primary/20 flex items-center justify-center disabled:opacity-50 disabled:shadow-none transition-all mt-4"
              >
                Continue <ArrowRight className="ml-2 w-5 h-5" />
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
              <div>
                <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Job & Location</h1>
                <p className="text-muted-foreground font-medium">Where and what needs fixing?</p>
              </div>

              <div className="flex flex-col gap-6">
                 <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-3 block">Task Location (Autocomplete)</label>
                    <LocationSearch 
                      placeholder="Street address, city, etc."
                      onLocationSelect={(address, lat, lng) => {
                        setFormData(prev => ({ ...prev, address, lat, lng }));
                      }}
                    />
                 </div>
                 <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-3 block">Job Title</label>
                    <input 
                      type="text"
                      placeholder="e.g. Broken master bathroom tap"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full p-6 bg-white rounded-2xl border border-border focus:ring-2 focus:ring-primary outline-none font-bold"
                    />
                 </div>
                 <div>
                    <label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground mb-3 block">Description</label>
                    <textarea 
                      placeholder="Give more details about the problem..."
                      rows={5}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full p-6 bg-white rounded-2xl border border-border focus:ring-2 focus:ring-primary outline-none font-bold"
                    />
                 </div>
              </div>

              <button 
                onClick={nextStep}
                disabled={!formData.title || !formData.description || !formData.address}
                className="w-full py-5 rounded-2xl bg-primary text-white font-bold shadow-xl shadow-primary/20 flex items-center justify-center disabled:opacity-50 disabled:shadow-none transition-all"
              >
                Next Section <ArrowRight className="ml-2 w-5 h-5" />
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
                className="w-full py-5 rounded-2xl bg-primary text-white font-bold shadow-xl shadow-primary/20 flex items-center justify-center transition-all mt-4"
              >
                Review Application <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 4 && (
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

              <div className="p-8 rounded-[2.5rem] bg-white border border-border shadow-2xl space-y-6">
                 <div className="flex border-b border-muted pb-4 justify-between font-bold text-sm">
                    <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Primary Category</span>
                    <span className="text-foreground italic">{formData.categories[0]}</span>
                 </div>
                 <div className="flex border-b border-muted pb-4 justify-between font-bold text-sm">
                    <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Location Range</span>
                    <span className="text-foreground italic text-right max-w-[200px] line-clamp-1">{formData.address}</span>
                 </div>
                 <div className="flex justify-between font-bold text-sm">
                    <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Budget Cap</span>
                    <span className="text-foreground italic font-black text-lg">R {formData.budget || 'TBD'}</span>
                 </div>
              </div>

              <button 
                onClick={handlePostJob}
                disabled={isSubmitting}
                className="w-full py-6 rounded-2xl bg-primary text-white font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
                {isSubmitting ? 'Deploying...' : 'Broadcast Mission Globally'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

