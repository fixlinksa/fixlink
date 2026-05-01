'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Star, Send, Inbox, ChevronDown, ChevronUp, Loader2, CheckCircle2, MessageSquare, AlertCircle, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getProReviews, getUnreviewedJobs, sendReviewRequest, ProReview, Job } from '@/lib/db';

interface ProReviewsSectionProps {
  tradesmanId: string;
  proName: string;
  overallRating?: number;
  reviewCount?: number;
}

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const starSize = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`${starSize} ${s <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-600'}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: ProReview }) {
  const [expanded, setExpanded] = useState(false);
  const date = review.completedAt?.toDate?.()
    ? review.completedAt.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    : review.completedAt
      ? new Date(review.completedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

  const hasLongReview = review.review.length > 120;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 hover:border-white/20 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0 text-white text-sm font-semibold">
            {review.customerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-medium text-sm leading-tight">{review.customerName}</p>
            <p className="text-gray-400 text-xs">{date}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <StarDisplay rating={review.rating} />
          <p className="text-amber-400 text-xs font-semibold mt-0.5">{review.rating.toFixed(1)}</p>
        </div>
      </div>

      {/* Job Tag */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Briefcase className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{review.jobTitle}</span>
      </div>

      {/* Review text */}
      {review.review && (
        <div>
          <p className={`text-gray-300 text-sm leading-relaxed ${!expanded && hasLongReview ? 'line-clamp-2' : ''}`}>
            "{review.review}"
          </p>
          {hasLongReview && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-violet-400 mt-1 hover:text-violet-300 transition-colors"
            >
              {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Read more</>}
            </button>
          )}
        </div>
      )}

      {!review.review && (
        <p className="text-gray-500 text-xs italic">No written review provided.</p>
      )}
    </motion.div>
  );
}

function RequestCard({ job, proName, onSent }: { job: Job; proName: string; onSent: (jobId: string) => void }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState((job as any).reviewRequestSent || false);
  const [error, setError] = useState('');

  const handleRequest = async () => {
    setSending(true);
    setError('');
    try {
      await sendReviewRequest(job.id, proName);
      setSent(true);
      onSent(job.id);
    } catch (e: any) {
      setError(e.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:border-white/20 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shrink-0">
          <Briefcase className="w-4 h-4 text-gray-300" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{job.title}</p>
          <p className="text-gray-400 text-xs truncate">{job.customerName}</p>
        </div>
      </div>

      <div className="shrink-0">
        {sent ? (
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Sent</span>
          </div>
        ) : (
          <button
            onClick={handleRequest}
            disabled={sending}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{sending ? 'Sending…' : 'Request'}</span>
          </button>
        )}
        {error && <p className="text-red-400 text-[10px] mt-1 text-right">{error}</p>}
      </div>
    </motion.div>
  );
}

export default function ProReviewsSection({
  tradesmanId,
  proName,
  overallRating,
  reviewCount,
}: ProReviewsSectionProps) {
  const [reviews, setReviews] = useState<ProReview[]>([]);
  const [unreviewed, setUnreviewed] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'received' | 'request'>('received');
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rv, un] = await Promise.all([
        getProReviews(tradesmanId),
        getUnreviewedJobs(tradesmanId),
      ]);
      setReviews(rv);
      // Pre-populate sentIds from DB flag
      const alreadySent = new Set(un.filter((j: any) => j.reviewRequestSent).map(j => j.id));
      setSentIds(alreadySent);
      setUnreviewed(un);
    } catch (e) {
      console.error('Failed to load reviews:', e);
    } finally {
      setLoading(false);
    }
  }, [tradesmanId]);

  useEffect(() => { load(); }, [load]);

  const handleSent = (jobId: string) => {
    setSentIds(prev => new Set([...prev, jobId]));
  };

  const avgRating = overallRating ?? (reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0);
  const totalReviews = reviewCount ?? reviews.length;

  // Rating breakdown
  const breakdown = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(r.rating) === star).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Star className="w-5 h-5 text-white fill-white" />
        </div>
        <div>
          <h2 className="text-white font-bold text-lg">Customer Ratings</h2>
          <p className="text-gray-400 text-sm">Feedback from your completed jobs</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Rating Summary Card */}
          {totalReviews > 0 && (
            <div className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/20 rounded-2xl p-5 flex gap-6 items-center">
              {/* Big Number */}
              <div className="text-center shrink-0">
                <p className="text-5xl font-black text-white">{avgRating.toFixed(1)}</p>
                <StarDisplay rating={avgRating} size="lg" />
                <p className="text-gray-400 text-xs mt-1">{totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}</p>
              </div>
              {/* Breakdown bars */}
              <div className="flex-1 space-y-1.5 min-w-0">
                {breakdown.map(({ star, count }) => {
                  const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 w-4 shrink-0">{star}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="h-full bg-amber-400 rounded-full"
                        />
                      </div>
                      <span className="text-gray-500 w-4 text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabs — matches dashboard tab bar theme */}
          <div className="flex items-center gap-6 border-b border-slate-100 pb-2 overflow-x-auto no-scrollbar">
            {([
              { id: 'received', label: 'Reviews Received', icon: MessageSquare, badge: reviews.length, badgeColor: 'bg-amber-500 text-black' },
              { id: 'request',  label: 'Request Reviews',  icon: Send,          badge: unreviewed.length, badgeColor: 'bg-primary text-white' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative shrink-0 ${
                  activeTab === tab.id
                    ? 'text-primary italic'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'fill-primary/10' : ''}`} />
                {tab.label}
                {tab.badge > 0 && (
                  <span className={`w-5 h-5 ${tab.badgeColor} rounded-full flex items-center justify-center text-[8px] font-black shadow-lg shadow-primary/20`}>
                    {tab.badge}
                  </span>
                )}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="reviewsActiveTab"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'received' && (
              <motion.div
                key="received"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-3"
              >
                {reviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                      <Star className="w-7 h-7 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-gray-300 font-semibold">No reviews yet</p>
                      <p className="text-gray-500 text-sm mt-1">
                        Reviews appear here when customers rate your completed jobs.
                      </p>
                    </div>
                  </div>
                ) : (
                  reviews.map(r => <ReviewCard key={r.jobId} review={r} />)
                )}
              </motion.div>
            )}

            {activeTab === 'request' && (
              <motion.div
                key="request"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-3"
              >
                {/* Info Banner */}
                <div className="flex items-start gap-3 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                  <p className="text-violet-300 text-xs leading-relaxed">
                    These are completed jobs where the customer hasn't left a rating yet.
                    Tap <strong>Request</strong> to send them a notification asking for feedback.
                  </p>
                </div>

                {unreviewed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                      <Inbox className="w-7 h-7 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-gray-300 font-semibold">All jobs reviewed!</p>
                      <p className="text-gray-500 text-sm mt-1">
                        Every completed job has a rating. Great work!
                      </p>
                    </div>
                  </div>
                ) : (
                  unreviewed.map(job => (
                    <RequestCard
                      key={job.id}
                      job={job}
                      proName={proName}
                      onSent={handleSent}
                    />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
