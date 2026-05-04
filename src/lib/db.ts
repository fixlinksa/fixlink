import { db, auth } from './firebase';
export { db };
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit,
  collectionGroup,
  deleteDoc,
  Timestamp,
  deleteField
} from 'firebase/firestore';
import { TIER_CONFIG, TierId, UnitTypeId } from './constants';

// ─── In-Memory Cache ─────────────────────────────────────────────────
// Prevents redundant Firestore round-trips for frequently accessed data.
const memCache = new Map<string, { data: any; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  if (entry) memCache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttlMs: number = 60_000) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    memCache.clear();
    return;
  }
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
}

export type UserRole = 'customer' | 'tradesman' | 'admin' | 'professional' | 'pro';

export interface InventoryItem {
  id: string;
  name: string;
  unitType: UnitTypeId;
  costExcl: number;
  sellingIncl: number;
  stockLevel: number;
  updatedAt: any;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  category: string;
  categories: string[];
  status: 'pending' | 'quoted' | 'estimated' | 'declined' | 'assigned' | 'accepted' | 'secured' | 'in-progress' | 'billed' | 'invoiced' | 'completed' | 'cancelled' | 'drafting';
  total?: number;
  budget?: string | number;
  location: string | { address?: string; lat: number; lng: number };
  locationData?: { address?: string; lat: number; lng: number };
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  isStandalone?: boolean;
  tradesmanId?: string;
  amount?: number;
  estimateAmount?: number;
  lineItems?: any[];
  notes?: string;
  images?: string[];
  depositAmount?: number;
  depositType?: 'percentage' | 'fixed';
  depositPaid?: boolean;
  isPaid?: boolean;
  amountPaid?: number;
  createdAt: any;
  expireAt?: any;
  estimatedAt?: any;
  billedAt?: any;
  completedAt?: any;
  proCompletedAt?: any;
  rating?: number;
  review?: string;
  reference?: string;
  isVatRegistered?: boolean;
  customerVatNumber?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  tier?: TierId;
  fullName: string;
  imageUrl?: string;
  website?: string;
  isVatRegistered?: boolean;
  contactPhone?: string;
  businessName?: string;
  companyName?: string;
  vatNumber?: string;
  isAvailable?: boolean;
  registrationNumber?: string;
  isCompany?: boolean;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  accountType?: string;
  branchCode?: string;
  onboardingCompleted?: boolean;
  bio?: string;
  trade?: string;
  trades?: string[];
  address?: string;
  location?: {
    address?: string;
    lat: number;
    lng: number;
  };
  serviceRadius?: number;
  rating?: number;
  reviewCount?: number;
  companyLogoUrl?: string;
  hasSeenWelcome?: boolean;
  estimateExpiryDays?: number;
  tierStatus?: 'active' | 'trial';
  tierTrialExpiresAt?: any;
  trialStartDate?: any;
  preTrialTier?: TierId;
  createdAt: any;
  status?: 'active' | 'suspended' | 'pending';
  phone?: string;
  phoneNumber?: string;
  mobile?: string;
  contactNumber?: string;
  distance?: number;
  name?: string;
  mutedNotifications?: boolean;
}

// Helper to remove undefined values before Firestore write
const sanitizeData = (data: any): any => {
  if (data === null || data === undefined) return null;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) return data.map(item => sanitizeData(item));
  if (typeof data !== 'object') return data;
  
  const result: any = {};
  Object.keys(data).forEach((key) => {
    if (data[key] !== undefined) {
      result[key] = sanitizeData(data[key]);
    }
  });
  return result;
};

export const syncUserProfile = async (userId: string, data: Partial<UserProfile>) => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  const sanitized = sanitizeData(data);

  if (!userSnap.exists()) {
    const newUser = {
      ...sanitized,
      createdAt: new Date(),
    };
    await setDoc(userRef, newUser);
    return { ...newUser, id: userId };
  } else {
    // Merge existing with new data
    const existingData = userSnap.data();
    const updatedData = { ...existingData, ...sanitized };
    await updateDoc(userRef, sanitized);
    return { ...updatedData, id: userId };
  }
};

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>) => {
  const userRef = doc(db, 'users', userId);
  const sanitized = sanitizeData(data);
  await updateDoc(userRef, sanitized);
  invalidateCache(`profile:${userId}`);
  invalidateCache('pros:');
  return { id: userId, ...sanitized };
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const cacheKey = `profile:${userId}`;
  const cached = getCached<UserProfile>(cacheKey);
  if (cached) return cached;

  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  const result = userSnap.exists() ? ({ ...userSnap.data(), id: userId } as UserProfile) : null;
  if (result) setCache(cacheKey, result, 120_000); // 2 min TTL
  return result;
};

// Simple Haversine distance for 70km filtering
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function extractCoordinates(location: any): { lat: number; lng: number } | null {
  if (!location) return null;
  
  // Handle Array format [lat, lng]
  if (Array.isArray(location)) {
    const lat = parseFloat(String(location[0]));
    const lng = parseFloat(String(location[1]));
    return (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null;
  }

  // Handle String format "lat, lng" or JSON string
  if (typeof location === 'string') {
    try {
      // Try JSON parse first
      if (location.startsWith('{')) {
        const parsed = JSON.parse(location);
        return extractCoordinates(parsed);
      }
      // Try comma split
      const parts = location.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
      }
    } catch (e) {
      // Not parseable
    }
    return null;
  }

  // Handle Object formats
  const rawLat = location.lat ?? location.latitude ?? location._lat;
  const rawLng = location.lng ?? location.longitude ?? location.long ?? location._long;
  
  const lat = parseFloat(String(rawLat));
  const lng = parseFloat(String(rawLng));
  
  if (!isNaN(lat) && !isNaN(lng)) {
    return { lat, lng };
  }

  return null;
}

