'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Briefcase, 
  ArrowLeft, 
  Search, 
  Calendar, 
  MapPin, 
  ChevronRight,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getJobsByTradesman, Job } from '@/lib/db';
import { cn } from '@/lib/utils';

export default function ProjectsHistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!authLoading && user?.uid) {
      loadProjects();
    }
  }, [authLoading, user?.uid]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await getJobsByTradesman(user!.uid);
      // Filter for active/completed projects (not standalone estimates)
      const filtered = data.filter(j => !j.isStandalone || j.status === 'accepted' || j.status === 'in-progress' || j.status === 'completed');
      
      setProjects(filtered.sort((a, b) => {
        const aTime = (a.createdAt as any)?.seconds || 0;
        const bTime = (b.createdAt as any)?.seconds || 0;
        return bTime - aTime;
      }));
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(e => {
    const locString = typeof e.location === 'string' ? e.location : (e.location?.address || '');
    return (
      e.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      locString.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
                    Operational Deployment
                 </div>
                 <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
                    Active <span className="text-primary">Projects</span>
                 </h1>
              </div>
           </div>

           <div className="px-8 py-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                 <Zap className="w-5 h-5 fill-accent/20" />
              </div>
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Live Missions</p>
                 <p className="text-xl font-black text-slate-900 italic tracking-tighter">{projects.filter(p => p.status !== 'completed').length} ACTIVE</p>
              </div>
           </div>
        </div>

        {/* Search */}
        <div className="relative group">
           <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
           <input 
             type="text"
             placeholder="Search mission manifests by client name or location..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full pl-16 pr-8 py-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm outline-none focus:border-primary transition-all font-bold text-slate-600 italic"
           />
        </div>

        {/* Projects List */}
        <div className="grid grid-cols-1 gap-6">
           <AnimatePresence>
              {filteredProjects.length > 0 ? filteredProjects.map((project, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={project.id}
                  onClick={() => router.push(`/jobs/view?id=${project.id}`)}
                  className="bg-white border border-slate-100 rounded-[3rem] p-8 md:p-10 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group cursor-pointer flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden"
                >
                   <div className="flex items-center gap-8 flex-1 relative z-10">
                      <div className={cn(
                        "w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-500",
                        project.status === 'completed' ? "bg-green-50 text-green-500" : "bg-slate-50 text-slate-300 group-hover:bg-primary group-hover:text-white"
                      )}>
                         <Briefcase className="w-10 h-10" />
                      </div>
                      <div className="space-y-2">
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{project.id.slice(0, 8)}</span>
                            <span className="w-1.5 h-1.5 bg-border rounded-full" />
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest italic",
                              project.status === 'completed' ? "text-green-500" : "text-primary"
                            )}>
                              {project.status.replace('-', ' ')}
                            </span>
                         </div>
                         <h3 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 group-hover:text-primary transition-colors">{project.customerName || project.title || 'Mission Alpha'}</h3>
                         <div className="flex flex-wrap gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic opacity-60">
                            <span className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5" /> 
                                {typeof project.location === 'string' ? project.location : (project.location?.address || 'Remote Deployment')}
                            </span>
                            <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {project.createdAt?.seconds ? new Date(project.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                         </div>
                      </div>
                   </div>

                   <div className="flex items-center justify-between md:flex-col md:items-end gap-4 relative z-10">
                      <div className="flex items-center gap-3">
                         <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all">
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
                   <p className="text-slate-400 font-bold uppercase tracking-[0.2em] italic text-sm">No mission manifests detected in verified sectors.</p>
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
