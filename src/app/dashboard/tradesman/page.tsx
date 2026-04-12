'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  TrendingUp, 
  MapPin, 
  Briefcase, 
  ChevronRight, 
  Clock, 
  Star,
  PlusCircle,
  FileText,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Package,
  LayoutDashboard,
  Wallet,
  Bell,
  AlertCircle,
  Loader2,
  Layers,
  Radar,
  MessageSquare,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import TradesmanProfileSetup from '@/components/tradesman/TradesmanProfileSetup';
import { getJobsByTradesman, getLeads, markNotificationAsRead, toggleAvailability, Job } from '@/lib/db';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import Link from 'next/link';
import TierSelector from '@/components/dashboard/tier-selector';
import { X } from 'lucide-react';

export default function TradesmanDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'comms' | 'leads' | 'earnings' | 'alerts'>('comms');
  const [feedPeriod, setFeedPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && profile) {
      if (!profile.trade || !profile.address) {
        setShowSetup(true);
      } else if (!profile.hasSeenWelcome) {
        router.push('/dashboard/tradesman/welcome');
      }
    }
  }, [profile, authLoading]);

  useEffect(() => {
    if (!authLoading && user?.uid) {
      loadDashboardData();
    }
  }, [authLoading, user?.uid]);

  useEffect(() => {
    if (!user) return;

    // Notifications Listener
    const notifRef = collection(db, 'notifications');
    const qNotif = query(notifRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(20));
    
    const unsubscribeNotif = onSnapshot(qNotif, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setNotifications(alerts);
    }, (error) => {
      console.error("Dashboard notifications failure:", error);
    });

    // Chat Threads Listener with Edge-Side Retention Policy
    const chatsRef = collection(db, 'chats');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Simplified query to avoid composite index requirement
    const qChats = query(
      chatsRef, 
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribeChats = onSnapshot(qChats, (snapshot) => {
      const threads = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as any))
        .filter(chat => {
          if (!chat.lastMessageAt) return true; // Keep new/empty chats
          const msgDate = chat.lastMessageAt?.toDate ? chat.lastMessageAt.toDate() : new Date(chat.lastMessageAt);
          return msgDate >= thirtyDaysAgo;
        })
        .sort((a, b) => {
          const aDate = a.lastMessageAt?.toDate ? a.lastMessageAt.toDate() : new Date(a.lastMessageAt || 0);
          const bDate = b.lastMessageAt?.toDate ? b.lastMessageAt.toDate() : new Date(b.lastMessageAt || 0);
          return bDate.getTime() - aDate.getTime();
        });
        
      setChats(threads);
    }, (error) => {
      console.error("MISSION COMMS FAILURE [TRADESMAN]:", error);
    });

    // Mission Radar (Leads) Listener
    const leadsRef = collection(db, 'leads');
    let qLeads;
    
    // Support multi-trade filtering from profile
    const trades = profile?.trades || (profile?.trade ? [profile.trade] : []);
    
    if (trades.length > 0) {
      qLeads = query(leadsRef, where('category', 'in', trades), orderBy('createdAt', 'desc'), limit(50));
    } else {
      qLeads = query(leadsRef, orderBy('createdAt', 'desc'), limit(50));
    }

    const unsubscribeLeads = onSnapshot(qLeads, (snapshot) => {
      const radarLeads = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setLeads(radarLeads);
      if (loadingData) setLoadingData(false);
    }, (error) => {
      console.error("MISSION RADAR FAILURE [TRADESMAN]:", error);
      if (loadingData) setLoadingData(false);
    });

    return () => {
      unsubscribeNotif();
      unsubscribeChats();
      unsubscribeLeads();
    };
  }, [user, profile]);

  const loadDashboardData = async () => {
    // Only fetch static jobs once, leads are handled by real-time listener
    if (!user) return;
    try {
      const jobsData = await getJobsByTradesman(user.uid);
      setJobs(jobsData);
    } catch (error) {
      console.error('Dashboard jobs load failed:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const unreadMessages = notifications.filter(n => !n.read && n.type === 'new_message').length;

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

  const [toggling, setToggling] = useState(false);
  const handleToggleAvailability = async () => {
    if (!user) return;
    setToggling(true);
    try {
      await toggleAvailability(user.uid, !profile?.isAvailable);
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setToggling(false);
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!confirm("Scale back comms? This will permanently delete this mission thread.")) return;
    try {
      const { deleteChat } = await import('@/lib/db');
      await deleteChat(chatId);
    } catch (err) {
      console.error("Chat deletion failed:", err);
    }
  };

  const isBusy = profile?.isAvailable === false;

  const revenue = jobs
    .filter(j => j.status === 'completed' || j.status === 'invoiced')
    .reduce((acc: number, curr: Job) => acc + (curr.total || 0), 0);

  const activeProjectsCount = jobs.filter(j => 
    j.status !== 'completed' && 
    j.status !== 'cancelled' && 
    j.status !== 'declined'
  ).length;

  // Feed time-period filtering: show jobs where customer contacted this professional
  const getFeedCutoff = () => {
    const now = new Date();
    if (feedPeriod === 'day') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (feedPeriod === 'week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // month
  };

  // Feed = jobs linked to this professional, that have a customer (i.e. customer contacted them)
  const feedJobs = jobs
    .filter(j => !j.isStandalone && j.customerId) // only real customer-initiated contact
    .sort((a, b) => {
      const aTime = (a.createdAt as any)?.seconds || 0;
      const bTime = (b.createdAt as any)?.seconds || 0;
      return bTime - aTime;
    });

  const filteredFeedJobs = feedJobs.filter(j => {
    const jobTime = (j.createdAt as any)?.seconds 
      ? new Date((j.createdAt as any).seconds * 1000)
      : new Date(j.createdAt);
    return jobTime >= getFeedCutoff();
  });

  const recentJobs = jobs.sort((a, b) => {
    const aTime = (a.createdAt as any)?.seconds || 0;
    const bTime = (b.createdAt as any)?.seconds || 0;
    return bTime - aTime;
  }).slice(0, 5);

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
       <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-10 py-8 max-w-2xl mx-auto md:max-w-none">
      {showSetup && user?.uid && (
        <TradesmanProfileSetup 
          userId={user.uid} 
          onComplete={() => {
            setShowSetup(false);
            window.location.reload();
          }} 
        />
      )}

      {/* Header Info */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div>
            <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] mb-2 italic">
               <span className="w-8 h-[2px] bg-primary"></span>
               Hero Command Center
            </div>
            <h1 className="text-4xl font-black tracking-tighter mb-1 uppercase italic">Fix Link <span className="text-primary">Pro</span></h1>
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-3">
               <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-primary" /> {profile?.address || "Location not set"}</span>
               <span className="w-1 h-1 bg-border rounded-full" />
               <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5 text-primary" /> {profile?.trade || "Trade not set"}</span>
            </p>
         </div>
         <div className="flex flex-col md:flex-row flex-wrap gap-4 mt-6 md:mt-0">
            <button 
              onClick={() => router.push('/dashboard/tradesman/inventory')}
              className="px-6 py-4 md:py-5 bg-white border border-slate-100 rounded-[2rem] font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:shadow-xl transition-all shadow-sm"
            >
               <Package className="w-4 h-4 md:w-5 md:h-5 text-primary" /> Hub
            </button>
            <button 
              onClick={() => router.push('/dashboard/tradesman/estimates')}
              className="px-6 py-4 md:py-5 bg-slate-50 border border-slate-200 text-slate-600 rounded-[2rem] font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-100 transition-all shadow-sm"
            >
               <FileText className="w-4 h-4 md:w-5 md:h-5 text-slate-500" /> Estimates
            </button>
            <button 
              onClick={() => router.push('/dashboard/tradesman/invoices')}
              className="px-6 py-4 md:py-5 bg-slate-50 border border-slate-200 text-slate-600 rounded-[2rem] font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-100 transition-all shadow-sm"
            >
               <FileText className="w-4 h-4 md:w-5 md:h-5 text-slate-500" /> Invoices
            </button>
            
            {/* Availability Toggle */}
            <button 
              onClick={handleToggleAvailability}
              disabled={toggling}
              className={cn(
                "px-8 py-4 md:py-5 rounded-[2rem] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-lg border-2",
                profile?.isAvailable !== false 
                ? "bg-green-500 text-white border-green-400 shadow-green-500/20" 
                : "bg-orange-500 text-white border-orange-400 shadow-orange-500/20"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full", profile?.isAvailable !== false ? "bg-white animate-pulse" : "bg-white/50")} />
              {toggling ? "Calibrating..." : (profile?.isAvailable !== false ? "Mission Ready" : "Occupied")}
            </button>

            <button 
              onClick={() => router.push('/dashboard/tradesman/projects')}
              className="px-6 py-4 md:py-5 bg-slate-900 text-white rounded-[2rem] font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 shadow-2xl transition-all"
            >
               <PlusCircle className="w-4 h-4 md:w-5 md:h-5" /> Projects
            </button>
            <button 
              onClick={() => router.push('/dashboard/tradesman/leads')}
              className="px-6 py-4 md:py-5 bg-accent text-white rounded-[2rem] font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-105 active:scale-95 shadow-2xl shadow-accent/20 transition-all relative"
            >
               <Radar className="w-4 h-4 md:w-5 md:h-5" /> Leads
               {leads.length > 0 && (
                 <span className="absolute -top-1 -right-1 w-6 h-6 bg-white text-accent rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">
                   {leads.length}
                 </span>
               )}
            </button>
         </div>
      </section>

      {/* Operational Intelligence */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => router.push('/dashboard/tradesman/earnings')}
            className="p-10 rounded-[3.5rem] bg-slate-900 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between group h-64 border border-white/5 cursor-pointer"
          >
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-primary/20 rounded-full blur-[4rem] -mb-20 -mr-20" />
            <div className="flex items-center justify-between mb-4 relative z-10">
               <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                  <Wallet className="w-7 h-7 text-primary" />
               </div>
               <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase italic">
                  Live <TrendingUp className="w-3.5 h-3.5 text-primary" />
               </div>
            </div>
            <div className="relative z-10">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2 italic">Hero Revenue</p>
               <h2 className="text-4xl font-black tracking-tighter italic text-white flex items-baseline gap-1">R {revenue || '0'}<span className="text-lg opacity-20 italic">.00</span></h2>
            </div>
         </motion.div>

         <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => router.push('/profile')}
            className="p-10 rounded-[3.5rem] bg-white border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-primary/20 hover:shadow-2xl transition-all h-64 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
               <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Star className="w-7 h-7 fill-primary/10" />
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Honor Meter</p>
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 italic">Pro Rating</p>
               <div className="flex items-end gap-2">
                  <h2 className="text-4xl font-black tracking-tighter italic text-slate-900">{profile?.rating?.toFixed(1) || '5.0'}</h2>
                  <span className="text-[10px] font-black text-slate-300 mb-2 uppercase tracking-tighter">/ 5.0 HERO RANK</span>
               </div>
            </div>
         </motion.div>

         <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => router.push('/dashboard/tradesman/projects')}
            className="p-10 rounded-[3.5rem] bg-white border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-primary/20 hover:shadow-2xl transition-all h-64 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
               <div className="w-14 h-14 rounded-2xl bg-accent/5 border border-accent/10 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                  <Zap className="w-7 h-7 fill-accent/10" />
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Tempo</p>
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 italic">Active Projects</p>
               <h2 className="text-4xl font-black tracking-tighter italic text-slate-900">{activeProjectsCount.toString().padStart(2, '0')} <span className="text-lg uppercase not-italic text-slate-300 font-black italic">DEPLOYED</span></h2>
            </div>
         </motion.div>
      </section>

      {/* Brand Identity / Storefront Section */}
      <section className="bg-white border border-slate-100 rounded-[4rem] p-12 shadow-sm relative overflow-hidden group">
        {/* Upgrade Indicator for non-Legend tiers */}
        {profile?.tier !== 'legend' && (
          <div className="absolute top-10 right-10 z-20">
            <button 
              onClick={() => setShowTierModal(true)}
              className="px-6 py-3 bg-accent text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] italic hover:scale-105 active:scale-95 shadow-xl transition-all flex items-center gap-2"
            >
              <Star className="w-4 h-4 fill-white" /> Upgrade to Legend
            </button>
          </div>
        )}
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[6rem] -mr-24 -mt-24 group-hover:bg-primary/10 transition-colors" />
        <div className="flex flex-col md:flex-row items-center gap-12 relative">
           {/* Logo Display */}
           <div className="shrink-0 group/logo relative">
              <div className="w-32 h-32 rounded-[2.5rem] bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm transition-transform group-hover/logo:scale-105">
                 {profile?.imageUrl ? (
                    <img src={profile.imageUrl} alt={profile.businessName || profile.fullName} className="w-full h-full object-cover" />
                 ) : (
                    <Briefcase className="w-12 h-12 text-slate-300" />
                 )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg border-2 border-white group-hover/logo:rotate-12 transition-transform">
                 <ShieldCheck className="w-5 h-5 fill-current" />
              </div>
           </div>

           {/* Brand Details & Edit Trigger */}
           <div className="flex-1 space-y-6 text-center md:text-left">
              <div>
                 <h2 className="text-3xl font-black tracking-tight uppercase italic text-slate-900">{profile?.businessName || profile?.companyName || "Hero Storefront"}</h2>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic flex items-center justify-center md:justify-start gap-3 mt-1">
                    Official fix link certified storefront
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                 </p>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                 <button 
                  onClick={() => router.push('/profile')}
                  className="px-8 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:shadow-md transition-all italic text-slate-600"
                 >
                    Upgrade Identity
                 </button>
                 <button 
                  onClick={() => router.push('/dashboard/tradesman/profile')}
                  className="px-8 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:shadow-md transition-all italic text-slate-600"
                 >
                    Adjust Radius
                 </button>
              </div>
           </div>
        </div>
      </section>

      {/* Dashboard Transmission Hub */}
      {activeTab !== 'alerts' && unreadCount > 0 && (
         <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setActiveTab('alerts')}
            className="bg-primary/5 border-2 border-primary/20 p-8 rounded-[3rem] flex items-center justify-between group cursor-pointer hover:bg-white hover:shadow-2xl transition-all"
         >
            <div className="flex items-center gap-6">
               <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center animate-bounce shadow-xl shadow-primary/20 text-white">
                  <Bell className="w-6 h-6" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Incoming Comms</p>
                  <h4 className="font-black text-slate-900 uppercase italic tracking-tighter text-xl">
                     {unreadCount} Unread Mission Transmission(s)
                  </h4>
               </div>
            </div>
            <ArrowRight className="w-6 h-6 text-primary group-hover:translate-x-2 transition-transform" />
         </motion.div>
      )}

      {/* Tabs Navigation */}
      <section className="flex items-center gap-6 border-b border-slate-100 pb-2 px-4 overflow-x-auto no-scrollbar">
         {[
            { 
              id: 'comms', 
              label: 'Mission Comms', 
              icon: MessageSquare,
              count: unreadMessages
            },
            { id: 'leads', label: 'Mission Radar', icon: Zap, count: leads.length },
            { id: 'alerts', label: 'System Alerts', icon: Bell, count: unreadCount - unreadMessages },
            { id: 'earnings', label: 'Economic Hub', icon: Wallet },
         ].map((tab) => (
            <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={cn(
                  "flex items-center gap-3 pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative shrink-0",
                  activeTab === tab.id ? "text-primary italic" : "text-slate-400"
               )}
            >
               <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "fill-primary/10" : "")} />
               {tab.label}
               {tab.count !== undefined && tab.count > 0 && (
                 <span className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-lg shadow-primary/20">
                   {tab.count}
                 </span>
               )}
               {activeTab === tab.id && (
                  <motion.div 
                     layoutId="activeTab"
                     className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" 
                  />
               )}
            </button>
         ))}
      </section>

      {/* Dynamic Content Grid */}
      <div className="grid grid-cols-1 gap-12">
        <AnimatePresence mode="wait">
          {activeTab === 'comms' && (
            <motion.section 
               key="comms"
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="space-y-8"
            >
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 mt-4">
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic text-slate-900">Mission <span className="text-primary tracking-normal">Comms Center</span></h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic mt-1">Customers who reached out to you</p>
                  </div>
                  {/* Period Filter Tabs */}
                  <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl">
                    {(['day', 'week', 'month'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setFeedPeriod(p)}
                        className={cn(
                          "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                          feedPeriod === p 
                            ? "bg-primary text-white shadow-lg shadow-primary/20" 
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {p === 'day' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
                      </button>
                    ))}
                  </div>
               </div>
               
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {chats.length > 0 ? chats.map((chat) => {
                    const hasUnread = notifications.some(n => !n.read && n.chatId === chat.id);
                    return (
                      <div 
                        key={chat.id} 
                        onClick={() => router.push(`/chat?chatId=${chat.id}`)}
                        className={cn(
                          "group p-10 rounded-[3.5rem] flex flex-col justify-between gap-8 hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden border",
                          hasUnread ? "bg-primary/5 border-primary/20 shadow-xl" : "bg-white border-slate-100"
                        )}
                      >
                         <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                         
                         <div className="flex items-center gap-6 relative">
                           <div className={cn(
                             "w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-black text-xl italic shadow-sm transition-all",
                             hasUnread ? "bg-primary text-white" : "bg-slate-50 text-slate-400 group-hover:bg-primary group-hover:text-white"
                           )}>
                             {chat.customerName?.charAt(0) || 'C'}
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between gap-2">
                               <div className="flex items-center gap-2">
                                 <h4 className="font-black text-slate-900 uppercase italic tracking-tighter text-xl truncate">{chat.customerName}</h4>
                                 {hasUnread && <div className="w-2 h-2 bg-primary rounded-full animate-ping" />}
                               </div>
                               <button 
                                 onClick={(e) => handleDeleteChat(e, chat.id)}
                                 className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </div>
                             <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1 opacity-60 truncate">Mission: {chat.jobTitle}</p>
                           </div>
                         </div>

                         <div className="space-y-4 pt-4 border-t border-slate-50 relative">
                            <p className="text-[11px] text-slate-500 font-bold italic line-clamp-2 leading-relaxed">
                              {chat.lastMessage || 'Waiting for briefing transmission...'}
                            </p>
                            <div className="flex items-center justify-between">
                               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                 {chat.lastMessageAt?.toDate ? chat.lastMessageAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Standby'}
                               </span>
                               <ArrowRight className="w-5 h-5 text-slate-200 group-hover:text-primary transition-all group-hover:translate-x-1" />
                            </div>
                         </div>
                      </div>
                    );
                  }) : (
                     <div className="col-span-full py-20 text-center space-y-4">
                       <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                         <MessageSquare className="w-8 h-8 text-slate-200" />
                       </div>
                       <p className="text-slate-400 font-black uppercase tracking-[0.2em] italic text-sm">
                         Intelligence Feed Empty.
                       </p>
                       <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic">
                         Active communication channels will appear here once mission contact is established.
                       </p>
                     </div>
                  )}
                </div>
            </motion.section>
          )}

          {activeTab === 'leads' && (
             <motion.section 
                key="leads"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
             >
                <div className="flex items-center justify-between px-4 mt-4">
                   <h3 className="text-2xl font-black uppercase tracking-tighter italic text-slate-900">Mission <span className="text-primary tracking-normal">Radar</span></h3>
                </div>

                {isBusy ? (
                  <div className="p-16 text-center bg-slate-900 rounded-[4rem] border-4 border-dashed border-white/5 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 animate-pulse" />
                     <Radar className="w-16 h-16 text-primary mx-auto mb-8 opacity-40 animate-spin" />
                     <h4 className="text-white text-3xl font-black italic uppercase tracking-tighter mb-4">Radar on Standby</h4>
                     <p className="text-slate-400 font-bold italic tracking-tight mb-10 max-w-sm mx-auto opacity-70">You are currently marked as <span className="text-orange-500 not-italic">Occupied</span>. Complete existing missions or toggle your status to "Mission Ready" to receive new transmissions.</p>
                     <button 
                        onClick={handleToggleAvailability}
                        className="px-12 py-5 bg-white text-slate-900 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl"
                     >
                        Re-Activate Radar
                     </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {leads.length > 0 ? leads.map((lead) => (
                      <div 
                        key={lead.id} 
                        onClick={() => router.push(`/jobs/view?id=${lead.id}`)}
                        className="group p-10 bg-white border border-slate-100 rounded-[4rem] flex flex-col md:flex-row md:items-center justify-between gap-8 hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden"
                      >
                         <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                         
                         <div className="flex items-center gap-8 relative">
                           <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm">
                             <Zap className="w-10 h-10" />
                           </div>
                           <div>
                             <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{lead.category}</p>
                             <h4 className="font-black text-slate-900 uppercase italic tracking-tighter text-2xl mb-1">{lead.title}</h4>
                             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                               <MapPin className="w-3.5 h-3.5" /> {typeof lead.location === 'string' ? lead.location : lead.location?.address || 'Cape Town'}
                             </p>
                           </div>
                         </div>
                         <ArrowRight className="w-8 h-8 text-slate-200 group-hover:text-primary transition-all group-hover:translate-x-2 hidden md:block" />
                      </div>
                    )) : (
                      <div className="py-20 text-center text-slate-400 font-black uppercase tracking-[0.2em] italic opacity-40">
                         No active transmissions in your sector.
                      </div>
                    )}
                  </div>
                )}
             </motion.section>
           )}

          {activeTab === 'alerts' && (
             <motion.section 
                key="alerts"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
             >
                <div className="flex items-center justify-between px-4 mt-4">
                   <h3 className="text-2xl font-black uppercase tracking-tighter italic text-slate-900">Mission <span className="text-primary tracking-normal">Alerts</span></h3>
                </div>

                <div className="flex flex-col gap-4">
                   {notifications.length > 0 ? notifications.map((n) => (
                      <div 
                        key={n.id}
                        className={cn(
                          "p-8 rounded-[3rem] border transition-all flex items-center justify-between group cursor-pointer",
                          n.read ? "bg-white border-slate-100" : "bg-primary/5 border-primary/20 shadow-xl"
                        )}
                         onClick={() => handleAlertClick(n)}
                      >
                         <div className="flex items-center gap-6">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center",
                              n.type === 'new_message' ? "bg-blue-50 text-blue-500" : "bg-green-50 text-green-500"
                            )}>
                               <Bell className="w-6 h-6" />
                            </div>
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{n.title}</p>
                               <h4 className="font-black text-slate-900 uppercase italic tracking-tight">{n.message}</h4>
                            </div>
                         </div>
                         <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                      </div>
                   )) : (
                      <div className="py-20 text-center text-slate-400 font-black uppercase tracking-[0.2em] italic opacity-40">
                         No new alerts detected in HQ.
                      </div>
                   )}
                </div>
             </motion.section>
           )}

          {activeTab === 'earnings' && (
            <motion.section 
               key="earnings"
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: 20 }}
               className="space-y-8"
            >
               <div className="flex items-center justify-between px-4 mt-4">
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic text-slate-900">Economic <span className="text-primary tracking-normal">Hub</span></h3>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-12 bg-slate-900 text-white rounded-[4rem] relative overflow-hidden shadow-2xl">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[4rem] -mr-16 -mt-16" />
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3 italic">Total Gross Revenue</p>
                     <h2 className="text-6xl font-black tracking-tighter italic">R {revenue}<span className="text-xl opacity-20">.00</span></h2>
                  </div>

                  <div className="p-12 bg-white border border-slate-100 rounded-[4rem] shadow-sm">
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3 italic">Operation Density</p>
                     <h2 className="text-6xl font-black tracking-tighter italic text-slate-900">{jobs.length}<span className="text-xl text-slate-300"> JOBS</span></h2>
                  </div>
               </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Intelligence HQ */}
      <section className="p-10 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl border border-white/5">
         <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
         <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
            <ShieldCheck className="w-6 h-6 text-primary" />
         </div>
         <h3 className="font-black text-xl mb-3 italic uppercase tracking-[0.02em]">Intelligence HQ</h3>
         <p className="text-[11px] text-slate-400 font-bold italic leading-relaxed mb-8 opacity-60">Need operational guidance or mission support? Hero HQ is active 24/7 for you.</p>
         <button className="text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b-2 border-primary/20 pb-1 hover:border-primary transition-all italic">Launch Direct Channel</button>
      </section>
      {/* Tier Selector Modal */}
      <AnimatePresence>
        {showTierModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTierModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[3rem] p-8 md:p-12 w-full max-w-6xl shadow-2xl relative z-10 overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setShowTierModal(false)}
                className="absolute top-8 right-8 p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="text-center mb-12">
                <div className="flex items-center justify-center gap-2 text-primary font-black uppercase tracking-widest text-xs mb-3 italic">
                  <span className="w-8 h-[2px] bg-primary"></span>
                  Evolution Mode
                </div>
                <h2 className="text-4xl font-black tracking-tighter uppercase italic mb-4 text-slate-900">Elevate Your <span className="text-primary">Hero Tier</span></h2>
                <p className="text-slate-500 font-medium max-w-2xl mx-auto italic">
                  Start a 14-day free trial on any higher tier. Experience legendary range and tools immediately. 
                  Reverts automatically unless approved by administration.
                </p>
              </div>

              <TierSelector onComplete={() => setShowTierModal(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