/**
 * Universal trade matching logic.
 * Checks for word-stem overlaps to handle legacy vs new data (e.g. "Plumbing" vs "Plumbers")
 */
function lenientTradeMatch(proTradeRaw: string | string[] | undefined, targetTradeRaw: string): boolean {
  if (!proTradeRaw) return false;
  const target = targetTradeRaw.toLowerCase();
  if (target === 'general services') return true;

  const proTrades = Array.isArray(proTradeRaw) 
    ? proTradeRaw.map(t => t.toLowerCase()) 
    : [proTradeRaw.toLowerCase()];

  // Primary: Exact or partial inclusion
  if (proTrades.some(t => t.includes(target) || target.includes(t))) return true;

  // Secondary: Word Stem Overlap (e.g. "Plumb", "Electr", "Paint")
  const stems = target.split(/[\s&,/]+/).filter(s => s.length > 3).map(s => s.substring(0, 5));
  if (stems.length > 0) {
    return proTrades.some(t => stems.some(stem => t.includes(stem)));
  }

  return false;
}

export const getProsByTrade = async (trade: string, userLat?: number, userLng?: number) => {
  const cacheKey = `pros:${trade}:${userLat}:${userLng}`;
  const cached = getCached<UserProfile[]>(cacheKey);
  if (cached) return cached;

  const allPros = await getUsersByRole('tradesman');
  
  const results: UserProfile[] = [];

  allPros.forEach((data) => {
    if (data.isAvailable === false) return;

    const match = (trade === 'General Services') || 
                  (data.trades && data.trades.includes(trade)) || 
                  (data.trade && data.trade.includes(trade)) ||
                  lenientTradeMatch(data.trades || data.trade, trade);

    if (!match) return;

    const tierRaw = (data.tier || 'starter').toLowerCase();
    // Use a safe lookup that doesn't trigger prototype inheritance issues
    const validTiers = ['platinum', 'gold', 'starter'];
    const tier = (validTiers.includes(tierRaw) ? tierRaw : 'starter') as keyof typeof TIER_CONFIG;
    const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.starter;
    const allowedRadius = tierConfig.radius || 70;

    // Proximity checking logic
    const proLocation = data.location || data.address;
    const coords = extractCoordinates(proLocation);

    // Case 1: We have both user location and professional location
    if (userLat && userLng && coords) {
      const distance = getDistance(userLat, userLng, coords.lat, coords.lng);
      
      // Strict Radius Enforcement (70km for Gold/Starter, 500km for Platinum)
      if (distance <= allowedRadius) {
        results.push({ ...data, tier, distance });
      }
      return;
    } 
    
    // Case 2: No user location provided OR professional has no coordinates
    if (!userLat || !userLng) {
      // Global/Generic search: Only show high-tier legends
      if (tier === 'platinum' || (tier === 'gold' && trade === 'General Services')) {
        results.push({ ...data, tier, distance: 1000 });
      }
    } else if (tier === 'platinum' && trade === 'General Services') {
      // User provided location, but pro has none: Platinum fallback
      results.push({ ...data, tier, distance: 2000 });
    }
  });

  // Sort by Priority (Tier) then distance
  const sorted = results.sort((a, b) => {
    // Ultra-safe priority lookup
    const getPrio = (t: any) => {
      const k = String(t || 'starter').toLowerCase();
      if (k === 'platinum') return 3;
      if (k === 'gold') return 2;
      return 1;
    };

    const prioA = getPrio(a.tier);
    const prioB = getPrio(b.tier);

    if (prioA !== prioB) {
      return prioB - prioA; // Higher priority first
    }
    return (a.distance || 0) - (b.distance || 0);
  });
  
  setCache(cacheKey, sorted, 60_000); // 1 min TTL
  return sorted;
};

export const getUsersByRole = async (role: UserRole) => {
  const cacheKey = `role:${role}`;
  const cached = getCached<UserProfile[]>(cacheKey);
  if (cached) return cached;

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', '==', role));
  const querySnapshot = await getDocs(q);
  
  const results: UserProfile[] = [];
  querySnapshot.forEach((doc) => {
    results.push({ ...doc.data() as UserProfile, id: doc.id });
  });

  setCache(cacheKey, results, 60_000); // 1 min TTL
  return results;
};

// Inventory Helpers
export const getInventory = async (userId: string): Promise<InventoryItem[]> => {
  const inventoryRef = collection(db, 'users', userId, 'inventory');
  const querySnapshot = await getDocs(inventoryRef);
  
  const results: InventoryItem[] = [];
  querySnapshot.forEach((doc) => {
    results.push({ ...doc.data() as InventoryItem, id: doc.id });
  });

  return results;
};

export const upsertInventoryItem = async (userId: string, item: Partial<InventoryItem>) => {
  const inventoryRef = collection(db, 'users', userId, 'inventory');
  const docRef = item.id ? doc(inventoryRef, item.id) : doc(inventoryRef);
  const data = {
    ...item,
    id: docRef.id,
    updatedAt: new Date()
  };
  await setDoc(docRef, sanitizeData(data), { merge: true });
  return data as InventoryItem;
};

