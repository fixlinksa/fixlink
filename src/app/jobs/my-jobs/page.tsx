'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { Briefcase, Calendar, MapPin, Clock, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function MyJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'jobs'),
          where('customerId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const jobsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setJobs(jobsData);
      } catch (error) {
        console.error("Error fetching jobs:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pb-32">
      <div>
        <h1 className="text-4xl font-black tracking-tight uppercase italic mb-2">My <span className="text-primary">Jobs</span></h1>
        <p className="text-muted-foreground font-medium">History of your service requests</p>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-muted/30 border border-dashed border-border rounded-[2.5rem] p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
             <Briefcase className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">No jobs posted yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">Once you post a job, it will appear here for you to track quotes and progress.</p>
          <Link href="/jobs/new" className="inline-block bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-all">
            Post Your First Job
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/view?id=${job.id}`}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="bg-white border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{job.title}</h3>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground font-medium">
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(job.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1.5 capitalize"><Clock className="w-3.5 h-3.5" /> {job.status || 'Open'}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </motion.div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
