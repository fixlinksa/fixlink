'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Hammer, 
  TrendingUp, 
  DollarSign, 
  Clock,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Zap
} from 'lucide-react';

import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = React.useState<any[]>([]);
  const [recentMissions, setRecentMissions] = React.useState<any[]>([]);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [marketStats, setMarketStats] = React.useState({ totalVolume: 0, avgBudget: 0 });

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const { getUsersByRole } = await import('@/lib/db');
        const [pros, customers, jobsSnap, trialsSnap] = await Promise.all([
          getUsersByRole('tradesman'),
          getUsersByRole('customer'),
          getDocs(query(collection(db, 'jobs'), orderBy('createdAt', 'desc'), limit(100))),
          getDocs(query(collection(db, 'users'), where('tierStatus', '==', 'trial')))
        ]);

        const allJobs = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const recentJobs = allJobs.slice(0, 5);
        
        // Calculate Market Volume
        const totalVolume = allJobs.reduce((sum, job: any) => {
          const budget = typeof job.budget === 'string' ? parseFloat(job.budget.replace(/[^0-9.]/g, '')) : (job.budget || 0);
          const amount = job.amount || 0;
          return sum + (amount || budget || 0);
        }, 0);

        const avgBudget = allJobs.length > 0 ? totalVolume / allJobs.length : 0;

        setRecentMissions(recentJobs);
        setPendingCount(trialsSnap.size);
        setMarketStats({ totalVolume, avgBudget });

        setStats([
          { label: 'Total Pros', value: pros.length.toLocaleString(), change: '+0', icon: Hammer, color: 'primary' },
          { label: 'Active Customers', value: customers.length.toLocaleString(), change: '+0', icon: Users, color: 'accent' },
          { label: 'Market Volume', value: `R ${totalVolume.toLocaleString()}`, change: 'Real-time', icon: DollarSign, color: 'green' },
          { label: 'Avg Mission', value: `R ${avgBudget.toLocaleString()}`, change: 'Platform Avg', icon: CheckCircle2, color: 'blue' },
        ]);
      } catch (error) {
        console.error('Failed to fetch admin dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-12">
      <style jsx global>{`
        @media print {
          nav, header, aside, .no-print, button {
            display: none !important;
          }
          body, .min-h-screen {
             background: white !important;
             margin: 0 !important;
             padding: 0 !important;
          }
          main {
             padding: 0 !important;
             margin: 0 !important;
          }
          .grid {
             display: block !important;
          }
          .bg-white {
             border: none !important;
             box-shadow: none !important;
          }
          .rounded-[2.5rem], .rounded-[3rem], .rounded-[4rem] {
             border-radius: 0 !important;
          }
          .stat-card {
             border: 1px solid #e2e8f0 !important;
             margin-bottom: 20px !important;
             page-break-inside: avoid;
          }
          .print-header {
             display: block !important;
             margin-bottom: 40px !important;
             border-bottom: 2px solid #000 !important;
             padding-bottom: 20px !important;
          }
        }
        .print-header {
           display: none;
        }
      `}</style>

      {/* Print-only Header */}
      <div className="print-header">
         <h1 className="text-3xl font-black uppercase italic italic tracking-tighter">Fix Link <span className="text-primary">Platform Pulse</span></h1>
         <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">{new Date().toLocaleDateString()} • Confidential Tactical Report</p>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div>
          <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs mb-3 italic">
            <span className="w-8 h-[2px] bg-primary"></span>
            Platform Pulse
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 mb-4 uppercase italic">
            System <span className="text-primary">Intelligence</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-xl">
            Real-time analytics and global fleet management for the Fix Link professional marketplace.
          </p>
        </div>
        <div className="flex items-center gap-4 self-start">
           <button 
             onClick={handlePrint}
             className="px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all shadow-sm flex items-center gap-3"
           >
              Print Report
           </button>
           <div className="flex items-center gap-3 p-1.5 bg-white rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                 <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                 Live
              </div>
           </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
           [1,2,3,4].map(i => (
              <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm animate-pulse h-40"></div>
           ))
        ) : stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group stat-card"
          >
            <div className="flex items-start justify-between mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all bg-${stat.color === 'primary' ? 'primary' : 'slate-900'}/10 text-${stat.color === 'primary' ? 'primary' : 'slate-900'} group-hover:scale-110`}>
                <stat.icon className="w-7 h-7" />
              </div>
              <div className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black flex items-center gap-1 no-print">
                <TrendingUp className="w-3 h-3" />
                {stat.change}
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">{stat.label}</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Recent Activity */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm overflow-hidden relative stat-card">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32 no-print"></div>
            
            <div className="flex items-center justify-between mb-10 relative z-10">
              <h2 className="text-2xl font-black tracking-tight uppercase italic">Platform <span className="text-primary">Pulse</span></h2>
              <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-slate-900 transition-colors no-print">View All Activity</button>
            </div>

            <div className="space-y-6 relative z-10">
              {recentMissions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic">
                  No missions on record.
                </div>
              ) : recentMissions.map((mission) => (
                <div key={mission.id} className="flex items-center gap-6 p-4 rounded-2xl hover:bg-slate-50 transition-all group cursor-pointer border border-transparent hover:border-slate-100">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center">
                    {mission.images?.[0] ? (
                      <img src={mission.images[0]} alt="Mission" className="w-full h-full object-cover" />
                    ) : (
                      <Zap className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">
                      {mission.customerName} <span className="text-slate-400 font-medium normal-case ml-2 italic">posted a mission</span>
                    </p>
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-0.5">{mission.title} • {mission.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">R {mission.budget || '0.00'}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic">
                      {new Date(mission.createdAt?.seconds * 1000 || mission.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Health / Status */}
        <div className="lg:col-span-4 space-y-6 no-print">
           <div className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] -mr-16 -mt-16"></div>
              
              <div className="flex items-center justify-between mb-8">
                 <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic">System Core</p>
                 <ShieldCheck className="w-5 h-5 text-primary" />
              </div>

              <div className="space-y-8">
                 <div>
                    <h3 className="text-white font-black text-4xl tracking-tighter mb-2 italic uppercase">Platinum</h3>
                    <p className="text-slate-400 text-xs font-medium italic">All verification buffers operational.</p>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                       <span className="text-slate-400">Database Sync</span>
                       <span className="text-primary">100%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: '100%' }}
                         className="h-full bg-primary"
                       />
                    </div>
                 </div>

                 <button className="w-full py-5 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all">
                    System Diagnostic
                 </button>
              </div>
           </div>

           <div className="bg-primary rounded-[3rem] p-10 shadow-xl shadow-primary/20 relative overflow-hidden group">
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center justify-between mb-6">
                 <Zap className="w-6 h-6 text-white" />
                 <span className="px-3 py-1 bg-white/20 rounded-lg text-[9px] font-black text-white italic uppercase tracking-widest">Priority</span>
              </div>
              <h3 className="text-white font-black text-xl tracking-tight mb-2 uppercase">Hero Support</h3>
              <p className="text-white/80 text-[11px] font-medium leading-relaxed mb-8 italic">
                {pendingCount} Pending professional identity verifications requiring human authorization.
              </p>
              <button 
                onClick={() => router.push('/admin/requests')}
                className="w-full py-5 bg-white text-primary rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-black/10"
              >
                Start Authorizing
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