export const updateStock = async (userId: string, itemId: string, change: number) => {
  const itemRef = doc(db, 'users', userId, 'inventory', itemId);
  const itemSnap = await getDoc(itemRef);
  if (itemSnap.exists()) {
    const currentStock = itemSnap.data().stockLevel || 0;
    await updateDoc(itemRef, { stockLevel: currentStock + change });
  }
};

export const getJob = async (jobId: string): Promise<Job | null> => {
  try {
    const jobRef = doc(db, 'jobs', jobId);
    const jobSnap = await getDoc(jobRef);
    if (jobSnap.exists()) {
      return { ...jobSnap.data(), id: jobSnap.id } as Job;
    }
    return null;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn(`Firestore Access restricted for mission ${jobId}. Attempting lead fallback...`);
      try {
        const leadRef = doc(db, 'leads', jobId);
        const leadSnap = await getDoc(leadRef);
        if (leadSnap.exists()) {
          console.log('RECON SUCCESS: Public lead data recovered.');
          return { ...leadSnap.data(), id: leadSnap.id, status: 'pending' } as any;
        }
      } catch (fallbackError) {
        console.error('LEAD FALLBACK FAILED:', fallbackError);
      }
      return null;
    } else {
      console.error(`Error fetching job ${jobId}:`, error);
      throw error;
    }
  }
};

export const updateJob = async (jobId: string, data: any) => {
  const jobRef = doc(db, 'jobs', jobId);
  
  // Explicitly handle unassigning if tradesmanId is null
  const updateData = { ...data };
  if (updateData.tradesmanId === null) {
    updateData.tradesmanId = deleteField();
  }
  if (updateData.tradesmanName === null) {
     updateData.tradesmanName = deleteField();
  }

  await updateDoc(jobRef, sanitizeData(updateData));
  
  // Leads Sync: If job is no longer pending, remove from marketplace
  try {
    if (data.status && data.status !== 'pending') {
       await deleteDoc(doc(db, 'leads', jobId));
    } else {
       // If it's still pending, update lead info to match if it exists
       const jobSnap = await getDoc(jobRef);
       const jobData = jobSnap.data();
       if (jobData?.status === 'pending') {
          await setDoc(doc(db, 'leads', jobId), sanitizeData({
             ...jobData,
             id: jobId,
             jobId: jobId
          }), { merge: true });
       }
    }
  } catch (syncErr) {
    console.warn(`Marketplace sync warning for mission ${jobId}:`, syncErr);
    // Non-blocking failure: the main job update succeeded.
  }
};

export const deleteJob = async (jobId: string) => {
  // 1. Delete the job and lead
  await deleteDoc(doc(db, 'jobs', jobId));
  await deleteDoc(doc(db, 'leads', jobId));

  // 2. Cascade delete all associated chats
  try {
    const chatsRef = collection(db, 'chats');
    const userId = auth.currentUser?.uid;
    let q;
    
    if (userId) {
      q = query(chatsRef, where('jobId', '==', jobId), where('participants', 'array-contains', userId));
    } else {
      q = query(chatsRef, where('jobId', '==', jobId));
    }
    
    const snapshot = await getDocs(q);
    
    // Batch delete would be safer but simple for now
    const deletions = snapshot.docs.map(chatDoc => deleteDoc(chatDoc.ref));
    await Promise.all(deletions);
  } catch (err) {
    console.error("Failed to cascade delete chats for job:", jobId, err);
  }
};

export const deleteChat = async (chatId: string) => {
  await deleteDoc(doc(db, 'chats', chatId));
};

export const deleteMessage = async (chatId: string, messageId: string) => {
  await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
};

export const declineJob = async (jobId: string) => {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) return;
  const jobData = jobSnap.data();

  // Reset job to pending and clear tradesman
  await updateDoc(jobRef, {
    status: 'pending',
    tradesmanId: deleteField()
  });

  // Re-sync to leads marketplace
  await setDoc(doc(db, 'leads', jobId), sanitizeData({
    ...jobData,
    id: jobId,
    jobId: jobId,
    status: 'pending',
    tradesmanId: null,
    updatedAt: new Date()
  }));

  // Notify customer of mission re-deployment
  await setDoc(doc(collection(db, 'notifications')), sanitizeData({
    userId: jobData.customerId,
    type: 'job_declined',
    title: 'Mission Update',
    message: `The professional has declined the mission: "${jobData.title}". It is now back in the marketplace.`,
    jobId: jobId,
    createdAt: new Date(),
    read: false
  }));
};

export const declineEstimate = async (jobId: string, estimateId: string) => {
  const jobRef = doc(db, 'jobs', jobId);
  const estimateRef = doc(db, 'jobs', jobId, 'estimates', estimateId);
  
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) return;
  const jobData = jobSnap.data();

  // Mark estimate as declined or delete it? 
  // User said "decline", let's mark it as declined in the estimate itself
  // but also check if we should revert the job status.
  await updateDoc(estimateRef, {
    status: 'declined',
    declinedAt: new Date()
  });

  // Check if there are any other 'pending' estimates
  const estimatesRef = collection(db, 'jobs', jobId, 'estimates');
  const estimatesSnap = await getDocs(estimatesRef);
  const pendingEstimates = estimatesSnap.docs.filter(d => !d.data().status || d.data().status === 'pending');

  if (pendingEstimates.length === 0) {
    // No more pending estimates, revert job to pending
    await updateDoc(jobRef, {
      status: 'pending',
      estimateAmount: deleteField(),
      estimatedAt: deleteField()
    });

    // Re-sync to leads marketplace
    await setDoc(doc(db, 'leads', jobId), sanitizeData({
      ...jobData,
      status: 'pending',
      estimateAmount: null,
      estimatedAt: null
    }));
  }
};



