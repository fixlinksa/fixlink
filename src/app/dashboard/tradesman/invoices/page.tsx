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
  ShieldCheck,
  AlertCircle,
  Wallet,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getJobsByTradesman, Job, deleteJob, markJobAsPaid } from '@/lib/db';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock } from 'lucide-react';

export default function InvoicesHistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'outstanding' | 'paid'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user?.uid) {
      loadInvoices();
    }
  }, [authLoading, user?.uid]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await getJobsByTradesman(user!.uid);
      // Filter for standalone invoices or jobs already invoiced
      const filtered = data.filter(j => j.status === 'invoiced' || j.status === 'completed');
      
      setInvoices(filtered.sort((a, b) => {
        const aTime = (a.createdAt as any)?.seconds || 0;
        const bTime = (b.createdAt as any)?.seconds || 0;
        return bTime - aTime;
      }));
    } catch (error) {
      console.error("Failed to load invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
     if (!window.confirm("Are you sure you want to permanently delete this invoice record? This action cannot be undone.")) return;
     try {
        await deleteJob(id);
        setInvoices(prev => prev.filter(e => e.id !== id));
     } catch (error) {
        console.error("Failed to delete invoice:", error);
     }
  };

  const handleMarkAsPaid = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Mark this invoice as fully paid?")) return;
    
    setActionLoading(id);
    try {
      await markJobAsPaid(id);
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, isPaid: true, amountPaid: inv.total || inv.amount || 0 } : inv));
    } catch (error) {
      console.error("Failed to mark as paid:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredInvoices = invoices.filter(e => {
    const matchesSearch = e.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filter === 'outstanding') return !e.isPaid;
    if (filter === 'paid') return e.isPaid;
    return true;
  });

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
                    Revenue Archive
                 </div>
                 <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
                    Saved <span className="text-primary">Invoices</span>
                 </h1>
              </div>
           </div>

           <button 
              onClick={() => router.push('/jobs/view/invoice?id=standalone')}
              className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 shadow-2xl transition-all italic"
            >
               <PlusCircle className="w-5 h-5" /> Issue New Invoice
            </button>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col gap-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 relative group">
                 <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
                 <input 
                   type="text"
                   placeholder="Search revenue archives by name or ID..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full pl-16 pr-8 py-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm outline-none focus:border-primary transition-all font-bold text-slate-600 italic"
                 />
              </div>
              <div className="bg-primary/5 border border-primary/10 rounded-[2rem] p-6 flex flex-col justify-center items-center text-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1 italic">Filtered Revenue Stream</p>
                 <h2 className="text-3xl font-black text-primary italic tracking-tighter">{filteredInvoices.length} INVOICES</h2>
              </div>
           </div>

           <div className="flex p-2 bg-slate-100/50 rounded-[2rem] w-fit">
              {[
                { id: 'all', label: 'All Invoices' },
                { id: 'outstanding', label: 'Outstanding' },
                { id: 'paid', label: 'Paid' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as any)}
                  className={cn(
                    "px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all italic",
                    filter === tab.id 
                      ? "bg-white text-primary shadow-sm" 
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {tab.label}
                </button>
              ))}
           </div>
        </div>

        {/* Invoices List */}
        <div className="grid grid-cols-1 gap-6">
           <AnimatePresence>
              {filteredInvoices.length > 0 ? filteredInvoices.map((inv, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={inv.id}
                  onClick={() => router.push(`/jobs/view/invoice?id=${inv.id}`)}
                  className="bg-white border border-slate-100 rounded-[3rem] p-8 md:p-10 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group cursor-pointer flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden"
                >
                   <div className="flex items-center gap-8 flex-1 relative z-10">
                      <div className={cn(
                        "w-20 h-20 border rounded-[2rem] flex items-center justify-center transition-all duration-500",
                        inv.isPaid 
                          ? "bg-green-50 border-green-100 text-green-500" 
                          : "bg-slate-50 border-slate-100 text-slate-300 group-hover:bg-primary group-hover:text-white"
                      )}>
                         {inv.isPaid ? <CheckCircle2 className="w-10 h-10" /> : <Wallet className="w-10 h-10" />}
                      </div>
                      <div className="space-y-2">
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{inv.id.slice(0, 8)}</span>
                            <span className="w-1.5 h-1.5 bg-border rounded-full" />
                            {inv.isPaid ? (
                              <span className="text-[10px] font-black text-green-500 uppercase tracking-widest italic flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3" /> Paid In Full
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic flex items-center gap-1.5">
                                <Clock className="w-3 h-3" /> Payment Pending
                              </span>
                            )}
                         </div>
                         <h3 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 group-hover:text-primary transition-colors">{inv.customerName || 'Standard Client'}</h3>
                         <div className="flex flex-wrap gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic opacity-60">
                            <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Issued: {inv.createdAt?.seconds ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                            {(inv.depositAmount || 0) > 0 && (
                              <span className="text-primary font-black uppercase">Deposit Required</span>
                            )}
                         </div>
                      </div>
                   </div>

                     <div className="flex items-center justify-between md:flex-col md:items-end gap-4 relative z-10">
                        <div className="text-right">
                           <p className={cn(
                             "text-4xl font-black tracking-tighter italic transition-colors",
                             inv.isPaid ? "text-green-500" : "text-slate-900 group-hover:text-primary"
                           )}>R {inv.total || inv.amount || '0.00'}</p>
                            {(inv.amountPaid || 0) > 0 && !inv.isPaid && (
                              <p className="text-[10px] font-black text-green-500 uppercase italic opacity-80">Paid: R {inv.amountPaid}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                           {!inv.isPaid && (
                             <button 
                               onClick={(e) => handleMarkAsPaid(e, inv.id)}
                               disabled={actionLoading === inv.id}
                               className="px-6 py-4 bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition-all shadow-md active:scale-95 disabled:opacity-50"
                             >
                                {actionLoading === inv.id ? "Processing..." : "Mark as Paid"}
                             </button>
                           )}
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }}
                             className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                             title="Delete Permanently"
                           >
                              <Trash2 className="w-5 h-5" />
                           </button>
                           <button 
                             onClick={() => router.push(`/jobs/view/invoice?id=${inv.id}`)}
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
                   <p className="text-slate-400 font-bold uppercase tracking-[0.2em] italic text-sm">No revenue archives detected in current perimeter.</p>
                   <button 
                    onClick={() => router.push('/jobs/view/invoice?id=standalone')}
                    className="text-primary font-black uppercase tracking-widest text-[10px] italic border-b-2 border-primary/20 hover:border-primary transition-all pb-1"
                   >
                     Initialize First Revenue Event
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
