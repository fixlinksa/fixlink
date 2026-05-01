'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Camera, 
  MapPin, 
  CheckCircle2, 
  Loader2,
  Trash2,
  Save
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getJob, updateJob } from '@/lib/db';
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import LocationSearch from '@/components/jobs/LocationSearch';

import { Suspense } from 'react';

function EditJobContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const id = searchParams.get('id');
  
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      if (!id || typeof id !== 'string') {
        router.push('/dashboard/customer');
        return;
      }
      const data = await getJob(id);
      if (!data || data.customerId !== user?.uid) {
        router.push('/dashboard/customer');
        return;
      }
      if (data.status !== 'pending') {
        alert("This job is active and cannot be edited.");
        router.push(`/jobs/view?id=${id}`);
        return;
      }
      setFormData({
        title: data.title,
        description: data.description,
        budget: data.budget || '',
        images: data.images || [],
        address: typeof data.location === 'object' ? data.location?.address : data.location || '',
        lat: typeof data.location === 'object' ? data.location?.lat : null,
        lng: typeof data.location === 'object' ? data.location?.lng : null
      });
      setLoading(false);
    }
    if (user) load();
  }, [id, user]);

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
      setFormData((prev: any) => ({ ...prev, images: [...prev.images, url] }));
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!user || !formData || !id) return;
    setIsSubmitting(true);
    try {
      await updateJob(id, {
        title: formData.title,
        description: formData.description,
        budget: formData.budget,
        images: formData.images,
        location: {
          address: formData.address,
          lat: formData.lat,
          lng: formData.lng
        }
      });
      router.push(`/jobs/view?id=${id}`);
    } catch (err) {
      console.error("Update failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col p-6">
      <header className="flex items-center justify-between mb-10 max-w-xl mx-auto w-full">
        <button onClick={() => router.back()} className="p-4 rounded-2xl bg-white border border-border shadow-sm">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Edit <span className="text-primary">Job</span></h1>
        <div className="w-11" />
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full space-y-10">
        <section className="space-y-6">
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Target Location</label>
              <LocationSearch 
                placeholder="Update address..."
                className="w-full"
                onLocationSelect={(address, lat, lng) => setFormData({...formData, address, lat, lng})}
              />
              <p className="text-[9px] text-slate-400 italic mt-1 px-4">Current: {formData.address}</p>
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Job Title</label>
              <input 
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full p-6 bg-white rounded-3xl border border-border outline-none focus:ring-4 focus:ring-primary/5 font-bold transition-all"
              />
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Problem Brief</label>
              <textarea 
                rows={6}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full p-6 bg-white rounded-[2rem] border border-border outline-none focus:ring-4 focus:ring-primary/5 font-medium transition-all"
              />
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Budget Cap (Optional)</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-300 italic">R</span>
                <input 
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData({...formData, budget: e.target.value})}
                  className="w-full p-6 pl-12 bg-white rounded-3xl border border-border outline-none focus:ring-4 focus:ring-primary/5 font-black italic text-lg"
                />
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Visual Evidence</label>
              <div className="grid grid-cols-3 gap-4">
                 {formData.images.map((url: string, idx: number) => (
                    <div key={idx} className="aspect-square rounded-[1.5rem] bg-slate-100 relative group overflow-hidden border border-border">
                       <img src={url} className="w-full h-full object-cover" />
                       <button 
                        onClick={() => setFormData({...formData, images: formData.images.filter((_:any, i:any) => i !== idx)})}
                        className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                       >
                          ×
                       </button>
                    </div>
                 ))}
                 {formData.images.length < 6 && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="aspect-square rounded-[1.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-all text-slate-400"
                    >
                       {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                       <span className="text-[8px] font-black uppercase tracking-widest">{isUploading ? 'Syncing...' : 'Add Photo'}</span>
                    </button>
                 )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleImageUpload} accept="image/*" />
           </div>
        </section>

        <button 
          onClick={handleUpdate}
          disabled={isSubmitting || !formData.title || !formData.description || !formData.address}
          className="w-full py-6 bg-primary text-white rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Deploy Strategy Update
        </button>

        <p className="text-center text-[9px] font-black uppercase text-slate-400 tracking-widest italic pb-12">
          Note: Edits are locked once a professional accepts the job.
        </p>
      </main>
    </div>
  );
}

export default function EditJobPage() {
  return (
    <Suspense fallback={
       <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
       </div>
    }>
       <EditJobContent />
    </Suspense>
  );
}