export const createJob = async (data: any) => {
  const jobsRef = collection(db, 'jobs');
  const docRef = data.id ? doc(jobsRef, data.id) : doc(jobsRef);
  const finalData = { ...data, id: docRef.id, createdAt: data.createdAt || new Date() };
  await setDoc(docRef, sanitizeData(finalData));
  
  // Sync to leads if it's a new pending job and NOT standalone
  if (finalData.status === 'pending' && !finalData.isStandalone) {
    const leadsRef = collection(db, 'leads');
    await setDoc(doc(leadsRef, docRef.id), sanitizeData({
      title: finalData.title,
      description: finalData.description,
      category: finalData.category,
      categories: finalData.categories || [finalData.category],
      location: finalData.location,
      createdAt: finalData.createdAt,
      customerId: finalData.customerId,
      jobId: docRef.id,
      images: finalData.images || []
    }));
  }
  
  return finalData as Job;
};
export const getJobsByTradesman = async (tradesmanId: string): Promise<Job[]> => {
  const jobsRef = collection(db, 'jobs');
  const q = query(jobsRef, where('tradesmanId', '==', tradesmanId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  
  const results: Job[] = [];
  querySnapshot.forEach((doc) => {
    results.push({ ...doc.data() as Job, id: doc.id });
  });

  return results;
};

export const getJobsByCustomer = async (customerId: string): Promise<Job[]> => {
  const jobsRef = collection(db, 'jobs');
  const q = query(jobsRef, where('customerId', '==', customerId), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  
  const results: Job[] = [];
  querySnapshot.forEach((doc) => {
    results.push({ ...doc.data() as Job, id: doc.id });
  });

  return results;
};

export const getQuotesByJob = async (jobId: string): Promise<any[]> => {
  // In this system, quotes are stored in 'estimates' collection linked to jobId
  const estimatesRef = collection(db, 'jobs', jobId, 'estimates');
  const querySnapshot = await getDocs(estimatesRef);
  
  const results: any[] = [];
  querySnapshot.forEach((doc) => {
    results.push({ ...doc.data(), id: doc.id });
  });

  return results;
};

export const getLeads = async (params: { 
  category?: string | string[], 
  proLat?: number, 
  proLng?: number, 
  radiusKm?: number,
  proTier?: TierId
}) => {
  const { category, proLat, proLng, radiusKm: requestedRadius, proTier } = params;
  const leadsRef = collection(db, 'leads');
  let q;
  
  if (category) {
    if (Array.isArray(category)) {
      if (category.length > 0) {
        q = query(leadsRef, where('category', 'in', category), orderBy('createdAt', 'desc'), limit(50));
      } else {
        q = query(leadsRef, orderBy('createdAt', 'desc'), limit(50));
      }
    } else {
      q = query(leadsRef, where('category', '==', category), orderBy('createdAt', 'desc'), limit(50));
    }
  } else {
    q = query(leadsRef, orderBy('createdAt', 'desc'), limit(50));
  }
  
  const querySnapshot = await getDocs(q);
  const results: any[] = [];
  const now = Date.now();
  
  // Get config for the pro's tier
  const tierConfig = TIER_CONFIG[proTier as TierId] || TIER_CONFIG.starter;
  const delayMs = (tierConfig.delayHours || 0) * 60 * 60 * 1000;
  const maxAllowedRadius = tierConfig.radius;

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    let include = true;
    
    // Tier Delay Filtering
    const createdAt = data.createdAt?.toDate?.() || (data.createdAt && new Date(data.createdAt)) || new Date();
    const availableAt = createdAt.getTime() + delayMs;
    
    if (now < availableAt) {
      include = false;
    }

    // Distance Filtering (In-Memory)
    if (include && proLat && proLng && data.location) {
      const distance = getDistance(proLat, proLng, data.location.lat, data.location.lng);
      
      // Enforce tier radius limit
      if (distance > maxAllowedRadius) {
        include = false;
      } else {
        data.distance = distance;
      }
    }
    
    if (include) {
      results.push({ ...data, id: doc.id });
    }
  });

  // Sort by distance if available, otherwise by date
  return results.sort((a, b) => {
    if (a.distance !== undefined && b.distance !== undefined) {
      return a.distance - b.distance;
    }
    return 0;
  });
};

export const getProCustomerIds = async (proId: string): Promise<string[]> => {
  const jobsRef = collection(db, 'jobs');
  const q = query(jobsRef, where('tradesmanId', '==', proId));
  const querySnapshot = await getDocs(q);
  
  const uniqueCustomers = new Set<string>();
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.customerId) {
      uniqueCustomers.add(data.customerId);
    }
  });
  
  return Array.from(uniqueCustomers);
};

