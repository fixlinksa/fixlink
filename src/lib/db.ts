import { db } from './firebase';
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

export type UserRole = 'customer' | 'tradesman' | 'admin';

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
  status: 'pending' | 'quoted' | 'estimated' | 'declined' | 'assigned' | 'accepted' | 'in-progress' | 'billed' | 'invoiced' | 'completed' | 'cancelled' | 'drafting';
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
  createdAt: any;
  expireAt?: any;
  estimatedAt?: any;
  billedAt?: any;
  completedAt?: any;
  rating?: number;
  review?: string;
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
  preTrialTier?: TierId;
  createdAt: any;
  status?: 'active' | 'suspended' | 'pending';
  phone?: string;
  distance?: number;
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
  const cacheKey = `pros:${trade}:${userLat}:${userLng}:70`;
  const cached = getCached<UserProfile[]>(cacheKey);
  if (cached) return cached;

  // Utilize the global tradesman cache to bypass Firestore indexing issues
  // and ensure instant search availability.
  const allPros = await getUsersByRole('tradesman');
  
  const results: UserProfile[] = [];
  const STRICT_RADIUS = 70;

  allPros.forEach((data) => {
    // Final Availability Verification
    if (data.isAvailable === false) return;

    // Check new 'trades' array OR legacy 'trade' string
    const match = (trade === 'General Services') || 
                  (data.trades && data.trades.includes(trade)) || 
                  (data.trade && data.trade.includes(trade)) ||
                  lenientTradeMatch(data.trades || data.trade, trade);

    if (!match) return;

    let distance = 999;
    if (userLat && userLng && data.location) {
      const coords = extractCoordinates(data.location);
      if (coords) {
        distance = getDistance(userLat, userLng, coords.lat, coords.lng);
        if (distance <= STRICT_RADIUS) {
          results.push({ ...data, distance });
        }
      }
    } else {
      // If no center search point, add them all for the universal view
      results.push({ ...data, distance: 0 });
    }
  });

  // Sort by proximity
  const sorted = results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  
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
      console.error(`Firestore Permission Denied for job ${jobId}. Ensure security rules allow access.`, error);
    } else {
      console.error(`Error fetching job ${jobId}:`, error);
    }
    throw error;
  }
};

export const updateJob = async (jobId: string, data: any) => {
  const jobRef = doc(db, 'jobs', jobId);
  await updateDoc(jobRef, sanitizeData(data));
  
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
             id: jobId
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
    const q = query(chatsRef, where('jobId', '==', jobId));
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
    status: 'pending',
    tradesmanId: null
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
  radiusKm?: number 
}) => {
  const { category, proLat, proLng, radiusKm } = params;
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
  
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    let include = true;
    
    // Distance Filtering (In-Memory)
    if (proLat && proLng && data.location && radiusKm) {
      const distance = getDistance(proLat, proLng, data.location.lat, data.location.lng);
      if (distance > radiusKm) {
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

export const getInvoicesByJob = async (jobId: string) => {
  const invoicesRef = collection(db, 'jobs', jobId, 'invoices');
  const q = query(invoicesRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
};

export const getEstimatesByJob = async (jobId: string) => {
  const estimatesRef = collection(db, 'jobs', jobId, 'estimates');
  const q = query(estimatesRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
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
export const createEstimate = async (jobId: string, data: any) => {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) throw new Error('Job not found');
  const jobData = jobSnap.data();

  const estimatesRef = collection(db, 'jobs', jobId, 'estimates');
  const docRef = doc(estimatesRef);
  
  const estimateData = sanitizeData({
    ...data,
    id: docRef.id,
    jobId,
    customerId: jobData.customerId,
    tradesmanId: jobData.tradesmanId,
    createdAt: new Date()
  });

  await setDoc(docRef, estimateData);
  return docRef.id;
};

export const createInvoice = async (jobId: string, data: any) => {
  const jobRef = doc(db, 'jobs', jobId);
  const jobSnap = await getDoc(jobRef);
  if (!jobSnap.exists()) throw new Error('Job not found');
  const jobData = jobSnap.data();

  const invoicesRef = collection(db, 'jobs', jobId, 'invoices');
  const docRef = doc(invoicesRef);
  
  const invoiceData = sanitizeData({
    ...data,
    id: docRef.id,
    jobId,
    customerId: jobData.customerId,
    tradesmanId: jobData.tradesmanId,
    createdAt: new Date()
  });

  await setDoc(docRef, invoiceData);
  return docRef.id;
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
