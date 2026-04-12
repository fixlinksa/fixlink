'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  UserPlus, 
  Search, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert, 
  Loader2,
  Users,
  CheckCircle2,
  X,
  ArrowUpRight
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { UserProfile, getUsersByRole } from '@/lib/db';
import { cn } from '@/lib/utils';

export default function TeamManagementPage() {
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const data = await getUsersByRole('admin');
      setAdmins(data);
    } catch (error) {
      console.error('Failed to fetch admins:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    try {
      const usersRef = collection(db, 'users');
      // Search by email exact match or name start
      const q = query(usersRef, where('email', '==', searchTerm.trim().toLowerCase()));
      const snap = await getDocs(q);
      
      const results: UserProfile[] = [];
      snap.forEach(doc => {
        const data = doc.data() as UserProfile;
        if (data.role !== 'admin') {
           results.push({ ...data, id: doc.id });
        }
      });
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const toggleAdminRole = async (user: UserProfile, makeAdmin: boolean) => {
    setPromotingId(user.id);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { role: makeAdmin ? 'admin' : 'tradesman' });
      
      if (makeAdmin) {
        setAdmins(prev => [...prev, { ...user, role: 'admin' }]);
        setSearchResults(prev => prev.filter(u => u.id !== user.id));
      } else {
        setAdmins(prev => prev.filter(u => u.id !== user.id));
      }
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] mb-3 italic">
            <span className="w-8 h-[2px] bg-primary"></span>
            Protocol Oversight
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 mb-2 uppercase italic">
            Team <span className="text-primary">Management</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest italic opacity-60">
            Authorize new agents and manage administrative clearance.
          </p>
        </div>

        <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic">
              {admins.length} Active Admins
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Active Admins List */}
        <div className="lg:col-span-12 space-y-6">
           <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-10 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                 <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                    Authorized Administrators
                 </h2>
              </div>
              
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="border-b border-slate-50">
                          <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Identity</th>
                          <th className="px-10 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Clearance</th>
                          <th className="px-10 py-6 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Revoke</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {loading ? (
                          <tr><td colSpan={3} className="px-10 py-20 text-center"><Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" /></td></tr>
                       ) : admins.map(admin => (
                          <motion.tr key={admin.id} layout className="hover:bg-slate-50 transition-colors group">
                             <td className="px-10 py-6">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black italic shadow-inner overflow-hidden">
                                      {admin.imageUrl ? <img src={admin.imageUrl} className="w-full h-full object-cover" /> : admin.fullName.charAt(0)}
                                   </div>
                                   <div>
                                      <p className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{admin.fullName}</p>
                                      <p className="text-[10px] font-bold text-slate-400 lowercase">{admin.email}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-10 py-6">
                                <span className="px-4 py-1.5 bg-primary/5 text-primary border border-primary/10 rounded-full text-[8px] font-black uppercase tracking-widest italic">
                                   Full Admin Access
                                </span>
                             </td>
                             <td className="px-10 py-6 text-right">
                                <button
                                  onClick={() => toggleAdminRole(admin, false)}
                                  disabled={promotingId === admin.id}
                                  className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                   {promotingId === admin.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                                </button>
                             </td>
                          </motion.tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        {/* Add New Admin Section */}
        <div className="lg:col-span-12 space-y-6">
           <div className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
                 <div className="max-w-md">
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4 flex items-center gap-3">
                       <UserPlus className="w-6 h-6 text-primary shadow-glow" />
                       Elevate New Agent
                    </h2>
                    <p className="text-slate-400 text-sm font-medium italic leading-relaxed">
                       Search for any registered user by their email address to grant them administrative privileges over the Fix Link ecosystem.
                    </p>
                 </div>

                 <div className="flex-1 w-full max-w-xl">
                    <form onSubmit={handleSearch} className="relative group mb-6">
                       <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                       <input 
                         type="email"
                         placeholder="Enter user email address..."
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         className="w-full bg-white/5 border border-white/10 p-6 rounded-[2rem] pl-16 text-sm font-bold text-white outline-none focus:border-primary transition-all pr-32"
                       />
                       <button 
                         type="submit"
                         disabled={searching || !searchTerm.trim()}
                         className="absolute right-4 top-1/2 -translate-y-1/2 px-6 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                       >
                          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                       </button>
                    </form>

                    <AnimatePresence>
                       {searchResults.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-4"
                          >
                             {searchResults.map(user => (
                                <div key={user.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/5">
                                   <div className="flex items-center gap-4 min-w-0">
                                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 italic">
                                         {user.fullName.charAt(0)}
                                      </div>
                                      <div className="min-w-0">
                                         <p className="text-xs font-black text-white uppercase truncate tracking-tight">{user.fullName}</p>
                                         <p className="text-[10px] font-medium text-slate-500 truncate">{user.email}</p>
                                      </div>
                                   </div>
                                   <button 
                                     onClick={() => toggleAdminRole(user, true)}
                                     disabled={promotingId === user.id}
                                     className="px-6 py-2 bg-primary text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                                   >
                                      {promotingId === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Grant Access'}
                                   </button>
                                </div>
                             ))}
                          </motion.div>
                       )}
                    </AnimatePresence>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
