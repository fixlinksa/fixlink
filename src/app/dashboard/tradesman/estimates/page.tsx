'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  FileText, 
  PlusCircle, 
  ArrowLeft, 
  Search, 
  Calendar, 
  User, 
  ChevronRight,
  Clock,
  Trash2,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getJobsByTradesman, Job, updateJob, deleteJob } from '@/lib/db';
import { cn } from '@/lib/utils';

export default function EstimatesHistoryPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [estimates, setEstimates] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!authLoading && user?.uid) {
      loadEstimates();
    }
  }, [authLoading, user?.uid]);

  const loadEstimates = async () => {
    setLoading(true);
    try {
      const data = await getJobsByTradesman(user!.uid);
      // Filter for standalone estimates or jobs in estimated/declined status
      const filtered = data.filter(j => j.status === 'estimated' || j.status === 'declined' || j.isStandalone);
      
      // Lazy deletion/filtering logic: hide if expireAt is in the past
      const now = new Date();
      const active = filtered.filter(j => {
        if (!j.expireAt) return true;
        const expiry = j.expireAt.seconds ? new Date(j.expireAt.seconds * 1000) : new Date(j.expireAt);
        return expiry > now;
      });

      setEstimates(active.sort((a, b) => {
        const aTime = (a.createdAt as any)?.seconds || 0;
        const bTime = (b.createdAt as any)?.seconds || 0;
        return bTime - aTime;
      }));
    } catch (error) {
      console.error("Failed to load estimates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: Job['status']) => {
     try {
        await updateJob(id, { status: newStatus });
        loadEstimates();
     } catch (error) {
        console.error("Failed to update status:", error);
     }
  };

  const handleDelete = async (id: string) => {
     if (!window.confirm("Are you sure you want to permanently delete this estimate? This action cannot be undone.")) return;
     try {
        await deleteJob(id);
        setEstimates(prev => prev.filter(e => e.id !== id));
     } catch (error) {
        console.error("Failed to delete estimate:", error);
     }
  };

  const filteredEstimates = estimates.filter(e => 
    e.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
       <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-12">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div className="flex items-center gap-6">
              <button 
                onClick={() => router.push('/dashboard/tradesman')}
                className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-primary group"
              >
                 <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
              </button>
              <div>
                 <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] mb-2 italic">
                    <span className="w-8 h-[2px] bg-primary"></span>
                    Intelligence Archive
                 </div>
                 <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
                    Saved <span className="text-primary">Estimates</span>
                 </h1>
              </div>
           </div>

           <button 
              onClick={() => router.push('/jobs/view/estimate?id=standalone')}
              className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 shadow-2xl transition-all italic"
            >
               <PlusCircle className="w-5 h-5" /> Draft New Estimate
            </button>
        </div>

        {/* Search & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="md:col-span-2 relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
              <input 
                type="text"
                placeholder="Search encrypted archives by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-8 py-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm outline-none focus:border-primary transition-all font-bold text-slate-600 italic"
              />
           </div>
           <div className="bg-primary/5 border border-primary/10 rounded-[2rem] p-6 flex flex-col justify-center items-center text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1 italic">Active Storage</p>
              <h2 className="text-3xl font-black text-primary italic tracking-tighter">{estimates.length} DRAFTS</h2>
           </div>
        </div>

        {/* Estimates List */}
        <div className="grid grid-cols-1 gap-6">
           <AnimatePresence>
              {filteredEstimates.length > 0 ? filteredEstimates.map((est, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={est.id}
                  onClick={() => router.push(`/jobs/view/estimate?id=${est.id}`)}
                  className="bg-white border border-slate-100 rounded-[3rem] p-8 md:p-10 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group cursor-pointer flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden"
                >
                   <div className="flex items-center gap-8 flex-1 relative z-10">
                      <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                         <FileText className="w-10 h-10" />
                      </div>
                      <div className="space-y-2">
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{est.id.slice(0, 8)}</span>
                            <span className="w-1.5 h-1.5 bg-border rounded-full" />
                            {est.status === 'declined' ? (
                              <span className="px-3 py-1 bg-red-50 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-full border border-red-100">Declined</span>
                            ) : (
                              <span className="text-[10px] font-black text-primary uppercase tracking-widest italic">Stand-alone</span>
                            )}
                         </div>
                         <h3 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 group-hover:text-primary transition-colors">{est.customerName || 'Standard Client'}</h3>
                         <div className="flex flex-wrap gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic opacity-60">
                            <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {est.createdAt?.seconds ? new Date(est.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                            <span className="flex items-center gap-2 text-accent"><Clock className="w-3.5 h-3.5" /> Expires: {est.expireAt?.seconds ? new Date(est.expireAt.seconds * 1000).toLocaleDateString() : '30 Days'}</span>
                         </div>
                      </div>
                   </div>

                   <div className="flex items-center justify-between md:flex-col md:items-end gap-6 relative z-10">
                      <p className={cn(
                        "text-4xl font-black tracking-tighter italic",
                        est.status === 'declined' ? "text-slate-300 line-through" : "text-slate-900"
                      )}>
                        R {est.total || est.estimateAmount || '0.00'}
                      </p>
                      
                      <div className="flex items-center gap-3">
                         {est.status !== 'declined' && (
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleUpdateStatus(est.id, 'declined'); }}
                             className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                             title="Mark as Declined"
                           >
                              <XCircle className="w-5 h-5" />
                           </button>
                         )}
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleDelete(est.id); }}
                           className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                           title="Delete Permanently"
                         >
                            <Trash2 className="w-5 h-5" />
                         </button>
                         <button 
                           onClick={() => router.push(`/jobs/view/estimate?id=${est.id}`)}
                           className="p-4 bg-primary/10 text-primary rounded-2xl hover:bg-primary hover:text-white transition-all shadow-sm"
                         >
                            <ChevronRight className="w-5 h-5" />
                         </button>
                      </div>
                   </div>

                   <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[8rem] group-hover:scale-110 transition-transform" />
                </motion.div>
              )) : (
                <div className="py-20 text-center space-y-6 bg-white rounded-[4rem] border border-slate-100 border-dashed">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertCircle className="w-10 h-10 text-slate-200" />
                   </div>
                   <p className="text-slate-400 font-bold uppercase tracking-[0.2em] italic text-sm">No encrypted estimate archives detected.</p>
                   <button 
                    onClick={() => router.push('/jobs/view/estimate?id=standalone')}
                    className="text-primary font-black uppercase tracking-widest text-[10px] italic border-b-2 border-primary/20 hover:border-primary transition-all pb-1"
                   >
                     Initialize First Deployment
                   </button>
                </div>
              )}
           </AnimatePresence>
        </div>

        {/* Footer Note */}
        <div className="text-center italic opacity-40">
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidential Fix Link Data Stream // End of Archive</p>
        </div>

      </div>
    </div>
  );
}