export const getProCustomerCount = async (proId: string): Promise<number> => {
  const ids = await getProCustomerIds(proId);
  return ids.length;
};
export const completeJobWithRating = async (jobId: string, rating: number, review: string) => {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  
  if (!jobSnap.exists()) throw new Error('Job not found');
  const jobData = jobSnap.data();
  
  const updateData = {
    status: 'completed',
    rating,
    review,
    completedAt: new Date()
  };
  
  await updateDoc(jobRef, sanitizeData(updateData));
  
  // Update professional's overall rating
  if (jobData.tradesmanId) {
    const proRef = doc(db, 'users', jobData.tradesmanId);
    const proSnap = await getDoc(proRef);
    if (proSnap.exists()) {
      const proData = proSnap.data();
      const currentRating = typeof proData.rating === 'number' ? proData.rating : 5.0;
      const currentCount = typeof proData.reviewCount === 'number' ? proData.reviewCount : 0;
      
      const newCount = currentCount + 1;
      const calculatedRating = ((currentRating * currentCount) + rating) / newCount;
      const finalRating = isNaN(calculatedRating) ? rating : Math.round(calculatedRating * 10) / 10;
      
      await updateDoc(proRef, {
        rating: finalRating,
        reviewCount: newCount
      });
      
      // Notify professional
      await setDoc(doc(collection(db, 'notifications')), sanitizeData({
        userId: jobData.tradesmanId,
        type: 'job_completed',
        title: 'Mission Accomplished!',
        message: `Customer ${jobData.customerName || 'someone'} marked "${jobData.title}" as complete and gave you ${rating} stars.`,
        jobId,
        createdAt: new Date(),
        read: false
      }));
    }
  }
};

export const markJobAsCompleteByPro = async (jobId: string) => {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  
  if (!jobSnap.exists()) throw new Error('Mission not found');
  const jobData = jobSnap.data();
  
  const updateData = {
    status: 'completed',
    proCompletedAt: new Date(),
    updatedAt: new Date()
  };
  
  await updateDoc(jobRef, sanitizeData(updateData));
  
  // Notify customer
  await setDoc(doc(collection(db, 'notifications')), sanitizeData({
    userId: jobData.customerId,
    type: 'job_finished_pro',
    title: 'Mission Update',
    message: `Professional ${jobData.tradesmanName || 'someone'} has marked the mission "${jobData.title}" as complete. Please provide your review.`,
    jobId,
    createdAt: new Date(),
    read: false
  }));
  
  return jobData;
};

export const createNotification = async (data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  jobId?: string;
  chatId?: string;
  createdAt?: Date;
  read?: boolean;
}) => {
  const notifRef = collection(db, 'notifications');
  const finalData = sanitizeData({
    ...data,
    createdAt: data.createdAt || new Date(),
    read: data.read ?? false
  });
  const docRef = doc(notifRef);
  await setDoc(docRef, finalData);
  return docRef.id;
};

export const getNotifications = async (userId: string) => {
  const notificationsRef = collection(db, 'notifications');
  const q = query(notificationsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(20));
  const querySnapshot = await getDocs(q);
  
  const results: any[] = [];
  querySnapshot.forEach((doc) => {
    results.push({ ...doc.data(), id: doc.id });
  });
  return results;
};
export const createChatThread = async (jobId: string, customerId: string, tradesmanId: string) => {
  const chatId = `${jobId}_${tradesmanId}`;
  const chatRef = doc(db, 'chats', chatId);
  
  // Try to get it. If permission fails, it's likely we aren't in it, 
  // but if we are the pro starting it, we might get an error if rules are strict.
  try {
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) return chatId;
  } catch (e) {
    console.log("Chat check failed, likely need to create", e);
  }
  
  const jobSnap = await getDoc(doc(db, 'jobs', jobId));
  const jobData = jobSnap.data();

  // Fetch Participant Names for metadata directly from the job to avoid permission errors
  const customerName = jobData?.customerName || 'Customer';
  const tradesmanName = jobData?.tradesmanName || 'Professional';
  
  await setDoc(chatRef, sanitizeData({
    id: chatId,
    jobId,
    customerId,
    tradesmanId,
    customerName,
    tradesmanName,
    participants: [customerId, tradesmanId],
    jobTitle: jobData?.title || 'Job Thread',
    lastMessage: '',
    lastMessageAt: new Date(),
    messageCount: 0,
    createdAt: new Date()
  }));
  
  return chatId;
};


export const sendMessage = async (chatId: string, senderId: string, text: string, role: string, metadata?: any) => {
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) throw new Error('Chat thread does not exist');
  
  const chatData = chatSnap.data();
  
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const messageData = {
    senderId,
    text,
    createdAt: new Date(),
    role,
    customerId: chatData.customerId,
    tradesmanId: chatData.tradesmanId,
    ...metadata
  };
  
  await setDoc(doc(messagesRef), sanitizeData(messageData));
  
  // Update chat thread header
  await updateDoc(chatRef, {
    lastMessage: metadata?.type === 'document' ? `📎 Attached ${metadata.docType}` : text,
    lastMessageAt: new Date(),
    messageCount: (chatData.messageCount || 0) + 1
  });
  
  // Create notification for the recipient
  const recipientId = role === 'customer' ? chatData.tradesmanId : chatData.customerId;
  await setDoc(doc(collection(db, 'notifications')), sanitizeData({
    userId: recipientId,
    type: 'new_message',
    title: 'New Message',
    message: metadata?.type === 'document' ? `Attached ${metadata.docType}` : (text.length > 50 ? text.substring(0, 50) + '...' : text),
    chatId,
    jobId: chatData.jobId,
    createdAt: new Date(),
    read: false
  }));
};

export const getInvoicesByJob = async (jobId: string, tradesmanId?: string) => {
  const invoicesRef = collection(db, 'jobs', jobId, 'invoices');
  let q = query(invoicesRef, orderBy('createdAt', 'desc'));
  
  if (tradesmanId) {
    q = query(invoicesRef, where('tradesmanId', '==', tradesmanId));
  }
  
  const snap = await getDocs(q);
  const data = snap.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));

  // In-memory sort if filtered, to avoid index requirements
  if (tradesmanId) {
    return data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }
  return data;
};

