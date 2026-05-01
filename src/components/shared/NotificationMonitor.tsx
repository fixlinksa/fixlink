'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, MessageSquare, ArrowRight } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { markNotificationAsRead } from '@/lib/db';

export default function NotificationMonitor() {
  const { user } = useAuth();
  const [activeNotification, setActiveNotification] = useState<any>(null);
  const [lastNotifId, setLastNotifId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Audio helper for notifications
  const playAlert = () => {
    try {
      // Custom chime provided by user
      const audio = new Audio('/chime.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio playback requires user interaction first.'));
    } catch (e) {
      console.error('Audio engine failure:', e);
    }
  };

  useEffect(() => {
    if (!user) return;

    const notifRef = collection(db, 'notifications');
    // Listen for the most recent unread notification
    const q = query(
      notifRef, 
      where('userId', '==', user.uid), 
      orderBy('createdAt', 'desc'), 
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Find the most recent unread notification
        const unreadNotifs = snapshot.docs
          .map(doc => ({ ...doc.data(), id: doc.id } as any))
          .filter(n => !n.read);
          
        if (unreadNotifs.length === 0) return;
        
        const notif = unreadNotifs[0];
        
        // Only show if it matches a "new" criteria (e.g. less than 30s old)
        // or if we haven't shown it yet in this session
        const createdAt = notif.createdAt?.toDate ? notif.createdAt.toDate() : new Date();
        const now = new Date();
        const diff = (now.getTime() - createdAt.getTime()) / 1000;

        if (diff < 30) {
          // Suppress notification popup and sound when user is actively in chat
          const isInChat = pathname === '/chat';
          if (isInChat) return;

          setActiveNotification(notif);
          
          // Play sound for new unseen notifications
          if (notif.id !== lastNotifId) {
            playAlert();
            setLastNotifId(notif.id);
          }

          // Auto-hide after 8 seconds
          const timer = setTimeout(() => {
            setActiveNotification(null);
          }, 8000);
          return () => clearTimeout(timer);
        }
      }
    }, (error) => {
      console.error("Notification listener failure:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAction = async () => {
    if (!activeNotification) return;
    
    await markNotificationAsRead(activeNotification.id);
    const chatId = activeNotification.chatId;
    const jobId = activeNotification.jobId;
    
    setActiveNotification(null);
    
    if (chatId) {
      router.push(`/chat?chatId=${chatId}`);
    } else if (jobId) {
      router.push(`/jobs/view?id=${jobId}`);
    }
  };

  return (
    <AnimatePresence shadow-xl>
      {activeNotification && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4"
        >
          <div className="bg-white border-2 border-primary/20 rounded-[2.5rem] shadow-[0_20px_50px_rgba(30,78,121,0.2)] p-6 overflow-hidden relative group">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
            
            <div className="flex items-center gap-5 relative">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 animate-bounce">
                {activeNotification.type === 'new_message' ? (
                  <MessageSquare className="w-7 h-7 text-white" />
                ) : (
                  <Bell className="w-7 h-7 text-white" />
                )}
              </div>
              
              <div className="flex-1 min-w-0 cursor-pointer" onClick={handleAction}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-1">Mission Transmission</p>
                <h4 className="text-slate-900 font-black italic uppercase tracking-tighter text-sm truncate bg-clip-text">
                  {activeNotification.message}
                </h4>
              </div>

              <button 
                onClick={() => setActiveNotification(null)}
                className="p-3 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>
            
            <div 
              className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between cursor-pointer group/action"
              onClick={handleAction}
            >
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover/action:text-primary transition-colors">Launch Mission Hub</span>
               <ArrowRight className="w-4 h-4 text-slate-300 group-hover/action:text-primary transition-all group-hover/action:translate-x-1" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
