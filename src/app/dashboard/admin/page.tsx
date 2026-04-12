'use client';

import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Shield, 
  ShieldCheck,
  LayoutDashboard, 
  UserCheck, 
  Search, 
  Filter, 
  MoreVertical, 
  AlertCircle,
  Loader2,
  TrendingUp,
  Briefcase,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { getUsersByRole, UserProfile } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pros' | 'customers'>('pros');
  const [pros, setPros] = useState<UserProfile[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    if (user) loadData();
  }, [user, profile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prosData, customersData] = await Promise.all([
        getUsersByRole('tradesman'),
        getUsersByRole('customer')
      ]);
      setPros(prosData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = (activeTab === 'pros' ? pros : customers).filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
     <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
     </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col xl:flex-row relative overflow-x-hidden">
      {/* Mobile/Tablet Header */}
      <div className="xl:hidden flex items-center justify-between p-4 sm:p-6 bg-slate-900 border-b border-white/5 sticky top-0 z-[60]">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary border border-primary/30 shrink-0">
               <Shield className="w-5 h-5 shadow-glow" />
            </div>
            <h2 className="text-lg font-black text-white uppercase italic tracking-tighter truncate">Fix <span className="text-primary">Admin</span></h2>
         </div>
         <button 
           onClick={() => setIsSidebarOpen(!isSidebarOpen)}
           className="p-3 bg-white/5 rounded-xl text-white shrink-0"
         >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
         </button>
      </div>

      {/* Sidebar Overlay for Mobile/Tablet */}
      <AnimatePresence>
         {isSidebarOpen && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsSidebarOpen(false)}
               className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 xl:hidden"
            />
         )}
      </AnimatePresence>
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-80 bg-slate-900 z-50 transition-transform duration-500 ease-in-out transform xl:translate-x-0 xl:sticky xl:top-0 h-screen border-r border-white/5 flex flex-col p-8 overflow-hidden",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
         <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] -mr-16 -mt-16 opacity-50"></div>
         
         <div className="relative mb-12 hidden xl:flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/30">
               <Shield className="w-6 h-6 shadow-glow" />
            </div>
            <div>
               <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Fix <span className="text-primary">Admin</span></h2>
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Mission Control</p>
            </div>
         </div>

         <nav className="space-y-4 flex-1 mt-6 xl:mt-0">
            <button 
              onClick={() => { setActiveTab('pros'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 px-6 py-5 rounded-[1.5rem] transition-all group ${activeTab === 'pros' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-400 hover:bg-white/5'}`}
            >
               <Briefcase className={`w-5 h-5 ${activeTab === 'pros' ? 'text-white' : 'group-hover:text-primary transition-colors'}`} />
               <span className="text-[11px] font-black uppercase tracking-widest italic">Professionals</span>
            </button>
            <button 
              onClick={() => { setActiveTab('customers'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 px-6 py-5 rounded-[1.5rem] transition-all group ${activeTab === 'customers' ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-400 hover:bg-white/5'}`}
            >
               <Users className={`w-5 h-5 ${activeTab === 'customers' ? 'text-white' : 'group-hover:text-primary transition-colors'}`} />
               <span className="text-[11px] font-black uppercase tracking-widest italic">Customers</span>
            </button>
         </nav>

         <div className="mt-auto p-6 bg-white/5 rounded-3xl border border-white/5 text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Authenticated User</p>
            <p className="text-xs font-bold text-white mb-4">{profile?.fullName}</p>
            <button 
              onClick={() => router.push('/')}
              className="w-full py-4 bg-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase hover:bg-red-500/20 hover:text-red-500 transition-all border border-transparent hover:border-red-500/30"
            >
               Leave Terminal
            </button>
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 md:p-12 overflow-x-hidden">
         <div className="max-w-6xl mx-auto space-y-8 md:space-y-12">
            {/* Top Stat Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
               <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 shadow-sm flex items-center gap-6 md:gap-8">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-50 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-slate-400 shrink-0">
                     <Users className="w-7 h-7 md:w-8 md:h-8" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Total Ecosystem</p>
                     <p className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">{pros.length + customers.length} Heroes</p>
                  </div>
               </div>
               <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 shadow-sm flex items-center gap-6 md:gap-8">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-primary/10 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-primary shrink-0">
                     <Briefcase className="w-7 h-7 md:w-8 md:h-8" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Active Pros</p>
                     <p className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">{pros.length}</p>
                  </div>
               </div>
               <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 shadow-sm flex items-center gap-6 md:gap-8 sm:col-span-2 lg:col-span-1">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-50 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-slate-400 shrink-0">
                     <ShieldCheck className="w-7 h-7 md:w-8 md:h-8" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Security Status</p>
                     <p className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">Verified</p>
                  </div>
               </div>
            </div>

            {/* List Header & Search */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
               <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
                     Hero <span className="text-primary">{activeTab === 'pros' ? 'Directory' : 'Network'}</span>
                  </h1>
                  <p className="text-sm md:text-base text-slate-500 font-medium italic mt-1 md:mt-0">Managing registered {activeTab === 'pros' ? 'professionals' : 'customers'} within the Fix Link ecosystem.</p>
               </div>
               
               <div className="relative w-full lg:w-96 group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text"
                    placeholder={`Search ${activeTab === 'pros' ? 'pros' : 'customers'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-100 p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] pl-16 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all"
                  />
               </div>
            </div>

            {/* CONTENT TABLE & CARD VIEW FOR MOBILE */}
            <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] border border-slate-100 shadow-xl overflow-hidden">
               {/* Desktop Table View */}
               <div className="hidden xl:block overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="border-b border-slate-50 bg-slate-50/50">
                           <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Identity</th>
                           <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Contact & Mission</th>
                           <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Status/Tier</th>
                           <th className="px-10 py-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Oversight</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        <AnimatePresence mode="popLayout">
                           {filteredData.map((hero) => (
                              <motion.tr 
                                key={hero.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="hover:bg-slate-50/50 transition-colors group"
                              >
                                 <td className="px-10 py-8">
                                    <div className="flex items-center gap-6">
                                       <div className="w-14 h-14 bg-slate-100 rounded-[1.2rem] flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform overflow-hidden font-black">
                                          {hero.imageUrl ? (
                                             <img src={hero.imageUrl} alt={hero.fullName} className="w-full h-full object-cover" />
                                          ) : (
                                             hero.fullName.charAt(0)
                                          )}
                                       </div>
                                       <div>
                                          <p className="text-lg font-black text-slate-900 tracking-tight italic uppercase">{hero.fullName}</p>
                                          <p className="text-[10px] font-bold text-slate-400 lowercase">{hero.email}</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-10 py-8">
                                    <div className="space-y-1">
                                       <p className="text-xs font-bold text-slate-700">{hero.trade || (hero.role === 'admin' ? 'Elite Admin' : 'Registered Client')}</p>
                                       <p className="text-[10px] font-medium text-slate-400 italic">Registered: {new Date(hero.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                                    </div>
                                 </td>
                                 <td className="px-10 py-8">
                                    {hero.role === 'tradesman' ? (
                                       <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest italic border ${
                                          hero.tier === 'legend' ? 'bg-amber-50 border-amber-100 text-amber-600' : 
                                          hero.tier === 'missing' ? 'bg-primary/10 border-primary/20 text-primary' : 
                                          'bg-slate-100 border-slate-200 text-slate-400'
                                       }`}>
                                          {hero.tier || 'Starter'} Link
                                       </span>
                                    ) : (
                                       <span className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-widest italic">
                                          Verified Client
                                       </span>
                                    )}
                                 </td>
                                 <td className="px-10 py-8 text-right">
                                    <button className="p-4 bg-white border border-slate-100 text-slate-300 rounded-2xl hover:text-primary hover:border-primary/20 transition-all shadow-sm">
                                       <MoreVertical className="w-5 h-5" />
                                    </button>
                                 </td>
                              </motion.tr>
                           ))}
                        </AnimatePresence>
                     </tbody>
                  </table>
               </div>

               {/* Mobile/Tablet Card View */}
               <div className="xl:hidden p-4 sm:p-6 md:p-10 space-y-6">
                  <AnimatePresence mode="popLayout">
                    {filteredData.map((hero) => (
                      <motion.div 
                        key={hero.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-slate-50/50 border border-slate-100 p-6 rounded-[2rem] space-y-6"
                      >
                         <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                               <div className="w-12 h-12 bg-slate-100 rounded-[1rem] flex items-center justify-center text-slate-400 overflow-hidden font-black border border-slate-200 shrink-0">
                                  {hero.imageUrl ? (
                                     <img src={hero.imageUrl} alt={hero.fullName} className="w-full h-full object-cover" />
                                  ) : (
                                     hero.fullName.charAt(0)
                                  )}
                               </div>
                               <div className="min-w-0 flex-1">
                                  <p className="text-base font-black text-slate-900 tracking-tight uppercase italic truncate">{hero.fullName}</p>
                                  <p className="text-[10px] font-bold text-slate-400 lowercase truncate">{hero.email}</p>
                               </div>
                            </div>
                            <button className="p-3 bg-white border border-slate-200 text-slate-300 rounded-xl shrink-0">
                               <MoreVertical className="w-5 h-5" />
                            </button>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                            <div className="min-w-0">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic truncate">Mission Type</p>
                               <p className="text-xs font-bold text-slate-700 truncate">{hero.trade || (hero.role === 'admin' ? 'Elite Admin' : 'Registered Client')}</p>
                            </div>
                            <div className="min-w-0">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic truncate">Status/Tier</p>
                               {hero.role === 'tradesman' ? (
                                  <span className={cn(
                                    "inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest italic border truncate max-w-full",
                                    hero.tier === 'legend' ? 'bg-amber-50 border-amber-100 text-amber-600' : 
                                    hero.tier === 'missing' ? 'bg-primary/10 border-primary/20 text-primary' : 
                                    'bg-slate-100 border-slate-200 text-slate-400'
                                  )}>
                                     {hero.tier || 'Starter'}
                                  </span>
                               ) : (
                                  <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-200 text-slate-400 rounded-full text-[8px] font-black uppercase tracking-widest italic truncate max-w-full">
                                     Verified
                                  </span>
                               )}
                            </div>
                         </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
               </div>

               {filteredData.length === 0 && (
                  <div className="py-24 text-center opacity-30">
                     <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">No Heroes Detected in Sector</p>
                  </div>
               )}
            </div>
         </div>
      </main>
    </div>
  );
}
