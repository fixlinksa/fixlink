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
  ExternalLink,
  Download,
  Upload,
  X
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
import { sendMessage, getChatThreads, getEstimatesByJob, getInvoicesByJob, getJob, getUserProfile, deleteChat, deleteMessage } from '@/lib/db';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PdfDocument } from '@/components/PdfDocument';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        amount: doc.amount || 0,
        lineItems: doc.lineItems || [],
        notes: doc.notes || ''
      });
      setIsAttachOpen(false);
    } catch (err: any) {
      alert("Failed to attach document.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadDoc = async (msg: any) => {
    setDownloadingDoc(msg.id);
    try {
      const [jobData, proProfile] = await Promise.all([
        getJob(selectedChat.jobId),
        getUserProfile(selectedChat.tradesmanId)
      ]);

      if (!jobData || !proProfile) throw new Error("Mission data unavailable");

      // Calculate totals for the PDF component
      const lineItems = msg.lineItems || [];
      const totals = lineItems.reduce((acc: any, item: any) => {
        const itemTotalIncl = item.sellingIncl * item.quantity;
        const isVatRegistered = proProfile.isVatRegistered || false;
        const itemTotalExcl = isVatRegistered ? (itemTotalIncl / 1.15) : itemTotalIncl;
        const itemCostTotal = (item.costExcl || 0) * item.quantity;
        return {
          excl: acc.excl + itemTotalExcl,
          incl: acc.incl + itemTotalIncl,
          vat: isVatRegistered ? (acc.vat + (itemTotalIncl - itemTotalExcl)) : 0,
          cost: acc.cost + itemCostTotal
        };
      }, { excl: 0, incl: 0, vat: 0, cost: 0 });

      setPdfData({ job: jobData, profile: proProfile, lineItems, totals, type: msg.docType });

      // Small delay for DOM to render the hidden PDF component
      setTimeout(async () => {
        const input = document.getElementById('chat-pdf-renderer');
        if (!input) return;
        const canvas = await html2canvas(input, { scale: 1.5, useCORS: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        pdf.save(`${msg.docType.toLowerCase()}_${msg.docId.slice(-6)}.pdf`);
        setDownloadingDoc(null);
        setPdfData(null);
      }, 500);

    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Failed to generate file for download.");
      setDownloadingDoc(null);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChat || !confirm("Permanently remove this message from the mission log?")) return;
    try {
      await deleteMessage(selectedChat.id, messageId);
    } catch (err) {
      alert("Failed to remove message.");
    }
  };

  const handleTerminateSession = async () => {
    if (!selectedChat || !confirm("Permanently scale back this mission thread?")) return;
    try {
       await deleteChat(selectedChat.id);
       setSelectedChat(null);
    } catch (err) {
       alert("Session termination failed.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat || !user || !profile) return;

    setSubmitting(true);
    try {
      const storageRef = ref(storage, `chats/${selectedChat.id}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const isImage = file.type.startsWith('image/');
      await sendMessage(selectedChat.id, user.uid, `📎 ${isImage ? 'Photo' : 'File'} attached: ${file.name}`, profile.role, {
        type: isImage ? 'image' : 'file',
        fileUrl: downloadURL,
        fileName: file.name,
        fileSize: file.size
      });
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Mission upload failed.");
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
      {/* Hidden PDF Renderer for Downloads */}
      {pdfData && (
        <div className="fixed -left-[9999px] -top-[9999px]">
          <div id="chat-pdf-renderer">
             <PdfDocument {...pdfData} />
          </div>
        </div>
      )}

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
            <header className="p-4 md:p-10 bg-white border-b border-slate-100 flex items-center justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="flex items-center gap-4 md:gap-6 relative z-10 w-full">
                <button 
                  onClick={() => setSelectedChat(null)} 
                  className="md:hidden p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 shadow-sm"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-[1rem] md:rounded-[1.5rem] bg-slate-900 flex items-center justify-center text-white font-black uppercase italic border border-white/10 text-lg md:text-xl shadow-xl">
                   {(profile?.role === 'customer' ? (selectedChat.tradesmanName || 'P') : (selectedChat.customerName || 'C'))?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="hidden md:flex items-center gap-2 mb-1">
                    <span className="w-4 h-[1px] bg-primary opacity-40"></span>
                    <p className="text-[9px] font-black text-primary italic uppercase tracking-widest">Secure Intelligence Channel</p>
                  </div>
                  <h2 className="font-black text-sm md:text-xl uppercase tracking-tighter italic text-slate-900 leading-none mb-1 truncate">
                    <span className="text-primary">{profile?.role === 'customer' ? (selectedChat.tradesmanName || 'Professional') : (selectedChat.customerName || 'Customer')}</span>
                  </h2>
                  <p className="text-[8px] md:text-[10px] font-bold text-slate-400 truncate uppercase tracking-tight italic opacity-60">Mission: {selectedChat.jobTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-3">
                 <button 
                   onClick={handleTerminateSession}
                   className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-white border border-red-50 text-red-400 hover:bg-red-50 hover:text-red-500 transition-all flex items-center gap-3 text-[10px] font-black uppercase tracking-widest italic"
                 >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden lg:inline">Terminate Session</span>
                 </button>
                 <button className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-900 transition-all">
                   <MoreVertical className="w-5 h-5" />
                 </button>
              </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-10 scroll-smooth no-scrollbar lg:bg-slate-50/50">
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
                    "max-w-[90%] md:max-w-lg p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm relative group",
                    msg.senderId === user?.uid 
                      ? "bg-slate-900 text-white rounded-tr-none" 
                      : "bg-white text-slate-900 border border-slate-100 rounded-tl-none"
                  )}>
                    {msg.type === 'document' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center",
                            msg.senderId === user?.uid ? "bg-white/10" : "bg-slate-100"
                          )}>
                             <FileText className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest italic opacity-60">Mission {msg.docType}</p>
                            <p className="text-xs md:text-sm font-black tracking-tight">{msg.docType} #{msg.docId.slice(-6)}</p>
                          </div>
                        </div>
                        <div className={cn(
                          "p-3 md:p-4 rounded-xl border",
                          msg.senderId === user?.uid ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"
                        )}>
                           <div className="flex justify-between items-center mb-4">
                              <span className="text-[9px] font-black uppercase italic opacity-60">Total Value</span>
                              <span className="text-xs md:text-sm font-black">R {msg.amount?.toFixed(2)}</span>
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                             <button 
                               onClick={() => router.push(`/jobs/view/${msg.docType.toLowerCase()}?id=${selectedChat.jobId}`)}
                               className={cn(
                                 "py-2.5 rounded-lg flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all",
                                 msg.senderId === user?.uid ? "bg-white text-slate-900" : "bg-primary text-white"
                               )}
                             >
                                <ExternalLink className="w-3 h-3" /> View
                             </button>
                             <button 
                               onClick={() => handleDownloadDoc(msg)}
                               disabled={downloadingDoc === msg.id}
                               className={cn(
                                 "py-2.5 rounded-lg flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all",
                                 msg.senderId === user?.uid ? "bg-white/10 text-white" : "bg-slate-200 text-slate-700"
                               )}
                             >
                                {downloadingDoc === msg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                PDF
                             </button>
                           </div>
                        </div>
                      </div>
                    )}

                    {msg.type === 'image' && (
                      <div className="space-y-3">
                         <img 
                           src={msg.fileUrl} 
                           alt="Attached" 
                           className="rounded-2xl w-full max-h-72 object-cover cursor-pointer hover:brightness-90 transition-all"
                           onClick={() => window.open(msg.fileUrl, '_blank')}
                         />
                         <div className="flex items-center justify-between px-2">
                            <p className="text-[9px] font-bold opacity-60 italic truncate max-w-[150px]">{msg.fileName}</p>
                            <a href={msg.fileUrl} download={msg.fileName} target="_blank" className="text-primary">
                               <Download className="w-3.5 h-3.5" />
                            </a>
                         </div>
                      </div>
                    )}

                    {msg.type === 'file' && (
                      <div className={cn(
                        "p-4 rounded-2xl flex items-center gap-4 border",
                        msg.senderId === user?.uid ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-100"
                      )}>
                         <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <FileText className="w-5 h-5" />
                         </div>
                         <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest italic truncate">{msg.fileName}</p>
                            <p className="text-[9px] font-bold opacity-40">{(msg.fileSize / 1024).toFixed(0)} KB</p>
                         </div>
                         <a href={msg.fileUrl} download={msg.fileName} target="_blank" className="p-3 bg-white rounded-lg shadow-sm text-primary">
                            <Download className="w-4 h-4" />
                         </a>
                      </div>
                    )}

                    {!msg.type && (
                      <p className="text-[12px] md:text-[13px] font-bold leading-relaxed italic">{msg.text}</p>
                    )}
                    
                    <div className={cn(
                      "mt-4 flex items-center gap-3 text-[8px] font-black uppercase tracking-[0.2em] italic",
                      msg.senderId === user?.uid ? "text-white/30 justify-end" : "text-slate-300 justify-start"
                    )}>
                      {msg.createdAt?.toDate ? formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true }) : 'Sending...'}
                      {msg.senderId === user?.uid && (
                        <div className="flex items-center gap-2">
                           <CheckCheck className="w-3.5 h-3.5" />
                           <button 
                             onClick={() => handleDeleteMessage(msg.id)}
                             className="p-1 hover:text-red-400 transition-colors"
                           >
                              <Trash2 className="w-3 h-3" />
                           </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <footer className="p-3 md:p-12 bg-white border-t border-slate-100 relative">
               <input 
                 type="file" 
                 className="hidden" 
                 ref={fileInputRef} 
                 onChange={handleFileUpload}
                 accept="image/*,.pdf,.doc,.docx"
               />
               <AnimatePresence>
                 {isAttachOpen && (
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 20 }}
                     className="absolute bottom-full left-3 right-3 md:left-6 md:right-6 mb-4 bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden z-20"
                   >
                     <div className="p-4 md:p-6 border-b border-slate-50 flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-widest italic text-slate-400">Mission Documentation</h4>
                        <button onClick={() => setIsAttachOpen(false)} className="text-[9px] font-black uppercase italic text-primary">Close</button>
                     </div>
                     <div className="max-h-64 overflow-y-auto p-2 md:p-4 space-y-2 no-scrollbar">
                        {loadingDocs ? (
                          <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
                        ) : availableDocs.length === 0 ? (
                          <div className="py-12 text-center text-[10px] font-black uppercase tracking-widest italic opacity-30">No generated documents found for this mission.</div>
                        ) : availableDocs.map(doc => (
                          <button 
                            key={doc.id}
                            onClick={() => sendAttachment(doc)}
                            className="w-full flex items-center justify-between p-3 md:p-5 rounded-xl md:rounded-2xl border border-slate-50 hover:border-primary/20 hover:bg-slate-50 transition-all text-left group"
                          >
                             <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-100 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                   <FileText className="w-4 h-4 md:w-5 md:h-5" />
                                </div>
                                <div>
                                   <p className="text-[9px] font-black uppercase italic text-slate-400">{doc.docType}</p>
                                   <p className="text-[10px] md:text-[11px] font-bold text-slate-700">#{doc.id.slice(-6)}</p>
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="text-[10px] md:text-[11px] font-black text-slate-900">R {doc.amount?.toFixed(2)}</p>
                                <p className="text-[8px] font-bold text-slate-400">ID: {doc.id.slice(0, 8)}</p>
                             </div>
                          </button>
                        ))}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
            <div className="flex items-center gap-2 md:gap-4 bg-slate-50 p-2 pl-3 md:pl-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-white transition-all">
                {profile?.role === 'tradesman' && (
                  <button 
                    onClick={handleAttachClick}
                    className={cn(
                      "p-2 md:p-3 transition-colors",
                      isAttachOpen ? "text-primary" : "text-slate-300 hover:text-primary"
                    )}
                  >
                    <Paperclip className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                )}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 md:p-3 text-slate-300 hover:text-primary transition-colors"
                >
                  <ImageIcon className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              <input 
                type="text" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Message..."
                className="flex-1 bg-transparent border-none outline-none text-[10px] md:text-[11px] font-black uppercase tracking-widest py-3 md:py-5 placeholder:text-slate-300"
              />
                <button 
                  onClick={handleSendMessage}
                  disabled={!message.trim() || submitting}
                  className="p-3 md:p-5 bg-primary text-white rounded-[1rem] md:rounded-[1.5rem] shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all group"
                >
                  <Send className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
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

