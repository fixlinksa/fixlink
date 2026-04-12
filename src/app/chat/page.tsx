'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  MoreVertical, 
  Search,
  CheckCheck,
  MessageCircle,
  Loader2,
  Trash2,
  Paperclip,
  FileText,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc,
  Timestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { sendMessage, getChatThreads, getEstimatesByJob, getInvoicesByJob } from '@/lib/db';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

function ChatContent() {
  const { user, profile } = useAuth();
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [availableDocs, setAvailableDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const chatIdParam = searchParams.get('chatId');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load Chat Threads
  useEffect(() => {
    if (!user) return;

    const chatsRef = collection(db, 'chats');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Simplified query to avoid composite index requirement
    const q = query(
      chatsRef, 
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs
        .map(doc => ({
          ...doc.data(),
          id: doc.id
        } as any))
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

      setChats(chatList);
      setLoading(false);
    }, (error) => {
      console.error("Chat threads listener failure:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile?.role]);

  // Handle chatId from URL
  useEffect(() => {
    if (chatIdParam && chats.length > 0 && !selectedChat) {
      const chat = chats.find(c => c.id === chatIdParam);
      if (chat) {
        setSelectedChat(chat);
      }
    }
  }, [chatIdParam, chats, selectedChat]);

  // Load Messages for Selected Chat
  useEffect(() => {
    if (!selectedChat) return;

    const messagesRef = collection(db, 'chats', selectedChat.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      setMessages(msgList);
    }, (error) => {
      console.error("Messages listener failure:", error);
    });

    return () => unsubscribe();
  }, [selectedChat]);

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChat || !user || !profile) return;

    setSubmitting(true);
    try {
      await sendMessage(selectedChat.id, user.uid, message, profile.role);
      setMessage('');
    } catch (err: any) {
      alert(err.message || "Failed to send message.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachClick = async () => {
    if (!selectedChat || profile?.role !== 'tradesman') return;
    
    setIsAttachOpen(true);
    setLoadingDocs(true);
    try {
      const [estimates, invoices] = await Promise.all([
        getEstimatesByJob(selectedChat.jobId),
        getInvoicesByJob(selectedChat.jobId)
      ]);
      
      const combined = [
        ...estimates.map(e => ({ ...e, docType: 'Estimate' })),
        ...invoices.map(i => ({ ...i, docType: 'Invoice' }))
      ];
      setAvailableDocs(combined);
    } catch (err) {
      console.error("Failed to load mission docs:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const sendAttachment = async (doc: any) => {
    if (!selectedChat || !user || !profile) return;
    
    setSubmitting(true);
    try {
      await sendMessage(selectedChat.id, user.uid, `📎 Attached ${doc.docType}`, profile.role, {
        type: 'document',
        docType: doc.docType,
        docId: doc.id,
        amount: doc.amount || 0
      });
      setIsAttachOpen(false);
    } catch (err: any) {
      alert("Failed to attach document.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex bg-slate-50 h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar - Conversation List */}
      <aside className={cn(
        "w-full md:w-96 border-r border-slate-100 bg-white flex flex-col transition-all",
        selectedChat ? "hidden md:flex" : "flex"
      )}>
        <div className="p-8 border-b border-slate-100">
          <button 
            onClick={() => router.push(profile?.role === 'customer' ? '/dashboard/customer' : '/dashboard/tradesman')}
            className="mb-8 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-primary transition-all flex items-center gap-3 text-[10px] font-black uppercase tracking-widest italic"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Intelligence
          </button>
          <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] mb-4 italic">
            <span className="w-8 h-[2px] bg-primary"></span>
            Mission Comms
          </div>
          <h1 className="text-3xl font-black mb-8 tracking-tighter italic uppercase text-slate-900 leading-none">Messages</h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-300"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {chats.length === 0 ? (
            <div className="p-12 text-center space-y-4 opacity-30 italic">
               <MessageCircle className="w-10 h-10 mx-auto text-slate-300" />
               <p className="text-[10px] font-black uppercase tracking-widest">No active channels</p>
            </div>
          ) : chats.map((chat) => (
            <button 
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={cn(
                "w-full p-8 flex items-start gap-6 border-b border-slate-50 hover:bg-slate-50 transition-all text-left relative overflow-hidden group",
                selectedChat?.id === chat.id ? "bg-primary/5" : ""
              )}
            >
              {selectedChat?.id === chat.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
              )}
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black shrink-0 uppercase italic text-lg border border-slate-200 group-hover:bg-primary group-hover:text-white transition-all">
                {(profile?.role === 'customer' ? (chat.tradesmanName || 'P') : (chat.customerName || 'C'))?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-black text-sm truncate uppercase tracking-tight italic text-slate-900 group-hover:text-primary transition-colors">
                    {profile?.role === 'customer' ? (chat.tradesmanName || 'Professional') : (chat.customerName || 'Customer')}
                  </h3>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic group-hover:text-slate-400 transition-colors">
                    {chat.lastMessageAt?.toDate ? formatDistanceToNow(chat.lastMessageAt.toDate(), { addSuffix: false }) : 'Now'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                   <p className="text-[9px] font-black text-primary uppercase tracking-[0.1em] truncate italic opacity-60 leading-none">{chat.jobTitle}</p>
                </div>
                <p className="text-[11px] text-slate-400 truncate font-bold italic leading-tight">{chat.lastMessage || 'Channel Established'}</p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Content - Chat Window */}
      <main className={cn(
        "flex-1 flex flex-col bg-white",
        !selectedChat ? "hidden md:flex" : "flex"
      )}>
        {selectedChat ? (
          <>
            {/* Header */}
            <header className="p-6 md:p-10 bg-white border-b border-slate-100 flex items-center justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="flex items-center gap-6 relative z-10 w-full">
                <button 
                  onClick={() => setSelectedChat(null)} 
                  className="md:hidden p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 shadow-sm"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-16 h-16 rounded-[1.5rem] bg-slate-900 flex items-center justify-center text-white font-black uppercase italic border border-white/10 text-xl shadow-xl shadow-slate-900/10">
                   {(profile?.role === 'customer' ? (selectedChat.tradesmanName || 'P') : (selectedChat.customerName || 'C'))?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-4 h-[1px] bg-primary opacity-40"></span>
                    <p className="text-[9px] font-black text-primary italic uppercase tracking-widest">Secure Intelligence Channel</p>
                  </div>
                  <h2 className="font-black text-xl uppercase tracking-tighter italic text-slate-900 leading-none mb-1 truncate">
                    Chatting with <span className="text-primary">{profile?.role === 'customer' ? (selectedChat.tradesmanName || 'Professional') : (selectedChat.customerName || 'Customer')}</span>
                  </h2>
                  <div className="flex items-center gap-2">
                     <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tight italic opacity-60">Mission: {selectedChat.jobTitle}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <button 
                   onClick={async () => {
                     if (!confirm("Permanently scale back this mission thread?")) return;
                     try {
                        const { deleteChat } = await import('@/lib/db');
                        await deleteChat(selectedChat.id);
                        setSelectedChat(null);
                     } catch (err) {
                        alert("Session termination failed.");
                     }
                   }}
                   className="p-4 rounded-2xl bg-white border border-red-50 text-red-400 hover:bg-red-50 hover:text-red-500 transition-all flex items-center gap-3 text-[10px] font-black uppercase tracking-widest italic"
                 >
                    <Trash2 className="w-4 h-4" /> Terminate Session
                 </button>
                 <button className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-900 transition-all">
                   <MoreVertical className="w-5 h-5" />
                 </button>
              </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10 scroll-smooth no-scrollbar lg:bg-slate-50/50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-20 italic">
                   <p className="text-[10px] font-black uppercase tracking-[0.3em]">Channel Established</p>
                </div>
              ) : messages.map((msg, i) => (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col",
                    msg.senderId === user?.uid ? "items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "max-w-[85%] md:max-w-lg p-6 rounded-[2.5rem] shadow-sm relative group",
                    msg.senderId === user?.uid 
                      ? "bg-slate-900 text-white rounded-tr-none" 
                      : "bg-white text-slate-900 border border-slate-100 rounded-tl-none"
                  )}>
                    {msg.type === 'document' ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center",
                            msg.senderId === user?.uid ? "bg-white/10" : "bg-slate-100"
                          )}>
                             <FileText className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest italic opacity-60">Mission {msg.docType}</p>
                            <p className="text-sm font-black tracking-tight">{msg.docType} #{msg.docId.slice(-6)}</p>
                          </div>
                        </div>
                        <div className={cn(
                          "p-4 rounded-xl border",
                          msg.senderId === user?.uid ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"
                        )}>
                           <div className="flex justify-between items-center mb-4">
                              <span className="text-[9px] font-black uppercase italic opacity-60">Total Value</span>
                              <span className="text-sm font-black">R {msg.amount?.toFixed(2)}</span>
                           </div>
                           <button 
                             onClick={() => router.push(`/jobs/view/${msg.docType.toLowerCase()}?id=${selectedChat.jobId}`)}
                             className={cn(
                               "w-full py-3 rounded-lg flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                               msg.senderId === user?.uid ? "bg-white text-slate-900" : "bg-primary text-white shadow-lg shadow-primary/20"
                             )}
                           >
                              View Document <ExternalLink className="w-3 h-3" />
                           </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[13px] font-bold leading-relaxed italic">{msg.text}</p>
                    )}
                    <div className={cn(
                      "mt-4 flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] italic",
                      msg.senderId === user?.uid ? "text-white/30 justify-end" : "text-slate-300 justify-start"
                    )}>
                      {msg.createdAt?.toDate ? formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true }) : 'Sending...'}
                      {msg.senderId === user?.uid && <CheckCheck className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <footer className="p-6 md:p-12 bg-white border-t border-slate-100 relative">
               <AnimatePresence>
                 {isAttachOpen && (
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 20 }}
                     className="absolute bottom-full left-6 right-6 mb-4 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden z-20"
                   >
                     <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-widest italic text-slate-400">Mission Documentation</h4>
                        <button onClick={() => setIsAttachOpen(false)} className="text-[9px] font-black uppercase italic text-primary">Close</button>
                     </div>
                     <div className="max-h-64 overflow-y-auto p-4 space-y-2">
                        {loadingDocs ? (
                          <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
                        ) : availableDocs.length === 0 ? (
                          <div className="py-12 text-center text-[10px] font-black uppercase tracking-widest italic opacity-30">No generated documents found for this mission.</div>
                        ) : availableDocs.map(doc => (
                          <button 
                            key={doc.id}
                            onClick={() => sendAttachment(doc)}
                            className="w-full flex items-center justify-between p-5 rounded-2xl border border-slate-50 hover:border-primary/20 hover:bg-slate-50 transition-all text-left group"
                          >
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                   <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                   <p className="text-[10px] font-black uppercase italic text-slate-400">{doc.docType}</p>
                                   <p className="text-[11px] font-bold text-slate-700">#{doc.id.slice(-6)}</p>
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="text-[11px] font-black text-slate-900">R {doc.amount?.toFixed(2)}</p>
                                <p className="text-[9px] font-bold text-slate-400">ID: {doc.id.slice(0, 8)}</p>
                             </div>
                          </button>
                        ))}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
            <div className="flex items-center gap-4 bg-slate-50 p-2 pl-6 rounded-[2.5rem] border border-slate-100 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-white focus-within:shadow-2xl focus-within:shadow-primary/5 transition-all">
                {profile?.role === 'tradesman' && (
                  <button 
                    onClick={handleAttachClick}
                    className={cn(
                      "p-3 transition-colors",
                      isAttachOpen ? "text-primary" : "text-slate-300 hover:text-primary"
                    )}
                  >
                    <Paperclip className="w-6 h-6" />
                  </button>
                )}
                <button className="p-3 text-slate-300 hover:text-primary transition-colors">
                  <ImageIcon className="w-6 h-6" />
                </button>
              <input 
                type="text" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your message..."
                className="flex-1 bg-transparent border-none outline-none text-[11px] font-black uppercase tracking-widest py-5 placeholder:text-slate-300"
              />
                <button 
                  onClick={handleSendMessage}
                  disabled={!message.trim() || submitting}
                  className="p-5 bg-primary text-white rounded-[1.5rem] shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all group"
                >
                  <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>

            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/30">
            <div className="w-24 h-24 rounded-[3rem] bg-slate-100 flex items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 mb-10 group hover:rotate-12 transition-transform">
               <MessageCircle className="w-10 h-10 group-hover:scale-110 transition-transform" />
            </div>
            <h2 className="text-3xl font-black mb-4 text-slate-900 uppercase italic tracking-tighter leading-none">Intelligence <span className="text-primary tracking-normal">HQ</span></h2>
            <p className="text-slate-400 max-w-sm font-bold text-[11px] leading-relaxed uppercase tracking-[0.2em] italic opacity-60">Mission security is our priority. All official comms must happen through the Fix Link secure channel.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <React.Suspense fallback={
       <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
       </div>
    }>
       <ChatContent />
    </React.Suspense>
  );
}

