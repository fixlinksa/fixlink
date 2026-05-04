'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  PlusSquare, 
  Clock, 
  CheckCircle2, 
  MoreHorizontal, 
  MessageSquare, 
  Navigation,
  ShieldCheck,
  Zap,
  ArrowRight,
  Bell,
  Trash2,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { 
  getJobsByCustomer, 
  getQuotesByJob, 
  markNotificationAsRead, 
  deleteChat, 
  repairJobFinancials,
  getUsersByRole,
  getDistance,
  extractCoordinates,
  db 
} from '@/lib/db';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';

export default function CustomerDashboard() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'jobs' | 'quotes' | 'pros' | 'alerts' | 'comms'>('jobs');
  const [jobs, setJobs] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [prosNearby, setProsNearby] = useState<any[]>([]);
  const [prosNearbyCount, setProsNearbyCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const notifRef = collection(db, 'notifications');
    const q = query(notifRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(20));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setNotifications(alerts);
    });

    // Chat Threads Listener (30-day edge-side policy)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const chatsRef = collection(db, 'chats');
    const qChats = query(chatsRef, where('participants', 'array-contains', user.uid));
    
    const unsubscribeChats = onSnapshot(qChats, (snapshot) => {
      const chatThreads = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as any))
        .filter(chat => {
          if (!chat.lastMessageAt) return true;
          const msgDate = chat.lastMessageAt?.toDate ? chat.lastMessageAt.toDate() : new Date(chat.lastMessageAt);
          return msgDate >= thirtyDaysAgo;
        })
        .sort((a, b) => {
          const aDate = a.lastMessageAt?.toDate ? a.lastMessageAt.toDate() : new Date(a.lastMessageAt || 0);
          const bDate = b.lastMessageAt?.toDate ? b.lastMessageAt.toDate() : new Date(b.lastMessageAt || 0);
          return bDate.getTime() - aDate.getTime();
        });

      setChats(chatThreads);
    }, (error) => {
      console.error("MISSION COMMS FAILURE [CUSTOMER]:", error);
    });

    return () => {
      unsubscribe();
      unsubscribeChats();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    // Mission Radar (Real-time Job Listener)
    const jobsRef = collection(db, 'jobs');
    const qJobs = query(
      jobsRef, 
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeJobs = onSnapshot(qJobs, async (snapshot) => {
      const customerJobs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
      setJobs(customerJobs);

      // Refresh quotes for active mission set
      const allQuotes: any[] = [];
      for (const job of customerJobs) {
         try {
            const jobQuotes = await getQuotesByJob(job.id);
            allQuotes.push(...jobQuotes.map(q => ({ ...q, jobTitle: job.title })));
         } catch (quoteErr: any) {
            if (quoteErr.code === 'permission-denied') {
              console.warn(`PERMISSION DENIED: Missing quote metadata for ${job.id}. Attempting auto-repair.`);
              await repairJobFinancials(job.id);
              try {
                const retry = await getQuotesByJob(job.id);
                allQuotes.push(...retry.map(q => ({ ...q, jobTitle: job.title })));
              } catch (e) { /* Fallback */ }
            }
         }
      }
      setQuotes(allQuotes);
      setLoading(false);
    }, (error) => {
      console.error("MISSION RADAR FAILURE [JOBS]:", error);
      setLoading(false);
    });

    return () => unsubscribeJobs();
  }, [user]);

  // Mission Reach Calculation (70km Rule)
  useEffect(() => {
    async function calculateProsNearby() {
      if (!profile?.location) return;
      
      try {
        const userCoords = extractCoordinates(profile.location);
        if (!userCoords) return;

        const allPros = await getUsersByRole('tradesman');
        const nearby = allPros.filter(pro => {
          if (!pro.location || pro.isAvailable === false) return false;
          const proCoords = extractCoordinates(pro.location);
          if (!proCoords) return false;
          const dist = getDistance(userCoords.lat, userCoords.lng, proCoords.lat, proCoords.lng);
          return dist <= 70; // Hard 70km Protocol
        });

        setProsNearby(nearby);
        setProsNearbyCount(nearby.length);
      } catch (err) {
        console.error("MISSION REACH CALCULATION FAILURE:", err);
      }
    }

    calculateProsNearby();
  }, [profile]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleAlertClick = async (notif: any) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
    }
    if (notif.chatId) {
      router.push(`/chat?chatId=${notif.chatId}`);
    } else if (notif.jobId) {
      router.push(`/jobs/view?id=${notif.jobId}`);
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!confirm("Scale back comms? This will permanently delete this mission thread.")) return;
    try {
      await deleteChat(chatId);
    } catch (err) {
      console.error("Chat deletion failed:", err);
    }
  };

  const unreadMessages = notifications.filter(n => !n.read && n.type === 'new_message').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeJobsCount = jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length;
  const totalQuotesCount = quotes.length;
  const totalSpent = jobs.reduce((acc, job) => acc + (job.amountPaid || 0), 0);

  return (
    <div className="flex flex-col gap-10 py-8 max-w-2xl mx-auto md:max-w-none">
      {/* Brand Identity / Profile Header */}
      <section className="bg-white border border-border rounded-[3rem] p-10 md:p-12 shadow-2xl shadow-primary/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="flex flex-col md:flex-row items-center gap-12 relative text-center md:text-left">
           {/* Logo Display */}
           <div className="shrink-0 group relative">
              <div className="w-32 h-32 rounded-3xl bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/20 shadow-xl transition-transform group-hover:scale-105">
                 {profile?.imageUrl ? (
                    <img src={profile.imageUrl} alt={profile.fullName} className="w-full h-full object-cover" />
                 ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground font-black text-3xl italic">
                       {profile?.fullName?.charAt(0) || "U"}
                    </div>
                 )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg border-2 border-white group-hover:rotate-12 transition-transform">
                 <ShieldCheck className="w-5 h-5 fill-current" />
              </div>
           </div>

           {/* Brand Details */}
           <div className="flex-1 space-y-4">
              <div>
                 <h2 className="text-3xl font-black tracking-tight uppercase italic">{profile?.companyName || profile?.fullName || "Your Identity"}</h2>
                 <p className="text-xs font-black uppercase tracking-widest text-muted-foreground italic flex items-center justify-center md:justify-start gap-2">
                    Verified Fix Link {profile?.isCompany ? "Business" : "Personal"} Account
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                 </p>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                 <button 
                  onClick={() => router.push('/profile')}
                  className="px-6 py-3 bg-muted/50 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-muted transition-all"
                 >
                    Set Logo
                 </button>
                 <button 
                  onClick={() => router.push('/profile')}
                  className="px-6 py-3 bg-muted/50 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-muted transition-all"
                 >
                    Account Settings
                 </button>
              </div>
           </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-4xl font-black tracking-tighter uppercase italic">My <span className="text-primary">Dashboard</span></h1>
           <p className="text-muted-foreground font-bold italic tracking-tight">Welcome back, <span className="text-foreground not-italic">{profile?.fullName?.split(' ')[0] || 'Customer'}</span>. You have {activeJobsCount} active requests.</p>
        </div>
        <Link 
           href="/jobs/new"
           className="w-full md:w-auto px-10 py-5 bg-primary text-white rounded-[2rem] font-black shadow-2xl shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-sm uppercase tracking-tight group"
         >
           <PlusSquare className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" /> Post a Job
         </Link>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Active Jobs', val: activeJobsCount.toString(), icon: Navigation, color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Total Quotes', val: totalQuotesCount.toString(), icon: MessageSquare, color: 'text-orange-500', bg: 'bg-orange-50' },
            { label: 'Pros Nearby', val: prosNearbyCount.toString(), icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50' },
            { label: 'Spent', val: `R${totalSpent.toLocaleString()}`, icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-50' },
          ].map((stat, i) => (
           <div key={i} className="p-8 bg-white rounded-[2.5rem] border border-border shadow-sm flex items-center gap-6 group hover:border-primary/20 transition-all">
               <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", stat.bg)}>
                  <stat.icon className={cn("w-7 h-7", stat.color)} />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-xl font-black">{stat.val}</p>
               </div>
           </div>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content Area */}
        <section className="lg:col-span-2 space-y-8">
           <div className="flex border-b border-border gap-10 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setActiveTab('jobs')}
                className={cn(
                   "pb-6 font-black uppercase tracking-[0.2em] text-[10px] transition-all relative",
                   activeTab === 'jobs' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                My Missions
                {activeTab === 'jobs' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-full px-2" />}
              </button>
              <button 
                onClick={() => setActiveTab('pros')}
                className={cn(
                   "pb-6 font-black uppercase tracking-[0.2em] text-[10px] transition-all relative flex items-center gap-2",
                   activeTab === 'pros' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Discover Pros
                {prosNearbyCount > 0 && (
                   <span className="bg-orange-500 text-white text-[8px] px-1.5 py-0.5 flex items-center justify-center rounded-full">
                      {prosNearbyCount}
                   </span>
                )}
                {activeTab === 'pros' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-full px-2" />}
              </button>
              <button 
                onClick={() => setActiveTab('quotes')}
                className={cn(
                   "pb-6 font-black uppercase tracking-[0.2em] text-[10px] transition-all relative",
                   activeTab === 'quotes' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Recent Quotes
                {activeTab === 'quotes' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-full px-2" />}
              </button>
              <button 
                onClick={() => setActiveTab('comms')}
                className={cn(
                   "pb-6 font-black uppercase tracking-[0.2em] text-[10px] transition-all relative flex items-center gap-2",
                   activeTab === 'comms' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Secure Chat
                {unreadMessages > 0 && (
                  <span className="bg-primary text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                    {unreadMessages}
                  </span>
                )}
                {activeTab === 'comms' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-full px-2" />}
              </button>
              <button 
                onClick={() => setActiveTab('alerts')}
                className={cn(
                   "pb-6 font-black uppercase tracking-[0.2em] text-[10px] transition-all relative flex items-center gap-2",
                   activeTab === 'alerts' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Alerts 
                {(unreadCount - unreadMessages) > 0 && (
                  <span className="bg-primary text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                    {unreadCount - unreadMessages}
                  </span>
                )}
                {activeTab === 'alerts' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-full px-2" />}
              </button>
           </div>

           {/* Activity Stream Banner */}
           {notifications.filter(n => !n.read).length > 0 && (
             <motion.div 
               initial={{ opacity: 0, y: -20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-primary p-6 rounded-[2rem] flex items-center justify-between group cursor-pointer overflow-hidden relative shadow-2xl shadow-primary/20"
               onClick={() => setActiveTab('alerts')}
             >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                <div className="flex items-center gap-4 relative">
                   <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-bounce">
                      <Bell className="w-5 h-5 text-white" />
                   </div>
                   <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50 leading-none mb-1 text-left">Recent Mission Activity</p>
                      <h4 className="text-white font-black italic uppercase tracking-tighter text-sm leading-none text-left">
                         {notifications.filter(n => !n.read).length} Unread Updates Pending
                      </h4>
                   </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white transition-all transform group-hover:translate-x-1" />
             </motion.div>
           )}

           <div className="space-y-6">
              <AnimatePresence mode="wait">
                 {activeTab === 'jobs' ? (
                   <motion.div 
                     key="jobs"
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: 20 }}
                     className="space-y-6"
                   >
                      {jobs.length === 0 ? (
                        <div className="p-12 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed border-border">
                           <Navigation className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                           <p className="text-sm font-black uppercase tracking-widest text-muted-foreground italic">No active requests found</p>
                        </div>
                      ) : jobs.map((job) => (
                        <div key={job.id} onClick={() => router.push(`/jobs/view?id=${job.id}`)} className="p-8 bg-white rounded-[3rem] border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:shadow-2xl hover:border-primary/20 transition-all cursor-pointer relative overflow-hidden">
                           <div className="flex items-center gap-8">
                              <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                                 <Navigation className="w-10 h-10" />
                              </div>
                              <div>
                                 <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{job.category}</p>
                                 <h4 className="font-black text-2xl mb-1 group-hover:text-primary transition-colors italic tracking-tight">{job.title}</h4>
                                 <p className="text-xs text-muted-foreground font-black flex items-center uppercase tracking-widest opacity-60">
                                    <Clock className="w-3.5 h-3.5 mr-2" /> Posted {job.createdAt?.toDate ? formatDistanceToNow(job.createdAt.toDate(), { addSuffix: true }) : 'Recently'}
                                 </p>
                              </div>
                           </div>
                           
                            <div className="flex flex-col items-end gap-4 shrink-0">
                               <div className="flex items-center justify-between md:flex-col md:items-end gap-3 shrink-0">
                                  <span className={cn(
                                     "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                     job.status === 'quoted' || job.status === 'estimated' || job.status === 'active' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-muted text-muted-foreground border-border"
                                  )}>
                                     {job.status}
                                  </span>
                                  {(job.amount || job.total) > 0 && (
                                    <span className={cn(
                                       "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                       job.isPaid ? "bg-green-50 text-green-600 border-green-100" : "bg-orange-50 text-orange-600 border-orange-100"
                                    )}>
                                       {job.isPaid ? 'PAID' : 'PAYMENT DUE'}
                                    </span>
                                  )}
                               </div>
                               
                               {job.status === 'completed' && (
                                  <button 
                                     onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/jobs/view?id=${job.id}&rate=true`);
                                     }}
                                     className={cn(
                                        "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm",
                                        job.rating ? "bg-white border border-slate-200 text-slate-400" : "bg-accent text-white hover:scale-105"
                                     )}
                                  >
                                     <Star className={cn("w-3.5 h-3.5", job.rating ? "text-accent fill-accent" : "fill-current")} />
                                     {job.rating ? 'Update Rating' : 'Rate Specialist'}
                                  </button>
                               )}
                            </div>
                        </div>
                      ))}
                    </motion.div>
                 ) : activeTab === 'comms' ? (
                   <motion.div 
                     key="comms"
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     className="space-y-6"
                   >
                      {chats.length === 0 ? (
                        <div className="p-12 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed border-border">
                           <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                           <p className="text-sm font-black uppercase tracking-widest text-muted-foreground italic">No active comms indexed</p>
                        </div>
                      ) : chats.map((chat) => {
                        const hasUnread = notifications.some(n => !n.read && n.chatId === chat.id);
                        return (
                          <div 
                            key={chat.id} 
                            onClick={() => router.push(`/chat?chatId=${chat.id}`)}
                            className={cn(
                               "p-8 bg-white border rounded-[3rem] flex items-center justify-between group cursor-pointer transition-all hover:shadow-2xl",
                               hasUnread ? "border-primary/20 bg-primary/5" : "border-border"
                            )}
                          >
                             <div className="flex items-center gap-6 overflow-hidden">
                                <div className={cn(
                                  "w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-black text-xl italic shrink-0",
                                  hasUnread ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                )}>
                                   {chat.tradesmanName?.charAt(0) || 'P'}
                                </div>
                                <div className="min-w-0">
                                   <div className="flex items-center gap-2">
                                     <h4 className="font-black text-slate-900 uppercase italic tracking-tight truncate">{chat.tradesmanName}</h4>
                                     {hasUnread && <div className="w-2 h-2 bg-primary rounded-full animate-ping" />}
                                   </div>
                                   <p className="text-[10px] font-black text-primary uppercase tracking-widest truncate opacity-60">Mission: {chat.jobTitle}</p>
                                   <p className="text-[11px] text-slate-400 font-bold italic truncate mt-1">{chat.lastMessage || 'Waiting for briefing...'}</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-4 shrink-0">
                                <button 
                                  onClick={(e) => handleDeleteChat(e, chat.id)}
                                  className="p-3 text-slate-200 hover:text-red-500 transition-colors"
                                >
                                   <Trash2 className="w-5 h-5" />
                                </button>
                                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                             </div>
                          </div>
                        );
                      })}
                    </motion.div>
                 ) : activeTab === 'alerts' ? (
                   <motion.div 
                     key="alerts"
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     className="space-y-6"
                   >
                      {notifications.length === 0 ? (
                        <div className="p-12 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed border-border">
                           <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                           <p className="text-sm font-black uppercase tracking-widest text-muted-foreground italic">No new alerts</p>
                        </div>
                      ) : notifications.map((n) => (
                        <div 
                           key={n.id} 
                           onClick={() => handleAlertClick(n)}
                           className={cn(
                               "p-8 bg-white border rounded-[2.5rem] flex items-center justify-between group cursor-pointer transition-all",
                               n.read ? "border-border" : "border-primary/20 bg-primary/5 shadow-xl"
                           )}
                        >
                           <div className="flex items-center gap-6">
                              <Bell className={cn("w-6 h-6", n.read ? "text-slate-300" : "text-primary")} />
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{n.title}</p>
                                 <h4 className="font-black text-slate-900 uppercase italic tracking-tight leading-tight">{n.message}</h4>
                              </div>
                           </div>
                           <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                      ))}
                    </motion.div>
                 ) : activeTab === 'quotes' ? (
                   <motion.div 
                     key="quotes"
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     className="space-y-6"
                   >
                      {quotes.length === 0 ? (
                        <div className="p-12 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed border-border">
                           <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                           <p className="text-sm font-black uppercase tracking-widest text-muted-foreground italic">No quotes received yet</p>
                        </div>
                      ) : quotes.map((quote) => (
                        <div key={quote.id} className="p-10 bg-white border border-border rounded-[3.5rem] hover:shadow-2xl transition-all group overflow-hidden relative">
                           <div className="flex items-center justify-between mb-8">
                              <div className="flex items-center gap-6">
                                 <div className="w-16 h-16 rounded-3xl bg-accent/10 flex items-center justify-center text-accent text-3xl font-black italic text-center">
                                    {(quote.tradesmanBusinessName || quote.tradesmanName || 'P').charAt(0)}
                                 </div>
                                 <div>
                                    <div className="flex items-center gap-3">
                                       <h4 className="font-black text-xl italic uppercase tracking-tighter">{quote.tradesmanBusinessName || quote.tradesmanName || 'Pro'}</h4>
                                       <ShieldCheck className="w-5 h-5 text-blue-500 fill-blue-50" />
                                    </div>
                                    <div className="flex items-center text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] italic">
                                       <span className="text-accent mr-2">★</span> {quote.tradesmanRating?.toFixed(1) || '5.0'} Rating
                                    </div>
                                 </div>
                              </div>
                              <p className="text-3xl font-black text-foreground tracking-tighter italic">R{quote.total?.toFixed(2) || '0.00'}</p>
                           </div>
                           
                           <p className="text-base font-bold text-muted-foreground mb-10 leading-relaxed">
                              Estimate sent for <span className="text-primary font-black italic underline decoration-primary/20 underline-offset-4">"{quote.jobTitle}"</span>
                           </p>

                           <div className="flex gap-4">
                              <button 
                                onClick={() => router.push(`/jobs/view/estimate?id=${quote.jobId}&estimateId=${quote.id}`)}
                                className="flex-2 py-5 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                              >
                                 Review Quote <ArrowRight className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => router.push(`/chat?proId=${quote.tradesmanId}&jobId=${quote.jobId}`)}
                                className="flex-1 py-5 bg-white border border-border text-foreground rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-muted/30 transition-all"
                              >
                                 Chat
                              </button>
                           </div>
                           
                           <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-bl-[10rem] -z-10 group-hover:scale-110 transition-transform" />
                        </div>
                      ))}
                    </motion.div>
                 ) : (
                    <motion.div 
                      key="pros"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                       <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-black uppercase italic tracking-tighter">Professionals <span className="text-primary">Nearby</span></h3>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">Within 70km Range</span>
                       </div>
                       
                       {prosNearby.length === 0 ? (
                         <div className="p-12 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed border-border">
                            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground italic">No specialized operatives detected nearby</p>
                         </div>
                       ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {prosNearby.map((pro) => (
                               <div key={pro.uid} className="bg-white p-8 rounded-[3rem] border border-border shadow-sm hover:shadow-2xl transition-all group">
                                  <div className="flex items-center gap-4 mb-6">
                                     <div className="w-16 h-16 rounded-2xl bg-muted overflow-hidden">
                                        {pro.imageUrl ? (
                                           <img src={pro.imageUrl} alt={pro.fullName} className="w-full h-full object-cover" />
                                        ) : (
                                           <div className="w-full h-full flex items-center justify-center text-xl font-black italic text-muted-foreground">
                                              {pro.fullName?.charAt(0)}
                                           </div>
                                        )}
                                     </div>
                                     <div>
                                        <h4 className="font-black text-sm uppercase italic tracking-tight">{pro.businessName || pro.fullName}</h4>
                                        <div className="flex items-center gap-2">
                                           <Star className="w-3 h-3 text-accent fill-accent" />
                                           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{pro.rating?.toFixed(1) || '5.0'}</span>
                                        </div>
                                     </div>
                                  </div>
                                  <p className="text-[11px] font-medium text-muted-foreground line-clamp-2 mb-6">
                                     {pro.bio || pro.businessDescription || "Professional specialized operative ready for mission deployment."}
                                  </p>
                                  <button 
                                     onClick={() => router.push(`/jobs/new?proId=${pro.uid}`)}
                                     className="w-full py-4 bg-muted text-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                                  >
                                     Request Briefing
                                  </button>
                               </div>
                            ))}
                         </div>
                       )}
                    </motion.div>
                 )}
              </AnimatePresence>
           </div>
        </section>

        {/* Sidebar */}
        <section className="space-y-12">
           <div className="p-10 bg-accent/5 rounded-[3.5rem] border border-accent/20 flex flex-col gap-8 relative overflow-hidden group">
              <div className="w-16 h-16 rounded-3xl bg-accent/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                 <ShieldCheck className="w-8 h-8 text-accent" />
              </div>
              <div className="relative z-10">
                 <h4 className="text-xl font-black uppercase tracking-tight italic mb-3">Fix Link <span className="text-accent">Verified</span></h4>
                 <p className="text-sm text-muted-foreground font-medium leading-relaxed mb-8">
                    All professionals on our platform go through a rigorous verification process.
                 </p>
                 <a href="/safety" className="text-accent font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 group-hover:gap-5 transition-all">
                    Safety Protocol <ArrowRight className="w-4 h-4" />
                 </a>
              </div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />
           </div>

           <div className="p-10 bg-foreground rounded-[3.5rem] text-white space-y-8 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mt-10 -mr-10" />
              <div className="space-y-2">
                 <h4 className="text-xl font-black uppercase tracking-tight italic">Concierge Support</h4>
                 <p className="text-xs text-white/50 font-black uppercase tracking-widest">Available 24/7</p>
              </div>
              <p className="text-sm text-white/70 font-medium leading-relaxed mb-6">
                 Our dedicated support team is available for any questions or project assistance.
              </p>
              <button className="w-full py-5 bg-white text-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/90 active:scale-95 transition-all">
                 Contact Help Center
              </button>
           </div>
        </section>
      </div>
    </div>
  );
}
