'use client';

import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  Download, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  TrendingUp, 
  DollarSign, 
  FileText,
  User,
  Calendar,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Percent
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getJob, getInventory, updateJob, createJob, createInvoice, updateStock, getUserProfile, getRecentCustomers, InventoryItem, UserProfile, Job } from '@/lib/db';
import { TIER_CONFIG, UNIT_TYPES } from '@/lib/constants';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PdfDocument } from '@/components/PdfDocument';
import { QuickAddStockModal } from '@/components/tradesman/QuickAddStockModal';
import LocationSearch from '@/components/jobs/LocationSearch';
import { motion, AnimatePresence } from 'framer-motion';

interface InvoiceLineItem {
  id: string;
  name: string;
  unitType: string;
  quantity: number;
  costExcl: number;
  sellingIncl: number;
  inventoryId?: string;
}

import { Suspense } from 'react';

function InvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || 'direct';
  const { user, profile, loading: authLoading } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [notes, setNotes] = useState('');
  const [recentCustomers, setRecentCustomers] = useState<{ uid: string, name: string }[]>([]);
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  useEffect(() => {
    if (user) {
       loadData();
    }
  }, [user, id, authLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (id === 'direct' || id === 'standalone') {
        const invData = await getInventory(user!.uid);
        setJob({ 
          id: 'INV-' + Date.now().toString().slice(-6), 
          customerName: '', 
          status: 'drafting',
          title: 'Direct Invoice',
          description: 'Directly generated invoice manifest',
          category: 'Standalone',
          categories: ['Standalone'],
          location: 'Direct Link',
          createdAt: new Date()
        } as Job);
        setInventory(invData);
        setLineItems([]);
      } else {
        const [jobData, invData] = await Promise.all([
          getJob(id),
          getInventory(user!.uid)
        ]);
        
        // IMPORTANT: Wait for authLoading to be false before evaluating unauthorized access
        if (!authLoading && jobData && jobData.tradesmanId && jobData.tradesmanId !== user!.uid) {
           console.warn('DEBUG [Invoice Guard]: Access denied.', { 
             jobId: id, 
             jobTradesmanId: jobData.tradesmanId, 
             currentUserUid: user!.uid 
           });
           router.push('/dashboard/tradesman?error=unauthorized');
           return;
        }

        setJob(jobData);
        setInventory(invData);
        
        // Auto-populate customer info from their profile if fields are empty
        if (jobData && jobData.customerId) {
           try {
              const customerProfile = await getUserProfile(jobData.customerId);
               if (customerProfile) {
                  setJob(prev => {
                     if (!prev) return prev;
                     return {
                        ...prev,
                        customerName: prev.customerName || customerProfile.fullName || '',
                        customerPhone: prev.customerPhone || customerProfile.phone || '',
                        customerEmail: prev.customerEmail || customerProfile.email || '',
                        customerAddress: prev.customerAddress || customerProfile.address || (typeof customerProfile.location === 'object' ? customerProfile.location?.address : customerProfile.location) || '',
                        location: prev.location || customerProfile.address || customerProfile.location || ''
                     };
                  });
               }
           } catch (profileErr) {
              console.warn("Failed to auto-populate customer profile:", profileErr);
           }
        }

        if (jobData?.lineItems) {
          setLineItems(jobData.lineItems);
        }
        if (jobData?.notes) {
          setNotes(jobData.notes);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      router.push('/dashboard/tradesman?error=load_failed');
    } finally {
      setLoading(false);
    }

    // Load recent customers for quick select
    try {
       const recent = await getRecentCustomers(user!.uid);
       setRecentCustomers(recent);
    } catch (err) {
       console.warn("Failed to load recent customers:", err);
    }
  };

  const handleSelectCustomer = async (uid: string) => {
    try {
       setIsCustomerSelectOpen(false);
       const customerProfile = await getUserProfile(uid);
       if (customerProfile && job) {
          setJob({
             ...job,
             customerId: uid,
             customerName: customerProfile.fullName || '',
             customerPhone: customerProfile.phone || '',
             customerEmail: customerProfile.email || '',
             customerAddress: customerProfile.address || (typeof customerProfile.location === 'object' ? customerProfile.location?.address : customerProfile.location) || '',
             location: customerProfile.address || customerProfile.location || '',
             locationData: { 
                address: customerProfile.address || (typeof customerProfile.location === 'object' ? customerProfile.location?.address : customerProfile.location) || '',
                lat: (customerProfile as any).locationData?.lat || customerProfile.location?.lat || 0,
                lng: (customerProfile as any).locationData?.lng || customerProfile.location?.lng || 0
             }
          });
       }
    } catch (err) {
       console.error("Failed to select customer profile:", err);
    }
  };

  // Tier Check
  if (profile && profile.tier === 'starter') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 text-center shadow-xl border border-slate-100">
           <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8 text-primary">
              <TrendingUp className="w-10 h-10 shadow-glow" />
           </div>
           <h2 className="text-3xl font-black uppercase tracking-tight italic mb-4">Upgrade <span className="text-primary">Required</span></h2>
           <p className="text-slate-500 font-medium leading-relaxed mb-10 italic">
              Link Starter accounts are limited to discovery only. Upgrade to **Missing Link** or **Link Legend** to unlock mission-critical invoicing and estimates.
           </p>
           <button 
             onClick={() => router.push('/dashboard/tradesman/profile')}
             className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl shadow-black/10"
           >
             Elevate My Status
           </button>
        </div>
      </div>
    );
  }

  const addLineItem = (invItem?: InventoryItem) => {
    const newItem: InvoiceLineItem = invItem ? {
      id: Math.random().toString(36).substr(2, 9),
      name: invItem.name,
      unitType: invItem.unitType,
      quantity: 1,
      costExcl: invItem.costExcl,
      sellingIncl: invItem.sellingIncl,
      inventoryId: invItem.id
    } : {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      unitType: 'unit',
      quantity: 1,
      costExcl: 0,
      sellingIncl: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(i => i.id !== id));
  };

  const updateItem = (id: string, updates: Partial<InvoiceLineItem>) => {
    setLineItems(lineItems.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  // Calculations
  const totals = lineItems.reduce((acc, item) => {
    const itemTotalIncl = item.sellingIncl * item.quantity;
    const isVatRegistered = profile?.isVatRegistered || false;
    
    // If registered, Subtotal = total/1.15. If NOT registered, Subtotal = total.
    const itemTotalExcl = isVatRegistered ? (itemTotalIncl / 1.15) : itemTotalIncl;
    const itemCostTotal = item.costExcl * item.quantity;
    
    return {
      excl: acc.excl + itemTotalExcl,
      incl: acc.incl + itemTotalIncl,
      vat: isVatRegistered ? (acc.vat + (itemTotalIncl - itemTotalExcl)) : 0,
      cost: acc.cost + itemCostTotal
    };
  }, { excl: 0, incl: 0, vat: 0, cost: 0 });

  const profit = totals.excl - totals.cost;
  const gp = totals.excl > 0 ? (profit / totals.excl) * 100 : 0;
  const markup = totals.cost > 0 ? (profit / totals.cost) * 100 : 0;

  const handleFinalize = async () => {
    if (!job || lineItems.length === 0) return;
    setIsFinalizing(true);
    if (id === 'direct' || id === 'standalone') {
        try {
          // Just Decrement Stock
          await Promise.all(lineItems.map(item => {
            if (item.inventoryId) {
              return updateStock(user!.uid, item.inventoryId, -item.quantity);
            }
            return Promise.resolve();
          }));
          const newJob = await createJob({
             ...job,
             status: 'billed',
             amount: totals.incl,
             isStandalone: true,
             tradesmanId: user!.uid,
             lineItems,
             notes,
             billedAt: new Date()
          });
          await handleDownloadPdf();
          router.push(`/jobs/view?id=${newJob.id}`);
        } catch (error) {
           console.error("Save standalone failed", error);
        } finally {
           setIsFinalizing(false);
        }
        return;
    }
    try {
      // 1. Update Job Status & Amounts
      await updateJob(job.id, {
        status: 'billed',
        amount: totals.incl,
        lineItems,
        notes,
        billedAt: new Date()
      });

      // 2. Create tactical sub-collection record
      await createInvoice(job.id, {
        amount: totals.incl,
        lineItems,
        notes,
        status: 'issued'
      });

      // 3. Decrement Stock
      await Promise.all(lineItems.map(item => {
        if (item.inventoryId) {
          return updateStock(user!.uid, item.inventoryId, -item.quantity);
        }
        return Promise.resolve();
      }));

      router.push(`/jobs/view?id=${job.id}`);
    } catch (error) {
      console.error('Finalization failed:', error);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDownloadPdf = async () => {
    const input = document.getElementById('pdf-document');
    if (!input) return;
    try {
      const canvas = await html2canvas(input, { scale: 1.5, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`invoice_${id}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
  };

  if (loading) return (
     <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
     </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-12 overflow-hidden relative">
      <div className="absolute -left-[9999px] -top-[9999px]">
         <PdfDocument job={job} profile={profile!} lineItems={lineItems} totals={totals} type="Invoice" />
      </div>
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div className="flex items-center gap-6">
              <button 
                onClick={() => router.back()}
                className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-primary group"
              >
                 <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
              </button>
              <div>
                 <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] mb-2 italic">
                    <span className="w-8 h-[2px] bg-primary"></span>
                    Mission Invoice
                 </div>
                 <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
                    Billing <span className="text-primary">Architect</span>
                 </h1>
              </div>
           </div>
           
           <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4 p-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm self-start">
                 <div className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest italic">
                    {job?.status || 'Active Mission'}
                 </div>
                 <div className="px-6 py-3 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    ID: {id.slice(0, 8)}
                 </div>
              </div>
              <button 
                 onClick={handleDownloadPdf}
                 className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 shadow-sm rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-primary transition-all text-slate-600 hover:text-primary"
              >
                 <Download className="w-4 h-4" /> Download PDF
              </button>
           </div>
        </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <QuickAddStockModal 
              isOpen={isQuickAddOpen}
              onClose={() => setIsQuickAddOpen(false)}
              userId={user!.uid}
              onSuccess={(newItem) => {
                 setInventory([...inventory, newItem]);
                 addLineItem(newItem);
              }}
            />
          {/* Main Form */}
          <div className="lg:col-span-8 space-y-8">
             {/* Customer Data */}
             <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-sm flex items-center justify-between">
                 <div className="flex-1">
                    <div className="flex gap-4 mb-4">
                       <div className="w-16 h-16 bg-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-400 shrink-0">
                          <User className="w-8 h-8" />
                       </div>
                       <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Client Focus</p>
                             {recentCustomers.length > 0 && (
                                <div className="relative">
                                   <button 
                                     onClick={() => setIsCustomerSelectOpen(!isCustomerSelectOpen)}
                                     className="text-[9px] font-black text-primary uppercase tracking-widest italic flex items-center gap-1 hover:brightness-110"
                                   >
                                      <User className="w-3 h-3" /> Quick Select History
                                   </button>
                                   <AnimatePresence>
                                      {isCustomerSelectOpen && (
                                         <motion.div 
                                           initial={{ opacity: 0, y: 10 }}
                                           animate={{ opacity: 1, y: 0 }}
                                           exit={{ opacity: 0, y: 10 }}
                                           className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] overflow-hidden"
                                         >
                                            <div className="p-4 bg-slate-50 border-b border-slate-100">
                                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Recent Collaborations</p>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                               {recentCustomers.map(rc => (
                                                  <button
                                                    key={rc.uid}
                                                    onClick={() => handleSelectCustomer(rc.uid)}
                                                    className="w-full text-left px-5 py-4 text-[10px] font-bold text-slate-700 hover:bg-slate-50 hover:text-primary transition-all uppercase"
                                                  >
                                                     {rc.name}
                                                  </button>
                                               ))}
                                            </div>
                                         </motion.div>
                                      )}
                                   </AnimatePresence>
                                </div>
                             )}
                          </div>
                          <input 
                            type="text" 
                            placeholder="Enter Client Name..." 
                            value={job?.customerName || ''}
                            onChange={(e) => setJob({ ...job!, customerName: e.target.value })}
                            className="text-2xl font-black text-slate-900 tracking-tight uppercase italic bg-slate-50 border-transparent rounded-xl px-4 py-2 outline-none focus:border-primary shadow-inner w-full"
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input 
                              type="text" 
                              placeholder="Phone Number" 
                              value={job?.customerPhone || ''}
                              onChange={(e) => setJob({ ...job!, customerPhone: e.target.value })}
                              className="text-xs font-bold text-slate-600 bg-slate-50 border-transparent rounded-xl px-4 py-3 outline-none focus:border-primary shadow-inner w-full"
                            />
                            <input 
                              type="email" 
                              placeholder="Email Address" 
                              value={job?.customerEmail || ''}
                              onChange={(e) => setJob({ ...job!, customerEmail: e.target.value })}
                              className="text-xs font-bold text-slate-600 bg-slate-50 border-transparent rounded-xl px-4 py-3 outline-none focus:border-primary shadow-inner w-full"
                            />
                          </div>
                         <LocationSearch 
                           placeholder="Full Address / Location" 
                           onLocationSelect={(address, lat, lng) => {
                              setJob({ ...job!, customerAddress: address, location: address, locationData: { address, lat, lng } });
                           }}
                           className="w-full"
                         />
                       </div>
                    </div>
                 </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Mission Launch</p>
                   <p className="text-sm font-bold text-slate-700">{new Date(job?.createdAt?.seconds * 1000).toLocaleDateString() || 'Today'}</p>
                </div>
             </div>

             {/* Line Items */}
             <div className="bg-white rounded-[4rem] p-12 border border-slate-100 shadow-sm space-y-10 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-2xl font-black tracking-tight uppercase italic">Line <span className="text-primary">Intelligence</span></h3>
                   <div className="flex items-center gap-4">
                      <button 
                        onClick={() => addLineItem()}
                        className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-primary hover:text-white transition-all shadow-sm"
                      >
                         <Plus className="w-5 h-5" />
                      </button>
                   </div>
                </div>

                 <div className="space-y-6">
                   <AnimatePresence>
                     {lineItems.map((item) => (
                       <motion.div 
                         key={item.id}
                         initial={{ opacity: 0, x: -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: 20 }}
                         className="flex flex-col md:flex-row items-end md:items-center gap-4 p-4 rounded-[2rem] border border-slate-100 hover:border-primary/20 transition-all bg-slate-50/30"
                       >
                          <div className="flex-1 space-y-1 w-full relative">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic ml-3">Inventory Link</label>
                             <div className="flex gap-2 relative">
                                <select 
                                  value={item.inventoryId || ''}
                                  onChange={(e) => {
                                    const selectedItem = inventory.find(inv => inv.id === e.target.value);
                                    if (selectedItem) {
                                       updateItem(item.id, {
                                          inventoryId: selectedItem.id,
                                          name: selectedItem.name,
                                          unitType: selectedItem.unitType,
                                          costExcl: selectedItem.costExcl,
                                          sellingIncl: selectedItem.sellingIncl
                                       });
                                    }
                                  }}
                                  className="w-full bg-white border-transparent p-4 rounded-xl text-[11px] font-bold outline-none focus:border-primary shadow-sm appearance-none"
                                >
                                  <option value="" disabled>Select from Inventory...</option>
                                  {inventory.map(inv => (
                                     <option key={inv.id} value={inv.id}>{inv.name} (R{inv.sellingIncl.toFixed(2)})</option>
                                  ))}
                                </select>
                                <button 
                                  onClick={() => setIsQuickAddOpen(true)}
                                  className="shrink-0 aspect-square p-4 bg-white text-slate-400 border border-transparent rounded-xl hover:text-primary hover:border-primary/20 shadow-sm transition-all"
                                  title="Add new stock inline"
                                >
                                   <Plus className="w-4 h-4" />
                                </button>
                             </div>
                          </div>
                          <div className="w-24 space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic ml-3">Qty</label>
                             <input 
                               type="number"
                               value={item.quantity}
                               onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) })}
                               className="w-full bg-white border-transparent p-4 rounded-xl text-[11px] font-bold outline-none focus:border-primary text-center shadow-sm"
                             />
                          </div>
                          <div className="w-32 space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic ml-3">Unit (Incl)</label>
                             <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">R</span>
                                <input 
                                  disabled
                                  type="number"
                                  value={item.sellingIncl}
                                  className="w-full bg-slate-100/50 text-slate-500 border-transparent p-4 pl-7 rounded-xl text-[11px] font-bold outline-none cursor-not-allowed shadow-sm"
                                />
                             </div>
                          </div>
                          <div className="text-right px-4 shrink-0 min-w-[5rem]">
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic mb-0.5">Total</p>
                             <p className="text-sm font-black text-slate-900">R{(item.sellingIncl * item.quantity).toFixed(2)}</p>
                             {item.inventoryId && (
                                <div className="mt-1">
                                   {(() => {
                                      const invItem = inventory.find(i => i.id === item.inventoryId);
                                      const isNegative = invItem && invItem.stockLevel < item.quantity;
                                      return isNegative ? (
                                         <div className="flex items-center gap-1 text-[8px] font-black text-primary uppercase italic animate-pulse">
                                            <AlertCircle className="w-2.5 h-2.5" />
                                            Negative Stock Alert!
                                         </div>
                                      ) : null;
                                   })()}
                                </div>
                             )}
                          </div>
                          <button 
                            onClick={() => removeLineItem(item.id)}
                            className="p-4 bg-white text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl shadow-sm transition-all shrink-0"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </motion.div>
                     ))}
                   </AnimatePresence>

                   {lineItems.length === 0 && (
                     <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                        <Package className="w-12 h-12 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest italic">Zero Line Data - Begin Architecting</p>
                     </div>
                   )}
                </div>
             </div>

             {/* Inventory Direct Injection */}
             <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-4 flex items-center gap-2">
                   <Package className="w-3 h-3" /> Professional Catalog Injection
                </p>
                <div className="flex flex-wrap gap-3">
                   {inventory.map((invItem) => (
                      <button 
                        key={invItem.id}
                        onClick={() => addLineItem(invItem)}
                        className="px-6 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-primary hover:text-primary transition-all flex items-center gap-3 text-[10px] font-black uppercase tracking-widest italic group"
                      >
                         <Plus className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                         {invItem.name}
                         <span className="text-slate-300 font-medium normal-case">({UNIT_TYPES.find(u => u.id === invItem.unitType)?.short})</span>
                      </button>
                   ))}
                </div>
             </div>
          </div>

          {/* Right: Financial Pulse Panel */}
          <div className="lg:col-span-4 space-y-8">
             {/* The Profit Engine (Professional Only) */}
             <div className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden transform group hover:scale-[1.02] transition-all border border-white/5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] -mr-16 -mt-16"></div>
                
                <div className="flex items-center justify-between mb-8">
                   <span className="px-3 py-1 bg-primary/20 border border-primary/30 rounded-lg text-[9px] font-black text-primary uppercase tracking-[0.2em] italic">Hero Logic</span>
                   <TrendingUp className="w-5 h-5 text-primary shadow-glow" />
                </div>

                <h3 className="text-white font-black text-xl tracking-tight mb-8 uppercase italic">Profit <span className="text-primary">Engine</span></h3>

                <div className="space-y-6 mb-10">
                   <div className="flex items-center justify-between px-6 py-4 bg-white/5 rounded-2xl border border-white/10">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Operational Cost</span>
                      <span className="text-lg font-black text-white tracking-tighter">R {totals.cost.toFixed(2)}</span>
                   </div>
                   <div className="flex items-center justify-between px-6 py-4 bg-green-500/10 rounded-2xl border border-green-500/20">
                      <span className="text-[10px] font-black text-green-500 uppercase tracking-widest italic">Net Profit (Excl)</span>
                      <span className="text-lg font-black text-white tracking-tighter">R {profit.toFixed(2)}</span>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-6 bg-white/5 rounded-[2rem] text-center border border-white/5 hover:border-primary/30 transition-all">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">GP %</p>
                      <p className="text-2xl font-black text-primary italic tracking-tight">{gp.toFixed(1)}%</p>
                   </div>
                   <div className="p-6 bg-white/5 rounded-[2rem] text-center border border-white/5 hover:border-accent/30 transition-all">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Markup %</p>
                      <p className="text-2xl font-black text-accent italic tracking-tight">{markup.toFixed(1)}%</p>
                   </div>
                </div>

                <p className="mt-8 text-[9px] font-black text-slate-500 text-center uppercase tracking-widest italic">
                   This panel is strictly private to your hero profile.
                </p>
             </div>

             {/* Customer Facing Total */}
             <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-xl space-y-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic text-center">Final Mission Value</p>
                
                <div className="space-y-4">
                   {profile?.isVatRegistered && (
                      <>
                         <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                            <span className="uppercase tracking-widest opacity-60">Subtotal (Excl)</span>
                            <span>R {totals.excl.toFixed(2)}</span>
                         </div>
                         <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                            <span className="uppercase tracking-widest opacity-60">VAT (15.0%)</span>
                            <span>R {totals.vat.toFixed(2)}</span>
                         </div>
                      </>
                   )}
                   <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">Hero Total</span>
                      <span className="text-4xl font-black text-slate-900 tracking-tighter">R {totals.incl.toFixed(2)}</span>
                   </div>
                </div>

                <button 
                  onClick={handleFinalize}
                  disabled={isFinalizing || lineItems.length === 0}
                  className="w-full py-8 bg-primary text-white rounded-[2rem] font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-primary/30 flex items-center justify-center gap-4 group"
                >
                   {isFinalizing ? (
                     <Loader2 className="w-6 h-6 animate-spin" />
                   ) : (
                     <>
                        Finalize Mission
                        <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                     </>
                   )}
                </button>
             </div>

             {/* VAT Status Banner */}
             <div className={`p-8 rounded-[2.5rem] border ${profile?.isVatRegistered ? 'bg-green-50 border-green-100 text-green-700' : 'bg-slate-100 border-slate-200 text-slate-500'} flex items-start gap-4`}>
                <ShieldCheck className={`w-6 h-6 shrink-0 mt-0.5 ${profile?.isVatRegistered ? 'text-green-500 shadow-glow' : 'text-slate-400'}`} />
                <div>
                   <h4 className="font-black text-[10px] uppercase tracking-widest italic mb-1">
                      VAT Configuration: {profile?.isVatRegistered ? 'Hero Registered' : 'Not Registered'}
                   </h4>
                   <p className="text-[10px] font-medium leading-relaxed italic">
                      {profile?.isVatRegistered 
                        ? '15.0% VAT is automatically calculated and visible on the final invoice.' 
                        : 'All amounts are shown as inclusive. No separate VAT breakdown will be used.'}
                   </p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={
       <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
       </div>
    }>
       <InvoiceContent />
    </Suspense>
  );
}
