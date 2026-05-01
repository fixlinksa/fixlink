'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Shield, 
  ShieldAlert, 
  User, 
  Mail, 
  Phone, 
  MessageSquare, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Send
} from 'lucide-react';
import { UserProfile, updateUserProfile, adminSendMessage } from '@/lib/db';
import { TIER_CONFIG, TierId } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';

interface AdminUserModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: UserProfile) => void;
}

export default function AdminUserModal({ user, isOpen, onClose, onUpdate }: AdminUserModalProps) {
  const { user: adminUser } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);

  const handleStatusToggle = async () => {
    setUpdating(true);
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    try {
      await updateUserProfile(user.id, { status: newStatus } as any);
      onUpdate({ ...user, status: newStatus } as any);
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleTierChange = async (newTier: TierId) => {
    setUpdating(true);
    try {
      await updateUserProfile(user.id, { tier: newTier });
      onUpdate({ ...user, tier: newTier });
    } catch (error) {
      console.error('Error updating tier:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !adminUser) return;
    
    setUpdating(true);
    try {
      await adminSendMessage(adminUser.uid, user.id, message);
      setMessage('');
      setMessageSent(true);
      setTimeout(() => setMessageSent(false), 3000);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  const isSuspended = user.status === 'suspended';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className={`p-10 flex items-center justify-between border-b border-slate-100 ${isSuspended ? 'bg-red-50' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-[2rem] bg-slate-50 overflow-hidden border-4 border-white shadow-xl flex items-center justify-center">
                {user.imageUrl ? (
                  <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-slate-200" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                   <h2 className="text-2xl font-black uppercase tracking-tighter italic text-slate-900">{user.fullName}</h2>
                   {user.status === 'suspended' ? (
                     <span className="px-3 py-1 bg-red-500 text-[9px] font-black text-white uppercase tracking-widest rounded-lg">Suspended</span>
                   ) : (
                     <span className="px-3 py-1 bg-green-500 text-[9px] font-black text-white uppercase tracking-widest rounded-lg">Active</span>
                   )}
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{user.role} • ID: {user.id.substring(0, 8)}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-4 bg-white rounded-2xl text-slate-400 hover:text-slate-900 hover:scale-110 transition-all shadow-sm"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
            {/* Rapid Info */}
            <div className="grid grid-cols-2 gap-6">
               <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Communications</p>
                  <div className="space-y-3">
                     <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-slate-600 truncate">{user.email}</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-slate-600">{user.contactPhone || 'No link established'}</span>
                     </div>
                  </div>
               </div>
               <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Status Matrix</p>
                  <div className="space-y-3">
                     <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-slate-600 uppercase italic">Role: {user.role}</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-slate-600 uppercase italic">Rating: {user.rating || 'N/A'}</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Management Actions */}
            <div className="space-y-6">
               <h3 className="text-sm font-black uppercase tracking-widest italic text-slate-900 flex items-center gap-2">
                 <ShieldAlert className="w-4 h-4 text-primary" />
                 Authority Controls
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Suspension Control */}
                  <div className={`p-8 rounded-[2.5rem] border-2 transition-all ${isSuspended ? 'border-green-500 bg-green-50/30' : 'border-red-500 bg-red-50/30'}`}>
                     <div className="flex items-center justify-between mb-4">
                        <div className={isSuspended ? 'text-green-600' : 'text-red-600'}>
                           <AlertCircle className="w-8 h-8" />
                        </div>
                        <button 
                          onClick={handleStatusToggle}
                          disabled={updating}
                          className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            isSuspended 
                            ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' 
                            : 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                          } disabled:opacity-50`}
                        >
                          {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSuspended ? 'Lift Suspension' : 'Suspend User')}
                        </button>
                     </div>
                     <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isSuspended ? 'text-green-600' : 'text-red-600'}`}>
                        {isSuspended ? 'Clearance Pending' : 'Breach Detected?'}
                     </p>
                     <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
                        {isSuspended 
                          ? 'This user is currently grounded. Reactivating will restore all platform privileges.' 
                          : 'Suspension immediately restricts mission access and discovery visibility.'}
                     </p>
                  </div>

                  {/* Tier Control (Professionals Only) */}
                  {user.role === 'tradesman' && (
                    <div className="p-8 rounded-[2.5rem] border-2 border-slate-900 bg-slate-900 text-white shadow-2xl">
                       <div className="flex items-center justify-between mb-8">
                          <Zap className="w-8 h-8 text-primary shadow-glow" />
                          <div className="px-4 py-2 bg-primary rounded-xl text-[9px] font-black uppercase tracking-widest text-white italic">
                             Current: {user.tier || 'Starter'}
                          </div>
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-6 italic">Tier Elevation</p>
                       <div className="grid grid-cols-2 gap-3">
                          {(['starter', 'gold', 'platinum'] as TierId[]).map(t => (
                            <button
                              key={t}
                              onClick={() => handleTierChange(t)}
                              disabled={updating || user.tier === t}
                              className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                                user.tier === t 
                                ? 'bg-primary border-primary text-white' 
                                : 'bg-white/5 border-white/10 text-slate-400 hover:border-primary hover:text-primary'
                              } disabled:opacity-50`}
                            >
                              {TIER_CONFIG[t].name}
                            </button>
                          ))}
                       </div>
                    </div>
                  )}
               </div>
            </div>

            {/* Direct Messaging */}
            <div className="space-y-6">
               <h3 className="text-sm font-black uppercase tracking-widest italic text-slate-900 flex items-center gap-2">
                 <MessageSquare className="w-4 h-4 text-primary" />
                 Direct Tactical Link
               </h3>
               <form onSubmit={handleSendMessage} className="relative group">
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter command or support transmission..."
                    className="w-full bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] min-h-[150px] text-sm font-medium outline-none focus:border-primary transition-all group-hover:bg-white group-hover:shadow-xl italic"
                  />
                  <div className="absolute bottom-6 right-6 flex items-center gap-4">
                     {messageSent && (
                       <span className="text-[10px] font-black text-green-500 uppercase tracking-widest animate-pulse">Transmission Sent</span>
                     )}
                     <button 
                       type="submit"
                       disabled={updating || !message.trim()}
                       className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-primary transition-all shadow-xl disabled:opacity-50 disabled:bg-slate-300"
                     >
                        {updating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                     </button>
                  </div>
               </form>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
