'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ShieldAlert, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion } from 'framer-motion';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { cn } from '@/lib/utils';
import { repairJobFinancials } from '@/lib/db';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // Responsive Initialization
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Tactical Auto-Repair for Legacy Missions
  useEffect(() => {
    if (isAdmin && user) {
      const brokenMissionId = 'PXTZDkbKSIiTid5Fh071';
      console.log("Tactical Scan: Checking mission integrity...", brokenMissionId);
      repairJobFinancials(brokenMissionId).catch(console.error);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/login');
    }
  }, [user, isAdmin, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-primary rounded-[2rem] flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-primary/20 animate-bounce italic tracking-tighter">
            FL
          </div>
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 animate-pulse italic">Verifying Admin Credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[#1e293b] rounded-[3.5rem] p-16 text-center shadow-2xl border border-white/5 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
          <div className="w-24 h-24 bg-red-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-inner">
            <ShieldAlert className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight mb-4 text-white italic">Access Denied</h2>
          <p className="text-slate-400 text-sm font-medium mb-12 leading-relaxed italic">
            You do not have the required permissions to access the Admin Command Center. This incident has been logged.
          </p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="w-full py-6 bg-white text-slate-900 rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5"
          >
            Return to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className={`flex-1 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'md:ml-80' : 'ml-0'}`}>
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center px-4 md:px-10 sticky top-0 z-30 justify-between">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="group p-2.5 bg-slate-900 text-white border border-slate-700 rounded-xl shadow-2xl shadow-primary/20 hover:bg-primary transition-all flex items-center justify-center transform active:scale-90"
            >
              <motion.div
                animate={{ rotate: isSidebarOpen ? 0 : 180 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <ChevronsLeft className={cn(
                  "w-4 h-4 transition-colors",
                  isSidebarOpen ? "text-white/70 group-hover:text-white" : "text-white"
                )} />
              </motion.div>
            </button>
           
           <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary italic">Command Center</p>
                 <p className="text-xs font-bold text-slate-400">Fix Link Intelligence Unit</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black italic shadow-inner">
                 {profile?.fullName?.charAt(0) || 'A'}
              </div>
           </div>
        </header>
        
        <main className="min-h-[calc(100vh-80px)] overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-4 md:px-10 py-12 md:py-16">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