export const getEstimatesByJob = async (jobId: string, tradesmanId?: string) => {
  const estimatesRef = collection(db, 'jobs', jobId, 'estimates');
  let q = query(estimatesRef);
  
  if (tradesmanId) {
     q = query(estimatesRef, where('tradesmanId', '==', tradesmanId));
  }
  
  const snap = await getDocs(q);
  const data = snap.docs.map(doc => ({ ...doc.data() as any, id: doc.id }));
  
  // In-Memory Sorting to bypass Firestore Composite Index requirements
  return data.sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
};
export const getEstimate = async (jobId: string, estimateId: string): Promise<any> => {
  const estRef = doc(db, 'jobs', jobId, 'estimates', estimateId);
  const snap = await getDoc(estRef);
  if (snap.exists()) return { ...snap.data(), id: snap.id };
  return null;
};

export const getRecentEstimatesByTradesman = async (tradesmanId: string) => {
  // Query jobs for this tradesman that have estimates
  const jobsRef = collection(db, 'jobs');
  const q = query(
    jobsRef, 
    where('tradesmanId', '==', tradesmanId),
    where('status', 'in', ['estimated', 'completed', 'active']),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  
  const snap = await getDocs(q);
  return snap.docs
    .filter(doc => doc.data().estimateAmount && doc.data().lineItems)
    .map(doc => ({
      ...doc.data(),
      id: doc.id,
      docType: 'Estimate',
      amount: doc.data().estimateAmount
    }));
};

export const getChatThreads = async (userId: string, role: string) => {
  const chatsRef = collection(db, 'chats');
  const field = role === 'customer' ? 'customerId' : 'tradesmanId';
  const q = query(chatsRef, where(field, '==', userId), orderBy('lastMessageAt', 'desc'));
  const querySnapshot = await getDocs(q);
  
  const results: any[] = [];
  querySnapshot.forEach((doc) => {
    results.push({ ...doc.data(), id: doc.id });
  });
  return results;
};
export const markNotificationAsRead = async (notifId: string) => {
  const notifRef = doc(db, 'notifications', notifId);
  await updateDoc(notifRef, { read: true });
};

export const toggleAvailability = async (userId: string, isAvailable: boolean) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { isAvailable });
  invalidateCache('user_');
};

export const adminSendMessage = async (adminId: string, recipientId: string, text: string) => {
  const chatId = `admin_${adminId}_${recipientId}`;
  const chatRef = doc(db, 'chats', chatId);
  
  // Ensure thread exists
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) {
    const adminSnap = await getDoc(doc(db, 'users', adminId));
    const recipientSnap = await getDoc(doc(db, 'users', recipientId));
    const adminData = adminSnap.data();
    const recipientData = recipientSnap.data();

    await setDoc(chatRef, sanitizeData({
      id: chatId,
      jobId: 'admin_support',
      customerId: adminData?.role === 'customer' ? adminId : recipientId,
      tradesmanId: adminData?.role === 'tradesman' ? adminId : recipientId,
      customerName: adminData?.role === 'customer' ? adminData.fullName : recipientData?.fullName,
      tradesmanName: adminData?.role === 'tradesman' ? adminData.fullName : recipientData?.fullName,
      participants: [adminId, recipientId],
      jobTitle: 'Admin Support Thread',
      lastMessage: '',
      lastMessageAt: new Date(),
      messageCount: 0,
      createdAt: new Date(),
      isAdminThread: true
    }));
  }

  // Send message using standard logic but with admin context
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  await setDoc(doc(messagesRef), sanitizeData({
    senderId: adminId,
    text,
    createdAt: new Date(),
    role: 'admin'
  }));

  await updateDoc(chatRef, {
    lastMessage: text,
    lastMessageAt: new Date(),
    messageCount: (chatSnap.exists() ? (chatSnap.data()?.messageCount || 0) : 0) + 1
  });

  // Notify recipient
  await setDoc(doc(collection(db, 'notifications')), sanitizeData({
    userId: recipientId,
    type: 'admin_message',
    title: 'Admin Communication',
    message: text.length > 50 ? text.substring(0, 50) + '...' : text,
    chatId,
    createdAt: new Date(),
    read: false
  }));

  return chatId;
};

export const repairJobFinancials = async (jobId: string) => {
  try {
    const jobRef = doc(db, 'jobs', jobId);
    const jobSnap = await getDoc(jobRef);
    if (!jobSnap.exists()) return;
    const jobData = jobSnap.data();

    // Repair Estimates
    const estimatesRef = collection(db, 'jobs', jobId, 'estimates');
    const estSnap = await getDocs(estimatesRef);
    for (const edoc of estSnap.docs) {
      if (!edoc.data().customerId || !edoc.data().tradesmanId) {
        await updateDoc(edoc.ref, {
          customerId: jobData.customerId,
          tradesmanId: jobData.tradesmanId
        });
      }
    }

    // Repair Invoices
    const invoicesRef = collection(db, 'jobs', jobId, 'invoices');
    const invSnap = await getDocs(invoicesRef);
    for (const idoc of invSnap.docs) {
      if (!idoc.data().customerId || !idoc.data().tradesmanId) {
        await updateDoc(idoc.ref, {
          customerId: jobData.customerId,
          tradesmanId: jobData.tradesmanId
        });
      }
    }

    // Repair Chats
    if (jobData.tradesmanId) {
      const chatId = `${jobId}_${jobData.tradesmanId}`;
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        const participants = chatData.participants || [];
        const needsUpdate = !participants.includes(jobData.customerId) || !participants.includes(jobData.tradesmanId);
        
        if (needsUpdate) {
          await updateDoc(chatRef, {
            customerId: jobData.customerId,
            tradesmanId: jobData.tradesmanId,
            participants: [jobData.customerId, jobData.tradesmanId]
          });
        }
      }
    }
  } catch (e) {
    console.error("Repair mission failed:", e);
  }
};

