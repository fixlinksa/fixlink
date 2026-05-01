'use client';

import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Tag, 
  MessageCircle, 
  CheckCircle2, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp,
  Clock,
  FileText,
  PlusCircle,
  Loader2,
  Layers,
  Rocket,
  Star,
  Edit3,
  Trash2,
  XCircle,
  Play,
  CheckCircle,
  AlertCircle,
  ScrollText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { 
  getJob, 
  completeJobWithRating, 
  markJobAsCompleteByPro, 
  deleteJob, 
  declineJob, 
  updateJob, 
  updateEstimate, 
  createChatThread, 
  repairJobFinancials, 
  sendMessage, 
  getEstimatesByJob, 
  getInvoicesByJob, 
  createNotification, 
  getUserProfile, 
  markDepositAsPaid,
  markJobAsPaid
} from '@/lib/db';
import { PdfStatement } from '@/components/PdfStatement';
import jsPDF from 'jspdf';
import { renderPdfCanvas } from '@/lib/pdfSanitizer';

export const dynamic = 'force-static';

import { Suspense } from 'react';

function JobDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const id = searchParams.get('id');
  const [job, setJob] = useState<any>(null);
  const [proProfile, setProProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'estimates' | 'invoices'>('overview');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loadingEstimates, setLoadingEstimates] = useState<boolean>(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Derived Operative States
  const isTradesmanView = profile?.role === 'tradesman';
  const isAdminView = profile?.role === 'admin';
  const tier = profile?.tier as string;
  const isPending = job?.status === 'pending';
  const isAssigned = job?.tradesmanId === user?.uid;
  const canEstimate = (tier === 'gold' || tier === 'platinum') && (job?.tradesmanId === user?.uid || (isPending && isTradesmanView));
  const canInvoice = (tier === 'gold' || tier === 'platinum') && job?.tradesmanId === user?.uid;

  useEffect(() => {
    loadJob();
    // Prefetch all financial data for the Statement PDF engine
    loadEstimates();
    loadInvoices();
  }, [id, user, profile, authLoading]);

  const loadJob = async () => {
    if (!id) {
       console.error('JOB DATA MISSING: No job ID provided in query parameters.');
       router.push('/dashboard?error=missing_id');
       return;
    }
    
    setJob(null);
    setLoading(true);
    try {
      const data = await getJob(id);
      
      // Privacy Guard: Allow owner, customer, OR any professional IF the job is pending (lead)
      // IMPORTANT: Wait for authLoading to be false before triggering unauthorized redirects
      if (!authLoading && data && user) {
        const isOwner = data.customerId === user.uid;
        const isAssignedPro = data.tradesmanId === user.uid;
        const isCustomer = data.customerId === user.uid;
        const userRole = (profile?.role || '').toLowerCase();
        const isTradesman = userRole === 'tradesman' || userRole === 'professional' || userRole === 'pro';
        const isAdmin = userRole === 'admin';

        // Privacy Guard: Allow if owner, customer, admin, or if it's an open job being viewed by a pro
        const jobStatus = (data.status || '').toLowerCase();
        const publicStatuses = ['pending', 'available', 'open', 'estimated', 'quoted', 'declined', 'lead'];
        const isPublicAccess = publicStatuses.includes(jobStatus) && isTradesman;
        
        console.log('DEBUG [Privacy Guard]:', { 
          jobId: id,
          userUid: user.uid,
          userRole: profile?.role,
          jobStatus: data.status,
          isOwner,
          isCustomer,
          isAssignedPro,
          isAdmin,
          isTradesman,
          isPublicAccess,
          matchesPublicStatus: publicStatuses.includes(jobStatus)
        });

        if (!isOwner && !isCustomer && !isAssignedPro && !isPublicAccess && !isAdmin) {
           console.warn("Privacy Guard: Unauthorized access attempt. Redirecting to dashboard.", { 
             status: data.status, 
             role: profile?.role,
             isOwner,
             isCustomer,
             isAssignedPro,
             isPublicAccess,
             isAdmin
           });
           router.push(`/dashboard?error=unauthorized&status=${data.status}&role=${profile?.role}`);
           return;
        }
      } else if (!authLoading && !user) {
         console.warn('RECON FAILURE: No authenticated operative detected. Redirecting to login.');
         router.push('/login');
         return;
      }

      setJob(data);
      
      // Security-Aware Data Fetching: 
      // Professionals only fetch their own estimates/invoices to avoid permission errors
      const filterId = isTradesmanView ? user?.uid : undefined;
      
      const [invs, ests] = await Promise.all([
        getInvoicesByJob(id, filterId),
        getEstimatesByJob(id, filterId)
      ]);
      setInvoices(invs);
      setEstimates(ests);
      
      // Load pro profile for statement if not already loaded
      if (data?.tradesmanId) {
        const pProfile = await getUserProfile(data.tradesmanId);
        setProProfile(pProfile);
      } else if (isTradesmanView) {
        setProProfile(profile);
      }

      if (data?.rating) setRating(data.rating);
      if (data?.review) setReview(data.review);
    } catch (error) {
      console.error('Error loading job:', error);
      router.push('/dashboard?error=load_failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-trigger rating modal if job is completed by pro but not yet rated by customer
    if (!isTradesmanView && job?.status === 'completed' && !job?.rating && !showRatingModal && !loading) {
      setShowRatingModal(true);
    }
  }, [job, isTradesmanView, showRatingModal, loading]);

  const handleMarkAsDone = async () => {
    if (!job || !user) return;
    if (!confirm("Are you sure you want to mark this job as complete? This will notify the customer and prepare the project for final review.")) return;
    
    setSubmitting(true);
    try {
       await markJobAsCompleteByPro(job.id);
       
       // Tactical Email Dispatch
       if (job.customerEmail) {
          try {
             await fetch('/api/email/completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                   to: job.customerEmail,
                   proName: profile?.businessName || profile?.fullName || 'Fix Link Professional',
                   jobTitle: job.title
                })
             });
          } catch (e) {
             console.warn("Email dispatch failed, but DB record secured.", e);
          }
       }
       
       await loadJob();
    } catch (err) {
       console.error("Mark as complete failed:", err);
       alert("Action failed: Protocol synchronization error.");
    } finally {
       setSubmitting(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!job || !user) return;
    if (!confirm("Mark this entire mission as paid? This will reconcile all balances.")) return;
    
    setSubmitting(true);
    try {
       await markJobAsPaid(job.id);
       await loadJob();
    } catch (err) {
       console.error("Mark as paid failed:", err);
       alert("Action failed: Financial reconciliation error.");
    } finally {
       setSubmitting(false);
    }
  };

  const loadEstimates = async () => {
    if (!id) return;
    setLoadingEstimates(true);
    try {
      // Security Filter: Professionals only see their own estimates
      const filterId = isTradesmanView ? user?.uid : undefined;
      const data = await getEstimatesByJob(id, filterId);
      
      // Data Enrichment: Fetch professional ratings and details for each estimate
      const enrichedEstimates = await Promise.all(data.map(async (est: any) => {
         if (est.tradesmanId) {
            const proProfile = await getUserProfile(est.tradesmanId);
            return {
               ...est,
               tradesmanName: proProfile?.businessName || proProfile?.fullName || est.tradesmanName || 'Professional',
               tradesmanRating: proProfile?.rating || 0,
               tradesmanReviewCount: proProfile?.reviewCount || 0,
               total: est.total || est.amount || 0
            };
         }
         return { ...est, tradesmanRating: 0, total: est.total || est.amount || 0 };
      }));

      // Strategic Ranking: Sort by Rating (DESC) then by Creation Date (DESC)
      const sorted = enrichedEstimates.sort((a, b) => {
         const ratingDiff = (b.tradesmanRating || 0) - (a.tradesmanRating || 0);
         if (ratingDiff !== 0) return ratingDiff;
         
         const aTime = a.createdAt?.seconds || 0;
         const bTime = b.createdAt?.seconds || 0;
         return bTime - aTime;
      });

      setEstimates(sorted);
    } catch (error) {
      console.error('Error loading estimates:', error);
    } finally {
      setLoadingEstimates(false);
    }
  };

  const loadInvoices = async () => {
    if (!id) return;
    setLoadingInvoices(true);
    try {
      const data = await getInvoicesByJob(id);
      setInvoices(data);
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleAcceptEstimate = async (estimate: any) => {
    if (!job || !user) return;
    if (!confirm(`Are you sure you want to assign ${estimate.tradesmanName || 'this professional'} to this job? This will lock the job.`)) return;
    setSubmitting(true);
    try {
       // 1. Assign professional & Secure job
       await updateJob(job.id, { 
          status: 'secured', 
          tradesmanId: estimate.tradesmanId,
          tradesmanName: estimate.tradesmanName || 'Professional',
          reference: estimate.reference,
          securedAt: new Date()
       });

       // 2. Notify the winning professional
       await createNotification({
          userId: estimate.tradesmanId,
          type: 'job_update',
          title: 'Mission Secured! 🚀',
          message: `Your estimate for "${job.title}" has been accepted! You are now secured for this job.`,
          jobId: job.id
       });

       // 3. Tactical synchronized data repair
       await repairJobFinancials(job.id);

       // 4. Initiate job comms
       const chatId = await createChatThread(job.id, job.customerId, estimate.tradesmanId);
       await sendMessage(chatId, user.uid, `Job Secured: I have accepted your estimate and assigned this project to you. Let's begin briefing.`, 'customer');

       // 4. Notify losers
       const others = estimates.filter(e => e.tradesmanId !== estimate.tradesmanId);
       for (const other of others) {
          await createNotification({
            userId: other.tradesmanId,
            type: 'job_unavailable',
            title: 'Job Update',
            message: `The job "${job.title}" has been assigned to another professional.`,
            jobId: job.id
          });
       }

       // 5. Refresh
       alert("Mission Secured! You have successfully assigned this professional to your job.");
       await loadJob();
       setActiveTab('overview');
    } catch (err) {
       console.error("Accept estimate failed:", err);
       alert("PROTOCOL FAILURE: Could not secure mission. Check connectivity.");
    } finally {
       setSubmitting(false);
    }
  };

  const handleDeclineEstimate = async (estimate: any) => {
    if (!job || !user) return;
    if (!confirm(`Are you sure you want to decline this estimate from ${estimate.tradesmanName || 'this professional'}?`)) return;
    
    setSubmitting(true);
    try {
       await updateEstimate(job.id, estimate.id, {
          status: 'declined',
          updatedAt: new Date()
       });

       // Notify the professional
       await createNotification({
          userId: estimate.tradesmanId,
          type: 'job_update',
          title: 'Estimate Declined',
          message: `Your estimate for "${job.title}" has been declined by the customer.`,
          jobId: job.id
       });

       alert("Estimate declined.");
       loadEstimates();
    } catch (error) {
       console.error('Error declining estimate:', error);
       alert("Failed to decline estimate.");
    } finally {
       setSubmitting(false);
    }
  };

  const handleUnassignJob = async () => {
    if (!job) return;
    if (!confirm("Are you sure you want to release this professional? The job will return to the marketplace for other professionals to claim.")) return;
    setSubmitting(true);
    try {
       await updateJob(job.id, {
          status: 'pending',
          tradesmanId: null,
          tradesmanName: null
       });
       await loadJob();
       setActiveTab('overview');
    } catch (err) {
       console.error("Unassign failed:", err);
    } finally {
       setSubmitting(false);
    }
  };

  const handleDownloadStatement = async () => {
    if (!job) return;
    const element = document.getElementById('pdf-statement');
    if (!element) {
      console.error("PDF Engine Error: #pdf-statement not found in DOM");
      alert("System Error: Statement engine not initialized.");
      return;
    }

    setSubmitting(true);

    requestAnimationFrame(async () => {
      try {
        const canvas = await renderPdfCanvas('pdf-statement');
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        pdf.save(`Statement_${job.reference || job.id.slice(0,8)}.pdf`);
      } catch (err: any) {
        console.error('Statement generation failed:', err);
        alert(`PDF Error: ${err?.message || 'Unknown error'}. Please try again.`);
      } finally {
        setSubmitting(false);
      }
    });
  };

  const handleEmailStatement = async () => {
    if (!job || !job.customerEmail) {
      alert("Customer identity missing email record.");
      return;
    }
    
    setSubmitting(true);

    requestAnimationFrame(async () => {
      try {
        const element = document.getElementById('pdf-statement');
        if (!element) throw new Error('Statement engine offline');

        const canvas = await renderPdfCanvas('pdf-statement');
        const imgData = canvas.toDataURL('image/jpeg', 0.85);

        const res = await fetch('/api/email/statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: job.customerEmail,
            jobId: job.id,
            proName: profile?.businessName || profile?.fullName || 'Fix Link Professional',
            imageData: imgData
          })
        });

        if (!res.ok) throw new Error('Communications relay failed');

        alert('Statement dispatched successfully.');
      } catch (err: any) {
        console.error('Email statement failed:', err);
        alert(`PDF Error: ${err?.message || 'Unknown error'}. Please try again.`);
      } finally {
        setSubmitting(false);
      }
    });
  };

  const handleUnlockJob = async () => {
     if (!job) return;
     if (!confirm("Are you sure you want to UNLOCK this job? This will allow you to modify the estimate or add more work items. The job will remain assigned to you.")) return;
     setSubmitting(true);
     try {
        await updateJob(job.id, { status: 'estimated' });
        await loadJob();
        alert("Job Unlocked. You can now modify the estimate.");
     } catch (err) {
        console.error("Unlock failed:", err);
     } finally {
        setSubmitting(false);
     }
  };

  const handleCompleteJob = async () => {
     if (!job) return;
     if (!confirm("Are you sure you want to finalize and CLOSE this project? This will trigger the final invoicing process.")) return;
     setSubmitting(true);
     try {
        await updateJob(job.id, { status: 'completed' });
        await loadJob();
        router.push(`/jobs/view/invoice?id=${job.id}`);
     } catch (err) {
        console.error("Complete failed:", err);
     } finally {
        setSubmitting(false);
     }
  };

  const handleDeleteJob = async () => {
    if (!job) return;
    setSubmitting(true);
    try {
       await deleteJob(job.id);
       router.push('/dashboard/customer');
    } catch (err) {
       console.error("Delete failed:", err);
    } finally {
       setSubmitting(false);
    }
  };

  const handleOpenChat = async () => {
     if (!job?.customerId) return;
     
     // Determine operative ID: use assigned pro OR current pro if viewing a lead
     const effectiveTradesmanId = job.tradesmanId || (isTradesmanView ? user?.uid : null);
     
     if (!effectiveTradesmanId) {
        console.warn("COMMUNICATIONS ABORTED: No tradesman identity linked to this session.");
        return;
     }

     try {
        const chatId = await createChatThread(job.id, job.customerId, effectiveTradesmanId);
        router.push(`/chat?chatId=${chatId}`);
     } catch (err) {
        console.error("Chat initiation failed:", err);
     }
  };

  if (loading) return (
     <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
     </div>
  );

  if (!job) return (
     <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 font-black uppercase tracking-widest italic">Job Data Corrupted or Not Found</p>
     </div>
  );

  return (
    <div className="flex flex-col gap-8 py-8 md:py-12 max-w-6xl mx-auto px-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
         <div className="flex items-center gap-6">
            <button 
              onClick={() => router.back()}
              className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:scale-110 active:scale-95 transition-all"
            >
               <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
               <h1 className="text-3xl font-black tracking-tighter uppercase italic">{job.title}</h1>
               <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em] italic mt-1">
                  {job.category} 
                  <span className="text-slate-300 mx-2">•</span> 
                  {job.status}
                  {job.isPaid && (
                     <span className="ml-3 px-3 py-1 bg-green-500 text-white rounded-lg text-[8px] tracking-widest font-black shadow-glow">PAID</span>
                  )}
               </p>
            </div>
         </div>
         
         <div className="flex flex-col md:flex-row items-center justify-end gap-3 w-full md:w-auto">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-slate-100/80 backdrop-blur-xl rounded-[1.5rem] sm:rounded-full w-full md:w-auto justify-center md:justify-end border border-white/50 shadow-xl shadow-slate-200/40">
               {isTradesmanView ? (
                  <>
                     {isPending && (
                        <button 
                           onClick={() => router.push(`/jobs/view/estimate?id=${job.id}`)}
                           className="h-11 px-6 bg-primary text-white rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20 transition-all flex-1 md:flex-none whitespace-nowrap"
                        >
                           <TrendingUp className="w-3.5 h-3.5" /> Issue Estimate
                        </button>
                     )}
                     {isAssigned && job.status !== 'completed' && (
                        <>
                           <button 
                              onClick={() => router.push(`/jobs/view/estimate?id=${job.id}`)}
                              className="h-11 px-6 bg-white border border-slate-200 text-slate-900 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:shadow-md transition-all flex-1 md:flex-none whitespace-nowrap"
                           >
                              <TrendingUp className="w-3.5 h-3.5" /> Estimate
                           </button>
                           
                           {job.depositAmount > 0 && !job.depositPaid && (
                              <button 
                                 onClick={async () => {
                                    const baseAmount = job.amount || job.total || 0;
                                    const val = job.depositType === 'percentage' ? (baseAmount * job.depositAmount / 100) : job.depositAmount;
                                    if (!confirm(`Mark deposit of R${val.toFixed(2)} as paid?`)) return;
                                    setSubmitting(true);
                                    try {
                                       await markDepositAsPaid(job.id, val);
                                       await loadJob();
                                    } finally {
                                       setSubmitting(false);
                                    }
                                 }}
                                 disabled={submitting}
                                 className="h-11 px-6 bg-orange-500 text-white rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 flex-1 md:flex-none whitespace-nowrap"
                              >
                                 <ShieldCheck className="w-3.5 h-3.5" /> Deposit
                              </button>
                           )}

                           {(job.status === 'invoiced' || job.status === 'billed') && !job.isPaid && (
                              <button 
                                 onClick={handleMarkAsPaid}
                                 disabled={submitting}
                                 className="h-11 px-6 bg-blue-600 text-white rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 flex-1 md:flex-none whitespace-nowrap"
                              >
                                 {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Mark Paid
                              </button>
                           )}

                           <button 
                              onClick={handleMarkAsDone}
                              disabled={submitting}
                              className="h-11 px-6 bg-green-500 text-white rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 flex-1 md:flex-none whitespace-nowrap"
                           >
                              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />} Finalize
                           </button>

                           <button 
                              onClick={handleDownloadStatement}
                              className="h-11 px-6 bg-white border border-slate-200 text-slate-700 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm flex-1 md:flex-none whitespace-nowrap"
                           >
                              <ScrollText className="w-3.5 h-3.5" /> Statement
                           </button>

                           <button 
                              onClick={handleEmailStatement}
                              disabled={submitting}
                              className="h-11 px-6 bg-slate-900 text-white rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 shadow-lg shadow-slate-900/20 transition-all disabled:opacity-50 flex-1 md:flex-none whitespace-nowrap"
                           >
                              <Rocket className="w-3.5 h-3.5" /> Email
                           </button>

                           <button 
                              onClick={async () => {
                                 if (!confirm("Decline this job? It will return to the marketplace.")) return;
                                 await declineJob(job.id);
                                 router.push('/dashboard/tradesman/leads');
                              }}
                              disabled={submitting}
                              className="h-11 px-6 bg-white border border-red-100 text-red-500 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 transition-all disabled:opacity-50 flex-1 md:flex-none whitespace-nowrap"
                           >
                              <XCircle className="w-3.5 h-3.5" /> Decline
                           </button>
                        </>
                     )}
                  </>
               ) : (
                  <>
                     {isPending ? (
                        <>
                           <button 
                              onClick={() => router.push(`/jobs/view/edit?id=${job.id}`)}
                              className="h-11 px-6 bg-white border border-slate-200 text-slate-900 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:shadow-md transition-all flex-1 md:flex-none whitespace-nowrap"
                           >
                              <Edit3 className="w-3.5 h-3.5" /> Edit
                           </button>
                           <button 
                              onClick={() => setShowDeleteModal(true)}
                              disabled={submitting}
                              className="h-11 px-6 bg-white border border-red-100 text-red-500 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 transition-all disabled:opacity-50 flex-1 md:flex-none whitespace-nowrap"
                           >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                           </button>
                        </>
                     ) : job.tradesmanId && (
                        <>
                           <button 
                              onClick={handleOpenChat}
                              className="h-11 px-6 bg-primary text-white rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20 transition-all flex-1 md:flex-none whitespace-nowrap"
                           >
                              <MessageCircle className="w-3.5 h-3.5" /> Message
                           </button>
                           {job.status === 'secured' && (
                              <button 
                                 onClick={handleUnassignJob}
                                 disabled={submitting}
                                 className="h-11 px-6 bg-white border border-orange-100 text-orange-500 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-orange-50 transition-all flex-1 md:flex-none whitespace-nowrap"
                              >
                                 <XCircle className="w-3.5 h-3.5" /> Return
                              </button>
                           )}
                           {job.status === 'completed' && !isTradesmanView && (
                              <button 
                                 disabled={!job.isPaid}
                                 onClick={() => setShowRatingModal(true)}
                                 className={cn(
                                   "h-11 px-6 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm flex-1 md:flex-none whitespace-nowrap",
                                   job.isPaid ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                 )}
                              >
                                 <Star className={cn("w-3.5 h-3.5", job.isPaid ? "text-accent" : "text-slate-300")} /> 
                                 {!job.isPaid ? 'Awaiting Payment' : (job.rating ? 'Re-evaluate' : 'Rate Pro')}
                              </button>
                           )}
                        </>
                     )}
                  </>
               )}
            </div>
          </div>

      </header>

      {job.status === 'secured' && !isTradesmanView && (
         <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-primary text-white rounded-[2.5rem] shadow-2xl shadow-primary/30 flex items-center justify-between border-2 border-white/20 overflow-hidden relative"
         >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 animate-pulse" />
            <div className="flex items-center gap-6 relative z-10">
               <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <ShieldCheck className="w-10 h-10 text-white" />
               </div>
               <div>
                  <h2 className="text-xl font-black uppercase italic tracking-tight">Mission Secured</h2>
                  <p className="text-[11px] font-bold text-white/80 uppercase tracking-widest italic">Operational deployment confirmed. Your professional is active.</p>
               </div>
            </div>
            <div className="hidden md:flex items-center gap-2 px-6 py-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/30">
               <Rocket className="w-5 h-5 animate-bounce" />
               <span className="text-[11px] font-black uppercase tracking-widest italic">Live Status: Operational</span>
            </div>
         </motion.div>
      )}

      <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-100 rounded-2xl w-full md:w-fit mx-auto md:mx-0">
         {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'estimates', label: 'Estimates', icon: TrendingUp },
            { id: 'invoices', label: 'Invoices', icon: FileText, hidden: !isTradesmanView && job.status === 'pending' }
         ].filter(t => !t.hidden).map((tab) => (
            <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={cn(
                  "flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex-1 md:flex-none",
                  activeTab === tab.id 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-slate-400 hover:text-slate-600"
               )}
            >
               <tab.icon className={cn("w-3.5 h-3.5", activeTab === tab.id ? "text-white" : "text-slate-400")} />
               {tab.label}
            </button>
         ))}
      </div>

      <AnimatePresence mode="wait">
         {activeTab === 'overview' && (
            <motion.div 
               key="overview"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
               {/* Left: Job Specs */}
               <div className="lg:col-span-8 space-y-12">
                  <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm space-y-10 relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                     
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                        <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-[2rem]">
                           <MapPin className="w-6 h-6 text-primary" />
                           <div>
                              <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest italic">Location Hub</p>
                              <p className="text-sm font-bold text-slate-900 leading-tight">{job.location?.address || job.location || 'Cape Town, ZA'}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-[2rem]">
                           <Calendar className="w-6 h-6 text-primary" />
                           <div>
                              <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest italic">Job Launch</p>
                              <p className="text-sm font-bold text-slate-900 leading-tight">
                                 {job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000).toLocaleDateString() : 'Active Now'}
                              </p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-[2rem]">
                           <TrendingUp className="w-6 h-6 text-accent" />
                           <div>
                              <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest italic">Est. Value</p>
                              <p className="text-lg font-black text-slate-900 tracking-tighter italic">R {job.budget || job.amount || 'Market Rates'}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-[2rem]">
                           <ShieldCheck className="w-6 h-6 text-green-500" />
                           <div>
                              <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest italic">Verification</p>
                              <p className="text-sm font-bold text-slate-900 leading-tight">Identity Secured</p>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-6 pt-6 border-t border-slate-50">
                        <h2 className="text-2xl font-black text-slate-900 uppercase italic">Job <span className="text-primary">Brief</span></h2>
                        <p className="text-slate-500 leading-relaxed font-medium text-lg italic">
                           {job.description || 'No detailed brief provided for this job.'}
                        </p>
                     </div>

                     {job.images && job.images.length > 0 && (
                        <div className="space-y-6 pt-6 border-t border-slate-50">
                           <h2 className="text-2xl font-black text-slate-900 uppercase italic">Visuals</h2>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {job.images.map((img: string, i: number) => (
                                 <div key={i} className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border border-slate-200">
                                    <img src={img} alt="Job evidence" className="w-full h-full object-cover" />
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
                  </section>

                  {/* Journey Tracks */}
                  <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm overflow-hidden relative">
                     <div className="absolute top-0 left-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -ml-16 -mt-16" />
                     <h2 className="text-2xl font-black text-slate-900 mb-12 text-center uppercase italic">Job Progress <span className="text-primary">Pulse</span></h2>
                     <div className="flex items-center justify-between max-w-2xl mx-auto relative px-4">
                        <div className="absolute top-1/2 left-4 right-4 h-[2px] bg-slate-100 -translate-y-1/2 -z-10" />
                        <div 
                           className="absolute top-1/2 left-4 h-[2px] bg-primary -translate-y-1/2 -z-10 transition-all duration-1000" 
                           style={{ 
                              width: job.status === 'pending' ? '12%' : 
                                     job.status === 'estimated' ? '38%' : 
                                     job.status === 'secured' || job.status === 'assigned' ? '65%' : 
                                     '92%' 
                           }} 
                        />
                        
                        {[
                           { label: 'Deployed', icon: Clock, active: true },
                           { label: 'Analysed', icon: TrendingUp, active: job.status === 'estimated' || job.status === 'secured' || job.status === 'assigned' || job.status === 'billed' || job.status === 'completed' },
                           { label: 'Secured', icon: ShieldCheck, active: job.status === 'secured' || job.status === 'assigned' || job.status === 'billed' || job.status === 'completed' },
                           { label: 'Billed', icon: CheckCircle2, active: job.status === 'billed' || job.status === 'completed' }
                        ].map((s, i) => (
                           <div key={i} className="flex flex-col items-center gap-4 group">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                                 s.active ? 'bg-primary text-white shadow-2xl shadow-primary/30 scale-110' : 'bg-slate-50 text-slate-300'
                              }`}>
                                 <s.icon className="w-6 h-6" />
                              </div>
                              <span className={`text-[9px] font-black uppercase tracking-widest italic ${
                                 s.active ? 'text-primary' : 'text-slate-300'
                              }`}>{s.label}</span>
                           </div>
                        ))}
                     </div>
                  </section>
               </div>

               {/* Right: Intelligence Feed */}
               <div className="lg:col-span-4 space-y-12">
                  <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl space-y-8 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-slate-900 group-hover:scale-110 transition-transform rounded-bl-[10rem] -mr-16 -mt-16" />
                     <h2 className="text-xl font-black text-slate-900 uppercase italic">
                        {isTradesmanView ? 'Client' : 'Assigned Professional'} <span className="text-primary italic">Intelligence</span>
                     </h2>
                     
                     <div className="flex items-center gap-6 relative z-10">
                        <div className={cn(
                          "w-20 h-20 rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-sm border",
                          isTradesmanView ? "bg-indigo-50 border-indigo-100 text-indigo-500" : "bg-primary/5 border-primary/10 text-primary"
                        )}>
                           {(isTradesmanView ? job.customerName : job.tradesmanName)?.charAt(0) || 'H'}
                        </div>
                        <div>
                           <p className="font-black text-lg text-slate-900 tracking-tight leading-none mb-1">
                             {isTradesmanView ? job.customerName : (job.tradesmanName || 'Awaiting Professional...')}
                           </p>
                           <div className="flex items-center gap-2">
                              <div className="flex items-center text-[11px] font-black text-accent italic">
                                 ★ 4.9
                              </div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                               {isTradesmanView ? '(Verified Customer)' : '(Fix Link Elite)'}
                              </span>
                           </div>
                        </div>
                     </div>

                     <div className="pt-8 border-t border-slate-50 space-y-4">
                        <button 
                           onClick={handleOpenChat}
                           className="w-full py-4 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-black/10">
                           <MessageCircle className="w-5 h-5" /> Open Secure Chat
                        </button>
                        {isTradesmanView && (job.status === 'secured' || job.status === 'assigned') && (
                           <div className="space-y-3">
                              <button 
                                  onClick={handleCompleteJob}
                                  className="w-full py-4 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20"
                              >
                                  <CheckCircle2 className="w-5 h-5" /> Close & Finalize Job
                              </button>
                              <button 
                                  onClick={handleUnlockJob}
                                  className="w-full py-4 bg-white border-2 border-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
                              >
                                  <XCircle className="w-5 h-5" /> Unlock for More Work
                              </button>
                           </div>
                        )}
                        {!isTradesmanView && job.status === 'completed' && !job.rating && (
                           <button 
                              disabled={!job.isPaid}
                              onClick={() => setShowRatingModal(true)}
                              className={cn(
                                "w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl",
                                job.isPaid ? "bg-green-500 text-white shadow-green-500/20 hover:scale-[1.02] active:scale-95" : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                              )}
                           >
                              <Star className={cn("w-5 h-5", job.isPaid ? "fill-white" : "fill-slate-300")} /> 
                              {job.isPaid ? 'Rate Professional & Close Project' : 'Awaiting Final Payment to Rate'}
                           </button>
                        )}
                     </div>
                  </div>

                  <div className="p-10 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl border border-white/5">
                     <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mb-16 -mr-16" />
                     <TrendingUp className="w-8 h-8 text-primary mb-6" />
                     <h3 className="font-black text-xl mb-4 italic uppercase tracking-tight">Need Support?</h3>
                     <p className="text-sm text-slate-400 font-medium italic leading-relaxed mb-8">Fix Link Hero Support is active 24/7 for operational guidance and job logistics.</p>
                     <button className="text-[11px] font-black text-primary uppercase tracking-widest border-b-2 border-primary/20 pb-1 hover:border-primary transition-all italic">Launch Direct Support</button>
                  </div>
               </div>
            </motion.div>
         )}

         {activeTab === 'estimates' && (
            <motion.div 
               key="estimates"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               className="space-y-8"
            >
               <div className="bg-white rounded-[4rem] border border-slate-100 shadow-sm p-12 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                     <div>
                        <h3 className="text-2xl font-black uppercase tracking-tight italic mb-1">Estimate <span className="text-primary">Vault</span></h3>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Received quotes for this job</p>
                     </div>
                     {isTradesmanView && (
                        <button 
                           onClick={() => router.push(`/jobs/view/estimate?id=${job.id}`)}
                           className="px-6 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[11px] hover:scale-105 transition-all shadow-xl shadow-primary/20"
                        >
                           Issue New Estimate
                        </button>
                     )}
                  </div>

                  {loadingEstimates ? (
                     <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                     </div>
                  ) : estimates.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {estimates.map((est) => (
                           <div key={est.id} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:border-primary/20 transition-all group">
                              <div className="flex items-center justify-between mb-6">
                                 <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center font-black text-primary border border-slate-100 shadow-sm">
                                       {est.tradesmanName?.charAt(0) || 'P'}
                                    </div>
                                    <div>
                                       <h4 className="font-black text-slate-900 uppercase italic tracking-tight">{est.tradesmanName || 'Professional'}</h4>
                                       <div className="flex items-center gap-2">
                                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Validated Fix Link Hero</p>
                                          {est.tradesmanRating > 0 && (
                                             <div className="flex items-center text-[11px] font-black text-accent italic">
                                                <Star className="w-3 h-3 fill-accent mr-1" />
                                                {est.tradesmanRating}
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 italic">Total Quote</p>
                                    <h4 className="text-2xl font-black text-slate-900 tracking-tighter italic">R {est.total || '0'}<span className="text-xs opacity-20">.00</span></h4>
                                 </div>
                              </div>

                              <div className="pt-6 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-4">
                                 <button 
                                    onClick={() => router.push(`/jobs/view/estimate?id=${job.id}&estimateId=${est.id}`)}
                                    className="w-full sm:w-auto px-6 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all flex items-center justify-center gap-2"
                                 >
                                    View Detailed Briefing
                                 </button>
                                 {!isTradesmanView && ['pending', 'estimated', 'quoted', 'assigned', 'accepted'].includes(job.status) && (
                                      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                         <button 
                                            onClick={() => handleAcceptEstimate(est)}
                                            disabled={submitting || est.status === 'declined'}
                                            className="flex-1 sm:flex-none px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 active:scale-95 shadow-xl shadow-primary/20 transition-all disabled:opacity-50"
                                         >
                                            <CheckCircle className="w-4 h-4" /> Accept & Lock
                                         </button>
                                         {est.status !== 'declined' && (
                                            <button 
                                               onClick={() => handleDeclineEstimate(est)}
                                               disabled={submitting}
                                               className="flex-1 sm:flex-none px-8 py-4 bg-white border border-red-100 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 transition-all disabled:opacity-50"
                                            >
                                               <XCircle className="w-4 h-4" /> Decline
                                            </button>
                                         )}
                                      </div>
                                   )}

                                  {!isTradesmanView && est.status === 'declined' && (
                                     <span className="px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 italic">
                                        <XCircle className="w-3.5 h-3.5" /> Declined
                                     </span>
                                  )}
                                 {!isTradesmanView && job.tradesmanId === est.tradesmanId && (
                                    <span className="px-4 py-2 bg-green-500/10 text-green-500 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                       <CheckCircle2 className="w-3.5 h-3.5" /> Secured
                                    </span>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="py-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                           <TrendingUp className="w-8 h-8 text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-black uppercase tracking-[0.2em] italic text-sm">
                           Intelligence Feed Empty.
                        </p>
                        <p className="text-[11px] text-slate-300 font-black uppercase tracking-widest italic">
                           {isTradesmanView ? 'You have not issued any financial briefings for this job.' : 'Awaiting professional briefings and cost analysis calculations.'}
                        </p>
                     </div>
                  )}
               </div>
            </motion.div>
         )}

         {activeTab === 'invoices' && (
            <motion.div 
               key="invoices"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               className="bg-white rounded-[4rem] border border-slate-100 shadow-sm p-12 min-h-[400px] flex flex-col"
            >
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                  <div>
                     <h3 className="text-2xl font-black uppercase tracking-tight italic mb-1">Invoice <span className="text-primary">Terminal</span></h3>
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Financial briefings and billing records</p>
                  </div>
                  {isTradesmanView && (
                     <button 
                        onClick={() => router.push(`/jobs/view/invoice?id=${job.id}`)}
                        className="px-6 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-[11px] hover:scale-105 transition-all shadow-xl shadow-primary/20"
                     >
                        Generate Final Invoice
                     </button>
                  )}
               </div>

               {loadingInvoices ? (
                  <div className="flex items-center justify-center py-20 flex-1">
                     <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
               ) : invoices.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {invoices.map((inv) => (
                        <div key={inv.id} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:border-primary/20 transition-all group">
                           <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center font-black text-primary border border-slate-100 shadow-sm">
                                    <FileText className="w-6 h-6" />
                                 </div>
                                 <div>
                                    <h4 className="font-black text-slate-900 uppercase italic tracking-tight">Invoice #{inv.id.slice(0, 5).toUpperCase()}</h4>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                                       {inv.createdAt?.seconds ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                                    </p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1 italic">Total Amount</p>
                                 <h4 className="text-2xl font-black text-slate-900 tracking-tighter italic">R {inv.total || inv.amount || '0'}<span className="text-xs opacity-20">.00</span></h4>
                              </div>
                           </div>

                            <div className="pt-6 border-t border-slate-200/50 flex items-center justify-between gap-4">
                               <button 
                                  onClick={() => router.push(`/jobs/view/invoice?id=${job.id}`)}
                                  className="px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all flex items-center gap-2"
                               >
                                  View Full Invoice <ChevronRight className="w-3 h-3" />
                                </button>
                                <div className="flex items-center gap-2">
                                   <span className={cn(
                                      "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest",
                                      job.isPaid ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"
                                   )}>
                                      {job.isPaid ? 'PAID' : 'OUTSTANDING'}
                                   </span>
                                </div>
                            </div>
                         </div>
                      ))}
                   </div>
               ) : (
                  <div className="flex flex-col items-center justify-center text-center py-20 flex-1">
                     <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                        <FileText className="w-10 h-10 text-slate-200" />
                     </div>
                     <p className="text-slate-400 font-black uppercase tracking-[0.2em] italic text-sm mb-2">
                        Invoice Feed Empty.
                     </p>
                     <p className="text-[11px] text-slate-300 font-black uppercase tracking-widest italic max-w-xs">
                        {isTradesmanView ? 'You have not issued any financial briefings for this job.' : 'Awaiting professional briefings and cost analysis calculations.'}
                     </p>
                  </div>
               )}
            </motion.div>
         )}
      </AnimatePresence>

      {/* Rating Modal */}
      <AnimatePresence>
        {showRatingModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (job?.rating || job?.status !== 'completed') {
                  setShowRatingModal(false);
                }
              }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 rounded-[2rem] bg-green-50 flex items-center justify-center text-green-500">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                
                <h2 className="text-3xl font-black uppercase italic tracking-tighter">Job <span className="text-primary">Complete</span></h2>
                <p className="text-sm text-slate-500 font-medium">Please rate your experience with professional to close this project.</p>

                {/* Stars */}
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform active:scale-90"
                    >
                      <Star 
                        className={cn("w-8 h-8", rating >= star ? "fill-accent text-accent" : "text-slate-200")} 
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Share your experience... (optional)"
                  className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 min-h-[120px]"
                />

                <div className="w-full flex flex-col gap-3">
                  <button 
                    disabled={submitting}
                    onClick={async () => {
                      if (!user) {
                        alert("Session synchronization required. Please log in again to complete this action.");
                        return;
                      }
                      setSubmitting(true);
                      try {
                        // Force refresh token to ensure we don't send an expired one
                        const idToken = await user.getIdToken(true);
                        console.log('--- Submission Diagnostics ---');
                        console.log('Token Length:', idToken?.length || 0);
                        const response = await fetch('/api/jobs/rate/', {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                          },
                          body: JSON.stringify({
                            jobId: job.id,
                            rating,
                            review
                          })
                        });

                        const responseText = await response.text();
                        let responseData: any = {};
                        try {
                          responseData = JSON.parse(responseText);
                        } catch (e) {
                          console.warn("Response was not JSON:", responseText);
                        }

                        if (!response.ok) {
                          const errorMessage = responseData.error || `Server Error (${response.status}): ${responseText.slice(0, 100)}`;
                          
                          if (response.status === 401) {
                            throw new Error(errorMessage || 'Your session has expired or is invalid. Please log in again.');
                          }
                          throw new Error(errorMessage);
                        }

                        setShowRatingModal(false);
                        // Refresh job data to show new rating
                        if (typeof loadJob === 'function') loadJob();
                        // Only redirect if it's the first time completing
                        if (job.status !== 'completed') {
                           router.push('/dashboard/customer?success=job_fully_closed');
                        }
                      } catch (err: any) {
                        const errorMsg = err?.message || "Internal Protocol Failure";
                        alert(`Failed to complete job: ${errorMsg}. Please re-synchronize and try again.`);
                        console.error("Job Completion Error:", err);
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs italic shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {submitting ? "Finalizing..." : (job?.rating ? "Update Rating" : "Submit & Close Job")}
                  </button>
                  {(job?.rating || job?.status !== 'completed') && (
                    <button 
                      onClick={() => setShowRatingModal(false)}
                      className="w-full py-4 text-slate-400 font-black uppercase tracking-widest text-[11px] hover:text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[3.5rem] p-12 max-w-lg w-full shadow-2xl relative z-10 border border-slate-100"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-[2rem] bg-red-50 flex items-center justify-center text-red-500 mb-8">
                  <AlertCircle className="w-10 h-10" />
                </div>
                
                <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-4">Confirm <span className="text-red-500">Deletion</span></h2>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-10">
                  Are you sure you want to delete this listing? This action is permanent and will remove the job from the marketplace immediately.
                </p>

                <div className="w-full flex flex-col gap-3">
                  <button 
                    disabled={submitting}
                    onClick={handleDeleteJob}
                    className="w-full py-5 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs italic shadow-xl shadow-red-500/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete Listing
                  </button>
                  
                  <button 
                    onClick={() => {
                       setShowDeleteModal(false);
                       router.push(`/jobs/view/edit?id=${job.id}`);
                    }}
                    className="w-full py-5 bg-slate-50 text-slate-900 rounded-2xl font-black uppercase tracking-widest text-xs italic border border-slate-100 hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Listing Instead
                  </button>

                  <button 
                    onClick={() => setShowDeleteModal(false)}
                    className="w-full py-4 text-slate-400 font-black uppercase tracking-widest text-[11px] hover:text-slate-600 transition-colors mt-2"
                  >
                    Keep Listing
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Hidden PDF Engines */}
      <div className="absolute -left-[9999px] -top-[9999px] w-[800px]" style={{ visibility: 'visible', opacity: 1 }}>
         {job && (
            <PdfStatement 
               job={job} 
               profile={proProfile || (isTradesmanView ? profile : null)} 
               invoices={invoices} 
            />
         )}
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  return (
    <Suspense fallback={
       <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
       </div>
    }>
       <JobDetailContent />
    </Suspense>
  );
}
