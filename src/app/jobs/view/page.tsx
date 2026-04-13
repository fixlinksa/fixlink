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
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { getJob, completeJobWithRating, deleteJob, declineJob, updateJob, createChatThread, repairJobFinancials, sendMessage } from '@/lib/db';
import { Star, Edit3, Trash2, XCircle, Play } from 'lucide-react';

import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-static';

import { Suspense } from 'react';

function JobDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const id = searchParams.get('id');
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'estimates' | 'invoices'>('overview');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadJob();
  }, [id, user, profile, authLoading]);

  const loadJob = async () => {
    if (!id) {
       console.error('MISSION DATA MISSING: No job ID provided in query parameters.');
       router.push('/dashboard?error=missing_id');
       return;
    }
    
    setLoading(true);
    try {
      const data = await getJob(id);
      
      // Privacy Guard: Allow owner, customer, OR any professional IF the job is pending (lead)
      // IMPORTANT: Wait for authLoading to be false before triggering unauthorized redirects
      if (!authLoading && data && user) {
        const isOwner = data.tradesmanId === user.uid;
        const isCustomer = data.customerId === user.uid;
        const isPending = data.status === 'pending';
        const isTradesman = profile?.role === 'tradesman';

        console.log('DEBUG [Privacy Guard]:', { 
          jobId: id,
          userUid: user.uid,
          jobTradesmanId: data.tradesmanId,
          jobCustomerId: data.customerId,
          jobStatus: data.status,
          userRole: profile?.role,
          isOwner,
          isCustomer,
          isPending,
          isTradesman
        });

        if (!isOwner && !isCustomer && !(isPending && isTradesman)) {
           console.warn('PROTECTION TRIGGERED: Unauthorized attempt to access mission data. Redirecting to dashboard.');
           router.push('/dashboard?error=unauthorized');
           return;
        }
      } else if (!authLoading && !user) {
         console.warn('RECON FAILURE: No authenticated operative detected. Redirecting to login.');
         router.push('/login');
         return;
      }

      setJob(data);
    } catch (error) {
      console.error('Error loading job:', error);
      router.push('/dashboard?error=load_failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptJob = async () => {
    if (!user || !job || !profile) return;
    setSubmitting(true);
    try {
       // 1. Assign professional
       await updateJob(job.id, { 
          status: 'active', 
          tradesmanId: user.uid,
          tradesmanName: profile.businessName || profile.fullName || 'Professional'
       });

       // 2. Tactical synchronized data repair (Invoices/Estimates/Chats)
       await repairJobFinancials(job.id);

       // 3. Initiate mission comms
       const chatId = await createChatThread(job.id, job.customerId, user.uid);
       await sendMessage(chatId, user.uid, `Mission Briefing: Requirement analyzed. I have accepted this mission and am ready for deployment.`, 'tradesman');

       // 4. Refresh local intelligence
       await loadJob();
       
       // 5. Navigate to comms immediately for briefing
       router.push(`/chat?chatId=${chatId}`);
    } catch (err) {
       console.error("Accept mission failed:", err);
    } finally {
       setSubmitting(false);
    }
  };

  const handleDeclineJob = async () => {
    if (!job) return;
    if (!confirm("Are you sure you want to decline this mission? It will be returned to the marketplace.")) return;
    setSubmitting(true);
    try {
       await declineJob(job.id);
       router.push('/dashboard/tradesman/leads');
    } catch (err) {
       console.error("Decline failed:", err);
    } finally {
       setSubmitting(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!job) return;
    if (!confirm("Are you sure you want to delete this mission? This cannot be undone.")) return;
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
        <p className="text-slate-400 font-black uppercase tracking-widest italic">Mission Data Corrupted or Not Found</p>
     </div>
  );

  const isTradesmanView = profile?.role === 'tradesman';
  const tier = profile?.tier as string;
  const canEstimate = (tier === 'pro' || tier === 'legend') && job.tradesmanId === user?.uid;
  const canInvoice = (tier === 'pro' || tier === 'legend') && job.tradesmanId === user?.uid;
  const isPending = job.status === 'pending';
  const isAssigned = job.tradesmanId === user?.uid;

  return (
    <div className="flex flex-col gap-8 py-8 md:py-12 max-w-6xl mx-auto px-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
         <div className="flex items-center gap-6">
            <button 
              onClick={() => router.back()}
              className="p-5 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:scale-110 active:scale-95 transition-all"
            >
               <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
               <h1 className="text-3xl font-black tracking-tighter uppercase italic">{job.title}</h1>
               <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic mt-1">{job.category} <span className="text-slate-300 mx-2">•</span> {job.status}</p>
            </div>
         </div>
         
         <div className="flex gap-4">
            {isTradesmanView ? (
               <>
                  {isPending && (
                     <button 
                        onClick={handleAcceptJob}
                        disabled={submitting}
                        className="px-8 py-5 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:scale-105 active:scale-95 shadow-2xl shadow-primary/20 transition-all disabled:opacity-50"
                     >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Accept Mission
                     </button>
                  )}
                  {isAssigned && job.status !== 'completed' && (
                     <button 
                        onClick={handleDeclineJob}
                        disabled={submitting}
                        className="px-8 py-5 bg-white border border-red-100 text-red-500 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-red-50 transition-all disabled:opacity-50"
                     >
                        <XCircle className="w-4 h-4" /> Decline
                     </button>
                  )}
                  {canEstimate && job.status !== 'completed' && (
                     <button 
                       onClick={() => router.push(`/jobs/view/estimate?id=${job.id}`)}
                       className="px-8 py-5 bg-white border border-slate-100 text-slate-900 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:shadow-xl transition-all"
                     >
                        <TrendingUp className="w-4 h-4" /> Issue Estimate
                     </button>
                  )}
                  {canInvoice && job.status !== 'completed' && (
                     <button 
                       onClick={() => router.push(`/jobs/view/invoice?id=${job.id}`)}
                       className="px-8 py-5 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:scale-105 active:scale-95 shadow-2xl shadow-primary/20 transition-all"
                     >
                        <FileText className="w-4 h-4" /> Final Invoice
                     </button>
                  )}
               </>
            ) : (
               <>
                  {isPending ? (
                     <div className="flex gap-4">
                        <button 
                           onClick={() => router.push(`/jobs/view/edit?id=${job.id}`)}
                           className="px-8 py-5 bg-white border border-slate-100 text-slate-900 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:shadow-xl transition-all"
                        >
                           <Edit3 className="w-4 h-4" /> Edit Mission
                        </button>
                        <button 
                           onClick={handleDeleteJob}
                           disabled={submitting}
                           className="px-8 py-5 bg-white border border-red-100 text-red-500 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-red-50 transition-all disabled:opacity-50"
                        >
                           <Trash2 className="w-4 h-4" /> Abort
                        </button>
                     </div>
                  ) : job.tradesmanId && (
                      <button 
                         onClick={handleOpenChat}
                         className="px-8 py-5 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:scale-105 active:scale-95 shadow-2xl shadow-primary/20 transition-all"
                      >
                         <MessageCircle className="w-4 h-4" /> Message Professional
                      </button>
                  )}
               </>
            )}
         </div>
      </header>

      {/* Hero Tabs */}
      <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-[2.5rem] w-fit mx-auto md:mx-0">
         {[
            { id: 'overview', label: 'Active Projects', icon: Layers },
            { id: 'estimates', label: 'Estimates', icon: TrendingUp, hidden: !canEstimate },
            { id: 'invoices', label: 'Invoices', icon: FileText, hidden: !canInvoice }
         ].filter(t => !t.hidden).map((tab) => (
            <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`flex items-center gap-3 px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id 
                  ? 'bg-white text-slate-900 shadow-xl scale-105' 
                  : 'text-slate-400 hover:text-slate-600'
               }`}
            >
               <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-primary' : ''}`} />
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
               {/* Left: Mission Specs */}
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
                              <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest italic">Mission Launch</p>
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
                        <h2 className="text-2xl font-black text-slate-900 uppercase italic">Mission <span className="text-primary">Brief</span></h2>
                        <p className="text-slate-500 leading-relaxed font-medium text-lg italic">
                           {job.description || 'No detailed brief provided for this mission.'}
                        </p>
                     </div>

                     {job.images && job.images.length > 0 && (
                        <div className="space-y-6 pt-6 border-t border-slate-50">
                           <h2 className="text-2xl font-black text-slate-900 uppercase italic">Visuals</h2>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {job.images.map((img: string, i: number) => (
                                 <div key={i} className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border border-slate-200">
                                    <img src={img} alt="Mission evidence" className="w-full h-full object-cover" />
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
                  </section>

                  {/* Journey Tracks */}
                  <section className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm overflow-hidden relative">
                     <div className="absolute top-0 left-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -ml-16 -mt-16" />
                     <h2 className="text-2xl font-black text-slate-900 mb-12 text-center uppercase italic">Mission Progress <span className="text-primary">Pulse</span></h2>
                     <div className="flex items-center justify-between max-w-2xl mx-auto relative px-4">
                        <div className="absolute top-1/2 left-4 right-4 h-[2px] bg-slate-100 -translate-y-1/2 -z-10" />
                        <div className="absolute top-1/2 left-4 w-1/3 h-[2px] bg-primary -translate-y-1/2 -z-10" />
                        
                        {[
                           { label: 'Deployed', icon: Clock, active: true },
                           { label: 'Analysed', icon: TrendingUp, active: true },
                           { label: 'Secured', icon: ShieldCheck, active: job.status !== 'pending' },
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
                              <div className="flex items-center text-[10px] font-black text-accent italic">
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
                           className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-black/10">
                           <MessageCircle className="w-5 h-5" /> Open Secure Chat
                        </button>
                        {isTradesmanView && isAssigned && (
                           <button 
                               onClick={() => router.push(`/jobs/view/invoice?id=${job.id}`)}
                               className="w-full py-5 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20"
                           >
                               <FileText className="w-5 h-5" /> Convert to Invoice
                           </button>
                        )}
                        {!isTradesmanView && job.status !== 'completed' && job.status !== 'cancelled' && job.status !== 'pending' && (
                           <button 
                              onClick={() => setShowRatingModal(true)}
                              className="w-full py-5 bg-green-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-green-500/20"
                           >
                              <CheckCircle2 className="w-5 h-5" /> Mark as Done & Rate
                           </button>
                        )}
                     </div>
                  </div>

                  <div className="p-10 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl border border-white/5">
                     <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mb-16 -mr-16" />
                     <TrendingUp className="w-8 h-8 text-primary mb-6" />
                     <h3 className="font-black text-xl mb-4 italic uppercase tracking-tight">Need Support?</h3>
                     <p className="text-sm text-slate-400 font-medium italic leading-relaxed mb-8">Fix Link Hero Support is active 24/7 for operational guidance and mission logistics.</p>
                     <button className="text-[10px] font-black text-primary uppercase tracking-widest border-b-2 border-primary/20 pb-1 hover:border-primary transition-all italic">Launch Direct Support</button>
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
               className="bg-white rounded-[4rem] border border-slate-100 shadow-sm p-12 min-h-[400px] flex flex-col items-center justify-center text-center"
            >
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                  <TrendingUp className="w-10 h-10 text-primary" />
               </div>
               <h3 className="text-2xl font-black uppercase tracking-tight italic mb-2">Estimate <span className="text-primary">Vault</span></h3>
               <p className="text-slate-500 font-medium max-w-sm mb-10">No estimates have been issued for this mission. Deploy a new financial analysis to provide clarity.</p>
               {isTradesmanView && (
                  <button 
                     onClick={() => router.push(`/jobs/view/estimate?id=${job.id}`)}
                     className="px-10 py-6 bg-primary text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-2xl shadow-primary/20"
                  >
                     Issue New Estimate
                  </button>
               )}
            </motion.div>
         )}

         {activeTab === 'invoices' && (
            <motion.div 
               key="invoices"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               className="bg-white rounded-[4rem] border border-slate-100 shadow-sm p-12 min-h-[400px] flex flex-col items-center justify-center text-center"
            >
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                  <FileText className="w-10 h-10 text-primary" />
               </div>
               <h3 className="text-2xl font-black uppercase tracking-tight italic mb-2">Invoice <span className="text-primary">Terminal</span></h3>
               <p className="text-slate-500 font-medium max-w-sm mb-10">Awaiting mission completion or estimate approval. No finalized invoices are currently indexed.</p>
               {isTradesmanView && (
                  <button 
                     onClick={() => router.push(`/jobs/view/invoice?id=${job.id}`)}
                     className="px-10 py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-2xl shadow-black/20"
                  >
                     Generate Final Invoice
                  </button>
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
              onClick={() => setShowRatingModal(false)}
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
                      setSubmitting(true);
                      try {
                        await completeJobWithRating(job.id, rating, review);
                        setShowRatingModal(false);
                        loadJob();
                      } catch (err: any) {
                        const errorMsg = err?.message || "Internal Protocol Failure";
                        alert(`Failed to complete mission: ${errorMsg}. Please re-synchronize and try again.`);
                        console.error("Mission Completion Error:", err);
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs italic shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {submitting ? "Finalizing..." : "Submit & Close Job"}
                  </button>
                  <button 
                    onClick={() => setShowRatingModal(false)}
                    className="w-full py-4 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