async function getNextReference(type: 'estimate' | 'invoice', tradesmanId: string, tradesmanName: string) {
  const prefix = 'FIX';
  // Use first 3 letters of professional name, removing spaces
  const cleanName = (tradesmanName || 'PRO').replace(/[^a-zA-Z]/g, '').toUpperCase();
  const namePart = cleanName.substring(0, 3).padEnd(3, 'X');
  
  const now = new Date();
  // Format: DDMMYY
  const d = now.getDate().toString().padStart(2, '0');
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const y = now.getFullYear().toString().slice(-2);
  const datePart = `${d}${m}${y}`;
  
  const baseRef = `${prefix}${namePart}${datePart}`;

  try {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const q = query(
      collectionGroup(db, type === 'estimate' ? 'estimates' : 'invoices'),
      where('tradesmanId', '==', tradesmanId),
      where('createdAt', '>=', startOfDay)
    );
    const snap = await getDocs(q);
    const count = snap.size + 1;
    // User requested "increment to number 2", implying if it's the 2nd one, add "2"
    return count > 1 ? `${baseRef}${count}` : baseRef;
  } catch (e) {
    console.warn(`[db] Reference generation query failed (likely missing index):`, e);
    return baseRef;
  }
}

export const createEstimate = async (jobId: string, data: any) => {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) throw new Error('Job not found');
  const jobData = jobSnap.data();

  const estimatesRef = collection(db, 'jobs', jobId, 'estimates');
  const docRef = doc(estimatesRef);
  
  const tradesmanId = data.tradesmanId || jobData.tradesmanId;
  if (!tradesmanId) throw new Error('PROTOCOL FAILURE: Specialist identity missing for mission briefing.');

  // Robust enrichment: Fetch tradesman business name if missing
  let enrichedData = { ...data };
  if (tradesmanId && (!data.tradesmanBusinessName || data.tradesmanBusinessName === 'Pro')) {
    try {
      const proProfile = await getUserProfile(tradesmanId);
      if (proProfile) {
        enrichedData.tradesmanBusinessName = proProfile.businessName || proProfile.companyName || proProfile.fullName || 'FixLink Pro';
        if (!enrichedData.tradesmanName) enrichedData.tradesmanName = proProfile.fullName;
      }
    } catch (e) {
      console.warn("DEBUG [db]: Pro enrichment failed for estimate:", e);
    }
  }

  const reference = await getNextReference('estimate', tradesmanId, enrichedData.tradesmanBusinessName || enrichedData.tradesmanName);

  const estimateData = sanitizeData({
    ...enrichedData,
    id: docRef.id,
    reference,
    jobId,
    customerId: jobData.customerId,
    tradesmanId,
    createdAt: new Date()
  });

  await setDoc(docRef, estimateData);
  return docRef.id;
};

export const updateEstimate = async (jobId: string, estimateId: string, data: any) => {
  const estimateRef = doc(db, 'jobs', jobId, 'estimates', estimateId);
  const estimateData = sanitizeData({
    ...data,
    updatedAt: new Date()
  });
  await updateDoc(estimateRef, estimateData);
};

export const createInvoice = async (jobId: string, data: any) => {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) throw new Error('Job not found');
  const jobData = jobSnap.data();

  const invoicesRef = collection(db, 'jobs', jobId, 'invoices');
  const docRef = doc(invoicesRef);
  
  // Robust enrichment: Fetch tradesman business name if missing
  let enrichedData = { ...data };
  if ((data.tradesmanId || jobData.tradesmanId) && (!data.tradesmanBusinessName || data.tradesmanBusinessName === 'Pro')) {
    try {
      const tid = data.tradesmanId || jobData.tradesmanId;
      const proProfile = await getUserProfile(tid);
      if (proProfile) {
        enrichedData.tradesmanBusinessName = proProfile.businessName || proProfile.companyName || proProfile.fullName || 'FixLink Pro';
      }
    } catch (e) {
      console.warn("DEBUG [db]: Pro enrichment failed for invoice:", e);
    }
  }

  const reference = data.reference || await getNextReference('invoice', data.tradesmanId || jobData.tradesmanId, enrichedData.tradesmanBusinessName);

  const invoiceData = sanitizeData({
    ...enrichedData,
    id: docRef.id,
    reference,
    jobId,
    customerId: data.customerId || jobData.customerId,
    tradesmanId: data.tradesmanId || jobData.tradesmanId,
    createdAt: new Date()
  });

  await setDoc(docRef, invoiceData);
  return docRef.id;
};

export const updateInvoice = async (jobId: string, invoiceId: string, data: any) => {
  const invoiceRef = doc(db, 'jobs', jobId, 'invoices', invoiceId);
  const invoiceData = sanitizeData({
    ...data,
    updatedAt: new Date()
  });
  await updateDoc(invoiceRef, invoiceData);
};

