'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ShieldCheck,
  TrendingUp,
  FileText,
  User,
  Package,
  XCircle,
  Play,
  CheckCircle2,
  AlertCircle,
  ScrollText,
  ShieldAlert,
  Loader2,
  Download,
  Mail
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getJob, getInventory, updateJob, createJob, createEstimate, updateEstimate, getRecentCustomers, createNotification, getEstimate, getUserProfile, getProCustomerIds, InventoryItem, UserProfile, Job } from '@/lib/db';
import { TIER_CONFIG, UNIT_TYPES } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import { PdfDocument } from '@/components/PdfDocument';
import { QuickAddStockModal } from '@/components/tradesman/QuickAddStockModal';
import LocationSearch from '@/components/jobs/LocationSearch';
import { renderPdfCanvas } from '@/lib/pdfSanitizer';

interface EstimateLineItem {
  id: string;
  name: string;
  unitType: string;
  quantity: number;
  costExcl: number;
  sellingIncl: number;
  inventoryId?: string;
}

import { Suspense } from 'react';

function EstimateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || 'direct';
  const estimateId = searchParams.get('estimateId');
  const { user, profile, loading: authLoading } = useAuth();
  const [proProfile, setProProfile] = useState<UserProfile | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [recentCustomers, setRecentCustomers] = useState<{ uid: string, name: string }[]>([]);
  const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [customerIds, setCustomerIds] = useState<string[]>([]);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositType, setDepositType] = useState<'percentage' | 'fixed'>('percentage');
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  useEffect(() => {
    if (user && !authLoading) {
       loadData();
    }
  }, [user, id, authLoading]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    console.log('DEBUG [Estimate]: Loading data for ID:', id);

    try {
      if (id === 'direct' || id === 'standalone') {
        try {
          const invData = await getInventory(user.uid);
          setInventory(invData);
          setJob({
            id: 'DIR-' + Date.now().toString().slice(-6),
            customerName: '',
            status: 'drafting',
            title: 'Direct Job',
            description: 'Directly generated job manifest',
            category: 'Standalone',
            categories: ['Standalone'],
            location: 'Direct Link',
            createdAt: new Date()
          } as Job);
          setLineItems([]);
        } catch (invErr) {
          console.error('DEBUG [Estimate]: Inventory fetch failed:', invErr);
        }
      } else {
        let jobData: Job | null = null;
        let invData: InventoryItem[] = [];

        try {
          console.log('DEBUG [Estimate]: Attempting job fetch...');
          jobData = await getJob(id);
          console.log('DEBUG [Estimate]: Job fetch success:', jobData?.id);
        } catch (jobErr: any) {
          console.error('DEBUG [Estimate]: Job fetch permission error:', jobErr);
          if (jobErr?.code === 'permission-denied') {
             router.push('/dashboard/tradesman?error=job_unauthorized');
             return;
          }
        }

        try {
          if (profile?.role === 'tradesman') {
            console.log('DEBUG [Estimate]: Attempting inventory fetch...');
            invData = await getInventory(user.uid);
            console.log('DEBUG [Estimate]: Inventory fetch success:', invData.length, 'items');
          }
        } catch (invErr) {
          console.error('DEBUG [Estimate]: Inventory fetch error:', invErr);
        }

        const isTradesman = jobData?.tradesmanId === user.uid;
        
        // 2. User is a pro/tradesman and the job is in a public state (including 'lead')
        const userRole = (profile?.role || '').toLowerCase();
        const isProRole = userRole === 'tradesman' || 
                         userRole === 'professional' || 
                         userRole === 'pro' || 
                         userRole === 'hero' || 
                         userRole === 'operative' ||
                         userRole === 'tradesperson' ||
                         userRole === 'provider';
                         
        const publicStatuses = ['pending', 'available', 'open', 'estimated', 'quoted', 'declined', 'lead', 'ready', 'active', 'published', 'in-progress', 'in_progress', 'assigned'];
        const isPublicAccess = publicStatuses.includes((jobData?.status || '').toLowerCase()) && isProRole;

        // 3. User is the customer who owns the job
        const isCustomer = jobData?.customerId === user.uid;
        
        // 4. User is an admin
        const isAdmin = userRole === 'admin';

        if (authLoading) {
           console.log('DEBUG [Estimate Guard]: Auth still loading, deferring guard.');
           setLoading(false);
           return;
        }

        if (!isTradesman && !isPublicAccess && !isCustomer && !isAdmin) {
          console.warn('DEBUG [Estimate Guard]: Access denied.', { 
            jobId: id, 
            status: jobData?.status,
            userRole: profile?.role,
            isTradesman,
            isPublicAccess,
            isCustomer,
            isAdmin
          });
          setError(`Unauthorized Access: Your account (${profile?.role || 'Guest'}) does not have authorization to architect estimates for this mission status (${jobData?.status || 'Unknown'}).`);
          setLoading(false);
          return;
        }

        if (jobData) {
          setInventory(invData);

          // AUTO-PILOT: Strategic Data Injection from Job Listing
          const normalizeLoc = (loc: any) => {
             if (!loc) return '';
             if (typeof loc === 'object') return loc.address || '';
             return String(loc);
          };

          // Resolve the site address from the job's location data
          const siteAddress = jobData.customerAddress || normalizeLoc(jobData.location) || '';

          // CUSTOMER DATA ENRICHMENT: Fetch real customer profile data
          let enrichedName = jobData.customerName || '';
          let enrichedPhone = jobData.customerPhone || '';
          let enrichedEmail = jobData.customerEmail || '';
          let enrichedAddress = siteAddress;

          if (jobData.customerId) {
            try {
              const customerProfile = await getUserProfile(jobData.customerId);
              if (customerProfile) {
                // Use job data first, then fallback to customer profile
                enrichedName = enrichedName || customerProfile.fullName || '';
                enrichedPhone = enrichedPhone || customerProfile.contactPhone || customerProfile.phone || customerProfile.phoneNumber || customerProfile.mobile || customerProfile.contactNumber || '';
                enrichedEmail = enrichedEmail || customerProfile.email || '';
                // Site address from job takes priority over customer's home address
                enrichedAddress = siteAddress || customerProfile.address || (customerProfile.location?.address) || '';
              }
            } catch (custErr) {
              console.warn('DEBUG [Estimate]: Customer profile enrichment failed:', custErr);
            }
          }

          setJob({
            ...jobData,
            customerName: enrichedName,
            customerPhone: enrichedPhone,
            customerEmail: enrichedEmail,
            customerAddress: enrichedAddress,
            location: normalizeLoc(jobData.location) || enrichedAddress,
            locationData: jobData.locationData || (typeof jobData.location === 'object' ? jobData.location : undefined)
          });

          // Data Enrichment: If we are viewing a specific estimate, load ITS data
          if (estimateId) {
             const estData = await getEstimate(id, estimateId);
             if (estData) {
                if (estData.lineItems) setLineItems(estData.lineItems);
                if (estData.notes) setNotes(estData.notes);
                if (estData.depositAmount !== undefined) setDepositAmount(estData.depositAmount);
                if (estData.depositType) setDepositType(estData.depositType);

                // Also update the job state to reflect this specific estimate's totals for rendering
                setJob(prev => prev ? { ...prev, ...estData } : null);

                if (estData.tradesmanId) {
                   const professional = await getUserProfile(estData.tradesmanId);
                   if (professional) setProProfile(professional);
                }
             }
          } else {
             // Fallback to legacy fields if no specific estimate requested
             if (jobData.lineItems) setLineItems(jobData.lineItems);
             if (jobData.notes) setNotes(jobData.notes);
             if (jobData.depositAmount !== undefined) setDepositAmount(jobData.depositAmount);
             if (jobData.depositType) setDepositType(jobData.depositType);
          }
        } else {
          console.warn('DEBUG [Estimate]: Job not found or inaccessible.');
          router.push('/dashboard/tradesman?error=job_missing');
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      setError(`Critical Data Failure: ${error.message || 'Mission protocols could not be established.'}`);
    } finally {
      setLoading(false);
    }

    try {
       if (profile?.role === 'tradesman') {
         const [recent, ids] = await Promise.all([
           getRecentCustomers(user!.uid),
           getProCustomerIds(user!.uid)
         ]);
         setRecentCustomers(recent);
         setCustomerIds(ids);
       }
    } catch (err) {
       console.warn("Failed to load customer data:", err);
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
             customerPhone: customerProfile.contactPhone || customerProfile.phone || customerProfile.phoneNumber || customerProfile.contactNumber || '',
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

  const addLineItem = (invItem?: InventoryItem) => {
    const newItem: EstimateLineItem = invItem ? {
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

  const updateItem = (id: string, updates: Partial<EstimateLineItem>) => {
    setLineItems(lineItems.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const totals = lineItems.reduce((acc, item) => {
    const itemTotalIncl = item.sellingIncl * item.quantity;
    const isVatRegistered = profile?.isVatRegistered || job?.isVatRegistered || false;
    const itemTotalExcl = isVatRegistered ? (itemTotalIncl / 1.15) : itemTotalIncl;
    const itemCostTotal = (item.costExcl || 0) * item.quantity;

    return {
      excl: acc.excl + itemTotalExcl,
      incl: acc.incl + itemTotalIncl,
      vat: isVatRegistered ? (acc.vat + (itemTotalIncl - itemTotalExcl)) : 0,
      cost: acc.cost + itemCostTotal
    };
  }, { excl: 0, incl: 0, vat: 0, cost: 0 });

  const depositValue = depositType === 'percentage'
    ? (totals.incl * depositAmount) / 100
    : depositAmount;

  const balanceDue = totals.incl - depositValue;

  const profit = totals.excl - totals.cost;
  const gp = totals.excl > 0 ? (profit / totals.excl) * 100 : 0;
  const markup = totals.cost > 0 ? (profit / totals.cost) * 100 : 0;

  const handleSaveEstimate = async () => {
    if (!job || lineItems.length === 0) return;
    
    if (!job.customerId) {
      alert("Please select or provide a customer first.");
      return;
    }

    setIsSaving(true);

    const effectiveJobId = id !== 'direct' && id !== 'standalone' ? id : createdJobId;
    
    // Better name resolution for branding
    const tradesmanName = profile?.businessName || profile?.fullName || profile?.name || user?.displayName || 'The Fix Link Specialist';

    if (!effectiveJobId) {
        try {
          const newJob = await createJob({
             ...job,
             status: 'estimated',
             amount: totals.incl,
             total: totals.incl,
             depositAmount,
             depositType,
             isStandalone: true,
             tradesmanId: user!.uid,
             tradesmanName: tradesmanName,
             lineItems,
             notes,
             createdAt: new Date()
          });

          await createEstimate(newJob.id, {
             amount: totals.incl,
             lineItems,
             notes,
             status: 'sent',
             tradesmanId: user!.uid,
             tradesmanName: tradesmanName,
             tradesmanBusinessName: profile?.businessName || ''
          });

          setCreatedJobId(newJob.id);
          router.push(`/jobs/view?id=${newJob.id}`);
        } catch (error) {
           console.error("Save standalone failed", error);
        } finally {
           setIsSaving(false);
        }
        return;
    }

    try {
      await updateJob(effectiveJobId, {
        amount: totals.incl,
        total: totals.incl,
        depositAmount,
        depositType,
        lineItems,
        notes,
        tradesmanId: user!.uid,
        tradesmanName: tradesmanName,
        customerName: job?.customerName || '',
        customerPhone: job?.customerPhone || '',
        customerEmail: job?.customerEmail || '',
        customerAddress: job?.customerAddress || '',
        status: 'estimated'
      });

      await createEstimate(effectiveJobId, {
        amount: totals.incl,
        lineItems,
        notes,
        status: 'sent',
        tradesmanId: user!.uid,
        tradesmanName: tradesmanName,
        tradesmanBusinessName: profile?.businessName || ''
      });

      router.push(`/jobs/view?id=${effectiveJobId}`);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsSaving(true);
    console.log('[Estimate] Starting PDF generation sequence...');
    
    try {
      const canvas = await renderPdfCanvas('pdf-document');
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      const pdf = new jsPDF({ 
        orientation: 'p', 
        unit: 'mm', 
        format: 'a4', 
        compress: true 
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      
      const filename = `Estimate_${job?.reference || id?.slice(0,8)}.pdf`;
      console.log(`[Estimate] PDF generated successfully. Downloading ${filename}`);
      pdf.save(filename);
      
    } catch (err: any) {
      console.error('[Estimate] PDF Error:', err);
      alert(`PDF Protocol Error: ${err?.message || 'Unknown rendering failure'}. Please check if the estimate content is visible.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailPdf = async () => {
    if (!job?.customerEmail) {
      alert('Please provide a client email address first.');
      return;
    }
    setIsEmailing(true);
    console.log('[Estimate] Initializing PDF for email dispatch...');

    try {
      const canvas = await renderPdfCanvas('pdf-document');
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      
      const pdf = new jsPDF({ 
        orientation: 'p', 
        unit: 'mm', 
        format: 'a4', 
        compress: true 
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      const pdfBase64 = pdf.output('datauristring');

      const response = await fetch('/api/email/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: job.customerEmail,
          proName: profile?.businessName || profile?.fullName || 'Professional',
          type: 'Estimate',
          pdfBase64,
          filename: `Estimate_${job.id.slice(0,8)}.pdf`
        })
      });
      if (response.ok) {
        alert(`Estimate successfully delivered to ${job.customerEmail}`);
      } else {
        const err = await response.json();
        throw new Error(err.error || 'Failed to deliver email');
      }
    } catch (err: any) {
      console.error('PDF email failed:', err);
      alert(`PDF Error: ${err?.message || 'Failed to deliver estimate'}. Please retry.`);
    } finally {
      setIsEmailing(false);
    }
  };

  const handleCustomerAction = async (newStatus: 'accepted' | 'declined' | 'cancelled') => {
    if (!job) return;
    setIsSaving(true);
    try {
      let jobStatus: string = newStatus;
      if (newStatus === 'accepted') {
        jobStatus = 'secured';
      }

      await updateJob(job.id, {
        status: jobStatus,
        updatedAt: new Date()
      });

      // Also update the estimate status if it's a specific estimate
      if (estimateId) {
        await updateEstimate(job.id, estimateId, {
          status: newStatus,
          updatedAt: new Date()
        });
      }

      // Create notification for the pro
      if (job.tradesmanId) {
        let msg = "";
        let title = "";
        const clientName = profile?.fullName || 'A customer';
        
        if (newStatus === 'accepted') {
          title = "Estimate Accepted!";
          msg = `${clientName} has accepted your estimate for "${job.title}". The job is now SECURED. You can proceed to finalize the mission.`;
        } else if (newStatus === 'declined') {
          title = "Estimate Declined";
          msg = `${clientName} has declined your estimate for "${job.title}".`;
        } else {
          title = "Job Cancelled";
          msg = `${clientName} has cancelled the mission: "${job.title}".`;
        }

        await createNotification({
          userId: job.tradesmanId,
          type: 'job_update',
          title,
          message: msg,
          jobId: job.id
        });
      }

      if (newStatus === 'accepted' && depositValue > 0) {
        // Redirect to payment for deposit
        router.push(`/checkout?jobId=${job.id}&estimateId=${estimateId || ''}&amount=${depositValue}`);
        return;
      }

      router.push(`/jobs/view?id=${job.id}`);
    } catch (err: any) {
      console.error("Failed to update status:", err);
      alert("Error updating status: " + (err.message || "Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const isCustomer = job?.customerId === user?.uid;
  const isTradesmanRole = profile?.role === 'tradesman';
  const isReadOnly = isCustomer || (job?.status !== 'drafting' && job?.status !== 'pending' && job?.status !== 'estimated' && job?.status !== 'quoted' && !isTradesmanRole);

  if (loading) return (
     <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
     </div>
  );
  
  if (error) return (
     <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 text-center shadow-2xl border border-slate-100">
           <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 text-red-500">
              <ShieldAlert className="w-10 h-10" />
           </div>
           <h2 className="text-3xl font-black uppercase tracking-tight italic mb-4">Access <span className="text-red-500">Restricted</span></h2>
           <p className="text-slate-500 font-medium leading-relaxed mb-10 italic">
              {error}
           </p>
           <button 
             onClick={() => router.push('/dashboard')}
             className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl shadow-black/10"
           >
             Return to Dashboard
           </button>
        </div>
     </div>
  );

  if (!job) return (
     <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 font-black uppercase tracking-widest italic">Mission Intelligence Not Found</p>
     </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-12 overflow-hidden relative">
      <div className="absolute -left-[9999px] -top-[9999px]">
         <PdfDocument job={job} profile={proProfile || profile!} lineItems={lineItems} totals={totals} type="Estimate" />
      </div>
      <div className="max-w-7xl mx-auto space-y-12">
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
                    Job Estimate
                 </div>
                 <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
                    Profit <span className="text-primary">Architect</span>
                 </h1>
              </div>
           </div>

            <div className="flex flex-col gap-2">
               <div className="flex flex-wrap items-center gap-3">
                  <button
                     onClick={handleDownloadPdf}
                     className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 shadow-sm rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-primary transition-all text-slate-400 hover:text-primary"
                  >
                     <Download className="w-4 h-4" /> Download PDF
                  </button>
                  {!isCustomer && (
                    <button
                       onClick={handleEmailPdf}
                       disabled={isEmailing}
                       className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white shadow-xl shadow-primary/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                       {isEmailing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                       Email to Client
                    </button>
                  )}
               </div>
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

          <div className="lg:col-span-8 space-y-8">


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
                           onChange={(e) => !isReadOnly && setJob({ ...job!, customerName: e.target.value })}
                           readOnly={isReadOnly}
                           className="text-2xl font-black text-slate-900 tracking-tight uppercase italic bg-slate-50 border-transparent rounded-xl px-4 py-2 outline-none focus:border-primary shadow-inner w-full"
                         />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                              type="text"
                              placeholder="Phone Number"
                              value={job?.customerPhone || ''}
                              onChange={(e) => !isReadOnly && setJob({ ...job!, customerPhone: e.target.value })}
                              readOnly={isReadOnly}
                              className="text-xs font-bold text-slate-600 bg-slate-50 border-transparent rounded-xl px-4 py-3 outline-none focus:border-primary shadow-inner w-full"
                            />
                            <input
                              type="email"
                              placeholder="Email Address"
                              value={job?.customerEmail || ''}
                              onChange={(e) => !isReadOnly && setJob({ ...job!, customerEmail: e.target.value })}
                              readOnly={isReadOnly}
                              className="text-xs font-bold text-slate-600 bg-slate-50 border-transparent rounded-xl px-4 py-3 outline-none focus:border-primary shadow-inner w-full"
                            />
                            <input
                              type="text"
                              placeholder="Customer VAT Number (if applicable)"
                              value={job?.customerVatNumber || ''}
                              onChange={(e) => !isReadOnly && setJob({ ...job!, customerVatNumber: e.target.value, isVatRegistered: !!e.target.value })}
                              readOnly={isReadOnly}
                              className="text-xs font-bold text-slate-600 bg-slate-50 border-transparent rounded-xl px-4 py-3 outline-none focus:border-primary shadow-inner w-full"
                            />
                            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl">
                               <input 
                                 type="checkbox"
                                 checked={job?.isVatRegistered || false}
                                 onChange={(e) => !isReadOnly && setJob({ ...job!, isVatRegistered: e.target.checked })}
                                 disabled={isReadOnly}
                                 className="w-4 h-4 accent-primary rounded-lg"
                               />
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">VAT Registered Customer</span>
                            </div>
                          </div>
                         <LocationSearch
                           key={`loc-${job?.customerId || 'draft'}-${job?.customerAddress || 'none'}`}
                           defaultValue={job?.customerAddress}
                           placeholder="Full Address / Location"
                           disabled={isReadOnly}
                           onLocationSelect={(address, lat, lng) => {
                              if (!isReadOnly) {
                                 setJob({ ...job!, customerAddress: address, location: address, locationData: { address, lat, lng } });
                              }
                           }}
                           className="w-full"
                         />
                      </div>
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-[4rem] p-12 border border-slate-100 shadow-sm space-y-10">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-2xl font-black tracking-tight uppercase italic">Line <span className="text-primary">Intelligence</span></h3>
                   {!isReadOnly && (
                    <button
                      onClick={() => addLineItem()}
                     className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-primary hover:text-white transition-all shadow-sm"
                   >
                      <Plus className="w-5 h-5" />
                   </button>
                    )}
                 </div>

                  <div className="space-y-6">
                   <AnimatePresence>
                     {lineItems.map((item) => (
                       <motion.div
                         key={item.id}
                         initial={{ opacity: 0, x: -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: 20 }}
                          className="flex flex-col md:flex-row items-stretch md:items-center gap-4 p-6 rounded-[2.5rem] border border-slate-100 bg-slate-50/30"
                       >
                          <div className="flex-1 space-y-1 w-full relative">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic ml-3">Inventory Link</label>
                             <div className="flex gap-2 relative">
                                <select
                                   disabled={isReadOnly}
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
                                  className={`w-full bg-white border-transparent p-5 rounded-2xl text-sm font-black uppercase tracking-tight outline-none focus:border-primary shadow-sm appearance-none ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                  <option value="" disabled>Select from Inventory...</option>
                                  {inventory.map(inv => (
                                     <option key={inv.id} value={inv.id}>{inv.name} (R{inv.sellingIncl.toFixed(2)})</option>
                                  ))}
                                </select>
                                {!isReadOnly && (
                                   <button
                                     onClick={() => setIsQuickAddOpen(true)}
                                  className="shrink-0 aspect-square p-5 bg-white text-slate-400 border border-transparent rounded-2xl hover:text-primary hover:border-primary/20 shadow-sm transition-all"
                                  title="Add new stock inline"
                                >
                                   <Plus className="w-5 h-5" />
                                </button>
                                 )}
                              </div>
                           </div>
                            <div className="w-full md:w-24 space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic ml-3">Qty</label>
                             <input
                               type="number"
                               readOnly={isReadOnly}
                               value={item.quantity}
                               onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) })}
                               className={`w-full bg-white border-transparent p-5 rounded-2xl text-sm font-black outline-none focus:border-primary text-center shadow-sm ${isReadOnly ? 'bg-slate-50 text-slate-500' : ''}`}
                             />
                          </div>
                           <div className="w-full md:w-32 space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic ml-3">Unit (Incl)</label>
                             <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">R</span>
                                <input
                                  type="number"
                                  readOnly={isReadOnly}
                                  onChange={(e) => updateItem(item.id, { sellingIncl: parseFloat(e.target.value) || 0 })}
                                  value={item.sellingIncl}
                                  className={`w-full bg-white border-transparent p-5 pl-8 rounded-2xl text-sm font-black outline-none focus:border-primary shadow-sm ${isReadOnly ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
                                />
                             </div>
                          </div>
                           <div className="text-left md:text-right px-4 shrink-0 min-w-[5rem]">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic mb-0.5">Total</p>
                              <p className="text-lg md:text-sm font-black text-slate-900">R{(item.sellingIncl * item.quantity).toFixed(2)}</p>
                           </div>
                           {!isReadOnly && (
                             <button
                               onClick={() => removeLineItem(item.id)}
                               className="p-4 bg-white text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl shadow-sm transition-all shrink-0"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                           )}
                       </motion.div>
                     ))}
                   </AnimatePresence>
                 </div>
             </div>

             {depositValue > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-primary/5 border border-primary/20 rounded-[3.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8"
                >
                   <div className="flex items-center gap-8">
                      <div className="w-20 h-20 bg-primary text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-primary/30 shrink-0">
                         <ShieldCheck className="w-10 h-10" />
                      </div>
                      <div>
                         <div className="flex items-center gap-2 text-primary font-black uppercase tracking-[0.2em] text-[10px] mb-2 italic">
                            <span className="w-8 h-[2px] bg-primary"></span>
                            Booking Security
                         </div>
                         <h4 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Secure Deposit Required</h4>
                         <p className="text-[11px] font-bold text-slate-500 mt-2 max-w-sm leading-relaxed uppercase tracking-wider">
                            To finalize this estimate and secure your specialist's priority booking, a secure deposit is required.
                         </p>
                      </div>
                   </div>
                   <div className="text-center md:text-right px-10 py-6 bg-white rounded-3xl border border-primary/10 shadow-sm min-w-[200px]">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mb-2">Deposit Amount</p>
                      <p className="text-4xl font-black text-primary tracking-tighter italic">R {depositValue.toFixed(2)}</p>
                   </div>
                </motion.div>
              )}
          </div>

          <div className="lg:col-span-4 space-y-8">
             {isTradesmanRole && (
               <div className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden border border-white/5">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] -mr-16 -mt-16"></div>
                  <h3 className="text-white font-black text-xl tracking-tight mb-8 uppercase italic">Profit <span className="text-primary">Engine</span></h3>

                   <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic mb-8">The Link Profit Engine™</h3>

                   <div className="space-y-6 mb-10">
                      <div className="flex items-center justify-between px-6 py-4 bg-white/5 rounded-2xl border border-white/10">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Total Project Cost</span>
                         <span className="text-lg font-black text-white tracking-tighter">R {totals.cost.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between px-6 py-4 bg-green-500/10 rounded-2xl border border-green-500/20">
                         <span className="text-[10px] font-black text-green-500 uppercase tracking-widest italic">Projected Profit</span>
                         <span className="text-lg font-black text-white tracking-tighter">R {profit.toFixed(2)}</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-center">
                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">GP Margin</p>
                         <p className="text-2xl font-black text-white tracking-tighter italic">{gp.toFixed(1)}%</p>
                      </div>
                      <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-center">
                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Markup</p>
                         <p className="text-2xl font-black text-white tracking-tighter italic">{markup.toFixed(1)}%</p>
                      </div>
                   </div>
                </div>
             )}

             {!isCustomer && (
                <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-sm space-y-6">
                   <h3 className="text-xl font-black uppercase italic tracking-tight">Deposit <span className="text-primary">Securing</span></h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-2">Requirement Type</label>
                         <div className="flex bg-slate-50 p-1 rounded-2xl">
                            <button
                               disabled={isReadOnly}
                               onClick={() => setDepositType('percentage')}
                               className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${depositType === 'percentage' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'} ${isReadOnly && depositType !== 'percentage' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                               Percentage %
                            </button>
                            <button
                               disabled={isReadOnly}
                               onClick={() => setDepositType('fixed')}
                               className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${depositType === 'fixed' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'} ${isReadOnly && depositType !== 'fixed' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                               Fixed R
                            </button>
                         </div>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic ml-2">
                            Value {depositType === 'percentage' ? '(%)' : '(R)'}
                         </label>
                         <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">
                               {depositType === 'percentage' ? '%' : 'R'}
                            </span>
                            <input
                               type="number"
                               readOnly={isReadOnly}
                               value={depositAmount}
                              onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                              className={`w-full bg-slate-50 border-transparent p-4 pl-8 rounded-2xl text-xs font-bold outline-none focus:border-primary shadow-inner ${isReadOnly ? 'text-slate-500' : ''}`}
                            />
                         </div>
                      </div>
                   </div>
                   <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 flex items-center justify-between">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest italic">Calculated Secure Deposit</span>
                      <span className="text-xl font-black text-primary tracking-tight">R {depositValue.toFixed(2)}</span>
                   </div>
                </div>
               )}

             <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-xl space-y-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic text-center">Estimate Total</p>
                <div className="space-y-4">
                   {profile?.isVatRegistered && (
                      <>
                         <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                            <span className="uppercase tracking-widest opacity-60">Subtotal (Excl)</span>
                            <span>R {totals.excl.toFixed(2)}</span>
                         </div>
                         <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                            <span className="uppercase tracking-widest opacity-60">VAT (15%)</span>
                            <span>R {totals.vat.toFixed(2)}</span>
                         </div>
                      </>
                   )}
                   <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                      <span className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Job Total</span>
                      <span className="text-3xl font-black text-slate-900 tracking-tighter italic">R {totals.incl.toFixed(2)}</span>
                   </div>
                   {!isCustomer && (
                      <div className="flex items-center justify-between py-4 px-6 bg-slate-900 rounded-2xl text-white">
                         <span className="text-[10px] font-black uppercase tracking-widest italic text-primary">Balance Due After Deposit</span>
                         <span className="text-xl font-black italic tracking-tighter">R {balanceDue.toFixed(2)}</span>
                      </div>
                   )}
                </div>

                 {isCustomer ? (
                   <div className="space-y-4">
                      {job?.status === 'estimated' && (
                        <button
                          onClick={() => handleCustomerAction('accepted')}
                          disabled={isSaving}
                          className="w-full py-10 md:py-8 bg-green-600 text-white rounded-[2.5rem] font-black uppercase tracking-widest text-base md:text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4"
                        >
                           {isSaving ? <Loader2 className="w-8 h-8 animate-spin" /> : <CheckCircle2 className="w-8 h-8" />}
                           Pay Deposit & Secure Specialist
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => handleCustomerAction('declined')}
                          disabled={isSaving}
                          className="w-full py-6 bg-white border border-slate-200 text-red-500 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-red-50 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                           Decline Estimate
                        </button>
                        <button
                          onClick={() => handleCustomerAction('cancelled')}
                          disabled={isSaving}
                          className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2"
                        >
                           Cancel Job
                        </button>
                      </div>
                   </div>
                 ) : estimateId ? (
                    <div className="space-y-4">
                      {!isReadOnly && (
                        <button
                          onClick={handleSaveEstimate}
                          disabled={isSaving || isFinalizing || lineItems.length === 0}
                          className="w-full py-10 md:py-8 bg-primary text-white rounded-[2.5rem] font-black uppercase tracking-widest text-base md:text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4"
                        >
                           {(isSaving || isFinalizing) ? <Loader2 className="w-8 h-8 animate-spin" /> : 'Update & Resend'}
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => router.push(`/jobs/view/invoice?id=${id}&estimateId=${estimateId}`)}
                          className="w-full py-6 bg-white border border-slate-200 text-slate-700 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:border-primary hover:text-primary transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                           Convert to Invoice
                        </button>
                        <button
                          onClick={handleDownloadPdf}
                          className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2"
                        >
                           <Download className="w-3 h-3" />
                           Download Estimate
                        </button>
                      </div>
                    </div>
                 ) : (
                   <button
                     onClick={handleSaveEstimate}
                     disabled={isSaving || isFinalizing || lineItems.length === 0}
                     className="w-full py-10 md:py-8 bg-primary text-white rounded-[2.5rem] font-black uppercase tracking-widest text-base md:text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4"
                   >
                     {(isSaving || isFinalizing) ? <Loader2 className="w-8 h-8 animate-spin" /> : 'Issue Estimate'}
                   </button>
                 )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EstimatePage() {
  return (
    <Suspense fallback={
       <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
       </div>
    }>
       <EstimateContent />
    </Suspense>
  );
}