export const markInvoiceAsPaid = async (jobId: string, invoiceId: string) => {
  // 1. Update Invoice Status
  await updateInvoice(jobId, invoiceId, { status: 'paid', isPaid: true });
  
  // 2. Update Job Status
  await markJobAsPaid(jobId);
  
  // 3. Update Job status to completed if it was billed
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (jobSnap.exists() && jobSnap.data().status === 'billed') {
    await updateDoc(jobRef, { status: 'completed' });
  }
};

export const markDepositAsPaid = async (jobId: string, amount: number) => {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) return;
  const jobData = jobSnap.data();
  
  const currentPaid = jobData.amountPaid || 0;
  
  await updateDoc(jobRef, { 
    depositPaid: true,
    amountPaid: currentPaid + amount,
    updatedAt: new Date()
  });
  invalidateCache(`job:${jobId}`);
};
export const getRecentCustomers = async (tradesmanId: string) => {
  const chatsRef = collection(db, 'chats');
  const q = query(chatsRef, where('tradesmanId', '==', tradesmanId), orderBy('lastMessageAt', 'desc'), limit(50));
  const querySnapshot = await getDocs(q);
  
  const customerIds = new Set<string>();
  const customers: { uid: string, name: string }[] = [];
  
  for (const cdoc of querySnapshot.docs) {
    const data = cdoc.data();
    if (data.customerId && !customerIds.has(data.customerId)) {
      customerIds.add(data.customerId);
      customers.push({
        uid: data.customerId,
        name: data.customerName || 'Previous Client'
      });
    }
  }
  
  return customers;
};

export const markJobAsPaid = async (jobId: string, amount?: number) => {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) throw new Error('Mission not found');
  const jobData = jobSnap.data();

  const total = jobData.total || jobData.amount || 0;
  const currentPaid = jobData.amountPaid || 0;
  const newPaid = amount !== undefined ? currentPaid + amount : total;

  const isPaid = newPaid >= (total - 0.01); // Use small epsilon for float comparison
  
  await updateDoc(jobRef, {
    amountPaid: newPaid,
    isPaid,
    paidAt: isPaid ? new Date() : (jobData.paidAt || null),
    updatedAt: new Date()
  });

  // Also update lead if it exists (though billed/invoiced jobs usually aren't in leads)
  try {
    const leadRef = doc(db, 'leads', jobId);
    const leadSnap = await getDoc(leadRef);
    if (leadSnap.exists()) {
      await updateDoc(leadRef, {
        isPaid: newPaid >= total,
        amountPaid: newPaid
      });
    }
  } catch (e) {
    // Silent catch for lead sync
  }
};

// ─── Reviews ─────────────────────────────────────────────────────────────

export interface ProReview {
  jobId: string;
  jobTitle: string;
  customerName: string;
  customerId?: string;
  rating: number;
  review: string;
  completedAt: any;
  reviewRequestSent?: boolean;
}

/** Fetch all completed jobs for a professional that have a customer rating */
export const getProReviews = async (tradesmanId: string): Promise<ProReview[]> => {
  const jobsRef = collection(db, 'jobs');
  // Use the existing tradesmanId+createdAt index; filter status & rating client-side
  // to avoid needing a new composite index.
  const q = query(
    jobsRef,
    where('tradesmanId', '==', tradesmanId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  const snap = await getDocs(q);
  const results: ProReview[] = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.status === 'completed' && typeof data.rating === 'number') {
      results.push({
        jobId: d.id,
        jobTitle: data.title || 'Untitled Job',
        customerName: data.customerName || 'Client',
        customerId: data.customerId,
        rating: data.rating,
        review: data.review || '',
        completedAt: data.completedAt,
        reviewRequestSent: data.reviewRequestSent || false,
      });
    }
  });
  // Sort by completedAt descending (client-side)
  results.sort((a, b) => {
    const aDate = a.completedAt?.toDate?.() ?? new Date(a.completedAt ?? 0);
    const bDate = b.completedAt?.toDate?.() ?? new Date(b.completedAt ?? 0);
    return bDate.getTime() - aDate.getTime();
  });
  return results;
};

/** Fetch completed jobs WITHOUT a customer rating — these are candidates for a review request */
export const getUnreviewedJobs = async (tradesmanId: string): Promise<Job[]> => {
  const jobsRef = collection(db, 'jobs');
  // Use the existing tradesmanId+createdAt index; filter status & rating client-side.
  const q = query(
    jobsRef,
    where('tradesmanId', '==', tradesmanId),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  const snap = await getDocs(q);
  const results: Job[] = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.status === 'completed' && typeof data.rating !== 'number') {
      results.push({ ...data as Job, id: d.id });
    }
  });
  return results.slice(0, 30);
};

/** Send a review request notification to the customer for a specific job */
export const sendReviewRequest = async (
  jobId: string,
  proName: string
): Promise<void> => {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) throw new Error('Job not found');
  const jobData = jobSnap.data();

  if (!jobData.customerId) throw new Error('No customer linked to this job');

  // Create notification for the customer
  await setDoc(doc(collection(db, 'notifications')), sanitizeData({
    userId: jobData.customerId,
    type: 'review_request',
    title: '⭐ How did we do?',
    message: `${proName} is asking for your feedback on "${jobData.title || 'your recent job'}". A quick review helps them grow!`,
    jobId,
    actionUrl: `/jobs/view?id=${jobId}`,
    createdAt: new Date(),
    read: false,
  }));

  // Mark the job so we don't spam the customer
  await updateDoc(jobRef, { reviewRequestSent: true });
};

