import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  onSnapshot,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  UserProfile, 
  ChatRoom, 
  ChatMessage, 
  MessageReplyInfo, 
  Friendship, 
  UserBlock, 
  FriendshipStatus 
} from '../types';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// CRITICAL: Initialize Firestore with firestoreDatabaseId as required by AI Studio skill
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error Handling mandated by Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initial connection test as per skill instructions
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or waiting for internet connection.');
    }
  }
}

// User Presence & Profile helpers
export async function syncUserProfile(user: User, customDisplayName?: string, customPhotoURL?: string): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const now = serverTimestamp();
  
  let existingProfile: UserProfile | null = null;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      existingProfile = snap.data() as UserProfile;
    }
  } catch (error) {
    const isPermission = error instanceof Error && (error.message.includes('permission') || error.message.includes('Missing or insufficient permissions'));
    if (isPermission) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    } else {
      console.warn('Could not fetch existing profile from server (using fallback/offline state):', error);
    }
  }

  const profileData: UserProfile = {
    uid: user.uid,
    displayName: customDisplayName || existingProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'User',
    email: (user.email || '').toLowerCase().trim(),
    photoURL: customPhotoURL || existingProfile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
    status: 'online',
    lastSeen: now,
    createdAt: existingProfile?.createdAt || now,
    bio: existingProfile?.bio || 'Hey there! I am using subachat.'
  };

  try {
    await setDoc(userRef, profileData, { merge: true });
  } catch (error) {
    const isPermission = error instanceof Error && (error.message.includes('permission') || error.message.includes('Missing or insufficient permissions'));
    if (isPermission) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } else {
      console.warn('Could not write user profile to server (client may be offline, will sync once online):', error);
    }
  }

  return profileData;
}

export async function setUserStatus(uid: string, status: 'online' | 'offline') {
  if (!uid) return;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      status,
      lastSeen: serverTimestamp()
    });
  } catch (e) {
    // Suppress unmount/page unload errors cleanly
    console.debug('Presence update error:', e);
  }
}

// Compress and resize uploaded image client-side for clean web storage
export function compressAndResizeImage(file: File, maxDim = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Please select a valid image file.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to process image.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context.'));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Update user profile and propagate to Firebase Auth & Firestore
export async function updateUserProfile(
  uid: string, 
  updates: { displayName?: string; photoURL?: string; bio?: string }
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      ...updates,
      status: 'online',
      lastSeen: serverTimestamp()
    });

    if (auth.currentUser && auth.currentUser.uid === uid) {
      await updateProfile(auth.currentUser, {
        displayName: updates.displayName || auth.currentUser.displayName,
        photoURL: updates.photoURL || auth.currentUser.photoURL
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

// Toggle Romantic Love Mode on a chat room
export async function toggleLoveMode(chatId: string, loveMode: boolean): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      loveMode,
      ...(loveMode ? { humorMode: false, midnightMode: false } : {})
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
  }
}

// Toggle Joyful Humor Mode on a chat room
export async function toggleHumorMode(chatId: string, humorMode: boolean): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      humorMode,
      ...(humorMode ? { loveMode: false, midnightMode: false } : {})
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
  }
}

// Toggle Sultry Burgundy & Purple Midnight Mode on a chat room
export async function toggleMidnightMode(chatId: string, midnightMode: boolean): Promise<void> {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      midnightMode,
      ...(midnightMode ? { loveMode: false, humorMode: false } : {})
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
  }
}

// Search users by email or display name
export async function searchUsers(searchTerm: string, currentUserId: string): Promise<UserProfile[]> {
  const cleanTerm = searchTerm.toLowerCase().trim();
  if (!cleanTerm) return [];

  const results: UserProfile[] = [];
  try {
    // 1. Direct query by exact email
    const emailQuery = query(
      collection(db, 'users'),
      where('email', '==', cleanTerm),
      limit(5)
    );
    const emailSnap = await getDocs(emailQuery);
    emailSnap.forEach(d => {
      const data = d.data() as UserProfile;
      if (data.uid !== currentUserId) {
        results.push(data);
      }
    });

    // 2. Also search all recent users if term didn't yield exact match
    if (results.length === 0) {
      const allUsersQuery = query(collection(db, 'users'), limit(30));
      const allSnap = await getDocs(allUsersQuery);
      allSnap.forEach(d => {
        const data = d.data() as UserProfile;
        if (data.uid !== currentUserId) {
          if (
            data.email.toLowerCase().includes(cleanTerm) ||
            data.displayName.toLowerCase().includes(cleanTerm)
          ) {
            results.push(data);
          }
        }
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }

  return results;
}

// --- Friendship & Block Management ---

export function getFriendshipId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export function getBlockId(blockerId: string, blockedId: string): string {
  return `${blockerId}_${blockedId}`;
}

// Check block status between two users
export async function checkBlockStatus(
  currentUserId: string, 
  targetUserId: string
): Promise<{ isBlockedByMe: boolean; hasBlockedMe: boolean }> {
  try {
    const myBlockSnap = await getDoc(doc(db, 'blocks', getBlockId(currentUserId, targetUserId)));
    const theirBlockSnap = await getDoc(doc(db, 'blocks', getBlockId(targetUserId, currentUserId)));
    return {
      isBlockedByMe: myBlockSnap.exists(),
      hasBlockedMe: theirBlockSnap.exists()
    };
  } catch {
    return { isBlockedByMe: false, hasBlockedMe: false };
  }
}

// Get single friendship record
export async function getFriendship(uid1: string, uid2: string): Promise<Friendship | null> {
  const fId = getFriendshipId(uid1, uid2);
  try {
    const snap = await getDoc(doc(db, 'friendships', fId));
    if (snap.exists()) {
      return snap.data() as Friendship;
    }
  } catch (error) {
    console.debug('getFriendship check notice:', error);
  }
  return null;
}

// Send Friend Request
export async function sendFriendRequest(
  requesterUid: string, 
  targetUid: string
): Promise<void> {
  if (requesterUid === targetUid) return;
  const fId = getFriendshipId(requesterUid, targetUid);

  const blockCheck = await checkBlockStatus(requesterUid, targetUid);
  if (blockCheck.isBlockedByMe || blockCheck.hasBlockedMe) {
    throw new Error('Cannot send friend request: communication is blocked.');
  }

  const fRef = doc(db, 'friendships', fId);
  try {
    const snap = await getDoc(fRef);
    if (snap.exists()) {
      const data = snap.data() as Friendship;
      if (data.status === 'accepted') {
        return; // already friends
      }
      if (data.requesterId === requesterUid && data.status === 'pending') {
        return; // already sent pending request by me
      }
      // If other user sent us a request earlier, accept it directly!
      if (data.requesterId === targetUid && data.status === 'pending') {
        await updateDoc(fRef, {
          status: 'accepted',
          updatedAt: serverTimestamp()
        });
        return;
      }
    }

    await setDoc(fRef, {
      id: fId,
      users: [requesterUid, targetUid].sort(),
      requesterId: requesterUid,
      addresseeId: targetUid,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `friendships/${fId}`);
  }
}

// Accept incoming friend request
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const fRef = doc(db, 'friendships', friendshipId);
  try {
    await updateDoc(fRef, {
      status: 'accepted',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `friendships/${friendshipId}`);
  }
}

// Decline incoming friend request
export async function declineFriendRequest(friendshipId: string): Promise<void> {
  const fRef = doc(db, 'friendships', friendshipId);
  try {
    await deleteDoc(fRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `friendships/${friendshipId}`);
  }
}

// Cancel outgoing friend request
export async function cancelFriendRequest(friendshipId: string): Promise<void> {
  const fRef = doc(db, 'friendships', friendshipId);
  try {
    await deleteDoc(fRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `friendships/${friendshipId}`);
  }
}

// Remove friend
export async function removeFriend(uid1: string, uid2: string): Promise<void> {
  const fId = getFriendshipId(uid1, uid2);
  const fRef = doc(db, 'friendships', fId);
  try {
    await deleteDoc(fRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `friendships/${fId}`);
  }
}

// Block a contact
export async function blockUser(currentUserId: string, targetUserId: string): Promise<void> {
  const blockId = getBlockId(currentUserId, targetUserId);
  const blockRef = doc(db, 'blocks', blockId);
  try {
    await setDoc(blockRef, {
      id: blockId,
      blockerId: currentUserId,
      blockedId: targetUserId,
      createdAt: serverTimestamp()
    });

    // Also remove friendship if exists
    const fId = getFriendshipId(currentUserId, targetUserId);
    const fRef = doc(db, 'friendships', fId);
    try {
      const snap = await getDoc(fRef);
      if (snap.exists()) {
        await deleteDoc(fRef);
      }
    } catch {}
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `blocks/${blockId}`);
  }
}

// Unblock a contact
export async function unblockUser(currentUserId: string, targetUserId: string): Promise<void> {
  const blockId = getBlockId(currentUserId, targetUserId);
  const blockRef = doc(db, 'blocks', blockId);
  try {
    await deleteDoc(blockRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `blocks/${blockId}`);
  }
}

// Get or Create 1-on-1 Chat Room (Strictly requires mutual accepted friends and not blocked)
export async function getOrCreateChatRoom(
  currentUser: UserProfile, 
  targetUser: UserProfile
): Promise<string> {
  // 1. Verify not blocked
  const blockCheck = await checkBlockStatus(currentUser.uid, targetUser.uid);
  if (blockCheck.isBlockedByMe) {
    throw new Error('You have blocked this contact. Unblock them first to chat.');
  }
  if (blockCheck.hasBlockedMe) {
    throw new Error('You cannot chat with this user.');
  }

  // 2. Verify mutual accepted friends
  const friendship = await getFriendship(currentUser.uid, targetUser.uid);
  if (!friendship || friendship.status !== 'accepted') {
    throw new Error('You must be mutual friends to chat. Send a friend request first!');
  }

  // 3. Check if a conversation between these two users already exists
  const chatsRef = collection(db, 'chats');
  
  try {
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUser.uid)
    );
    const snap = await getDocs(q);
    
    for (const d of snap.docs) {
      const chat = d.data() as ChatRoom;
      if (chat.participants.includes(targetUser.uid)) {
        return d.id;
      }
    }

    // Create a new chat room
    const newChatRef = await addDoc(chatsRef, {
      participants: [currentUser.uid, targetUser.uid],
      participantDetails: {
        [currentUser.uid]: {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL || ''
        },
        [targetUser.uid]: {
          uid: targetUser.uid,
          displayName: targetUser.displayName,
          email: targetUser.email,
          photoURL: targetUser.photoURL || ''
        }
      },
      lastMessage: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      typing: {
        [currentUser.uid]: false,
        [targetUser.uid]: false
      }
    });

    return newChatRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'chats');
    return '';
  }
}

// Delete an entire conversation including all messages and the chat room document
export async function deleteConversation(chatId: string): Promise<void> {
  try {
    // 1. Fetch and delete all messages in subcollection
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesSnap = await getDocs(messagesRef);
    const deletePromises = messagesSnap.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);

    // 2. Delete the parent chat room document
    const chatDocRef = doc(db, 'chats', chatId);
    await deleteDoc(chatDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}`);
  }
}

// Send a Message (Strictly requires mutual accepted friends and not blocked)
export async function sendChatMessage(
  chatId: string, 
  senderId: string, 
  receiverId: string, 
  text: string,
  replyTo?: MessageReplyInfo,
  audioData?: { audioUrl: string; audioDuration: number }
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed && !audioData) return;

  // Check blocked status
  const blockCheck = await checkBlockStatus(senderId, receiverId);
  if (blockCheck.isBlockedByMe) {
    throw new Error('You have blocked this contact. Unblock them first to send messages.');
  }
  if (blockCheck.hasBlockedMe) {
    throw new Error('You cannot message this user.');
  }

  // Check friendship status
  const friendship = await getFriendship(senderId, receiverId);
  if (!friendship || friendship.status !== 'accepted') {
    throw new Error('You can only message mutual friends.');
  }

  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const chatDocRef = doc(db, 'chats', chatId);

  try {
    const now = serverTimestamp();
    const finalMessageText = trimmed || (audioData ? `🎤 Voice message (${Math.round(audioData.audioDuration)}s)` : '');

    // 1. Add message document
    await addDoc(messagesRef, {
      chatId,
      senderId,
      receiverId,
      text: finalMessageText,
      timestamp: now,
      read: false,
      ...(replyTo ? { replyTo } : {}),
      ...(audioData ? { audioUrl: audioData.audioUrl, audioDuration: audioData.audioDuration } : {})
    });

    // 2. Update parent chat document with lastMessage & updatedAt
    await updateDoc(chatDocRef, {
      lastMessage: {
        text: finalMessageText,
        senderId,
        timestamp: now,
        read: false
      },
      updatedAt: now,
      [`typing.${senderId}`]: false
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages`);
  }
}

// Mark messages as read
export async function markChatAsRead(chatId: string, currentUserId: string, otherUserId: string) {
  try {
    const chatDocRef = doc(db, 'chats', chatId);
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    
    // Check unread messages where current user is receiver
    const q = query(
      messagesRef, 
      where('senderId', '==', otherUserId), 
      where('read', '==', false)
    );
    const unreadSnap = await getDocs(q);
    
    const updatePromises = unreadSnap.docs.map(docSnap => 
      updateDoc(docSnap.ref, { read: true })
    );
    await Promise.all(updatePromises);

    // Update lastMessage read status if needed
    const chatSnap = await getDoc(chatDocRef);
    if (chatSnap.exists()) {
      const data = chatSnap.data() as ChatRoom;
      if (data.lastMessage && data.lastMessage.senderId === otherUserId && !data.lastMessage.read) {
        await updateDoc(chatDocRef, {
          'lastMessage.read': true
        });
      }
    }
  } catch (e) {
    console.debug('markChatAsRead status error:', e);
  }
}

// Update Typing status
export async function updateTypingStatus(chatId: string, userId: string, isTyping: boolean) {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`typing.${userId}`]: isTyping
    });
  } catch (e) {
    // Non-blocking
  }
}

// Toggle Message Reaction
export async function toggleMessageReaction(
  chatId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  const messageDocRef = doc(db, 'chats', chatId, 'messages', messageId);
  try {
    const snap = await getDoc(messageDocRef);
    if (!snap.exists()) return;
    const data = snap.data() as ChatMessage;
    const currentReactions = data.reactions || {};

    const updatedReactions = { ...currentReactions };
    if (updatedReactions[userId] === emoji) {
      delete updatedReactions[userId];
    } else {
      updatedReactions[userId] = emoji;
    }

    await updateDoc(messageDocRef, {
      reactions: updatedReactions
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
  }
}

// Edit a previously sent message
export async function editChatMessage(
  chatId: string,
  messageId: string,
  newText: string
): Promise<void> {
  const trimmed = newText.trim();
  if (!trimmed) throw new Error('Message text cannot be empty.');

  const messageDocRef = doc(db, 'chats', chatId, 'messages', messageId);
  const chatDocRef = doc(db, 'chats', chatId);

  try {
    const snap = await getDoc(messageDocRef);
    if (!snap.exists()) return;
    const msgData = snap.data() as ChatMessage;

    // 1. Update message doc
    await updateDoc(messageDocRef, {
      text: trimmed,
      isEdited: true,
      editedAt: serverTimestamp()
    });

    // 2. Check if parent chat lastMessage was this message and update it
    const chatSnap = await getDoc(chatDocRef);
    if (chatSnap.exists()) {
      const chatData = chatSnap.data() as ChatRoom;
      if (
        chatData.lastMessage && 
        chatData.lastMessage.senderId === msgData.senderId && 
        chatData.lastMessage.text === msgData.text
      ) {
        await updateDoc(chatDocRef, {
          'lastMessage.text': trimmed,
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
  }
}

// Unsend (delete) a previously sent message
export async function unsendChatMessage(
  chatId: string,
  messageId: string
): Promise<void> {
  const messageDocRef = doc(db, 'chats', chatId, 'messages', messageId);
  const chatDocRef = doc(db, 'chats', chatId);

  try {
    const snap = await getDoc(messageDocRef);
    if (!snap.exists()) return;
    const deletedMsgData = snap.data() as ChatMessage;

    // 1. Delete message doc
    await deleteDoc(messageDocRef);

    // 2. Refresh lastMessage on chat room if deleted was the last message
    const chatSnap = await getDoc(chatDocRef);
    if (chatSnap.exists()) {
      const chatData = chatSnap.data() as ChatRoom;
      if (
        chatData.lastMessage && 
        chatData.lastMessage.senderId === deletedMsgData.senderId && 
        chatData.lastMessage.text === deletedMsgData.text
      ) {
        // Query latest remaining message
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
        const remainingSnap = await getDocs(q);

        if (!remainingSnap.empty) {
          const latestDoc = remainingSnap.docs[0].data() as ChatMessage;
          await updateDoc(chatDocRef, {
            lastMessage: {
              text: latestDoc.text,
              senderId: latestDoc.senderId,
              timestamp: latestDoc.timestamp || serverTimestamp(),
              read: latestDoc.read || false
            },
            updatedAt: serverTimestamp()
          });
        } else {
          await updateDoc(chatDocRef, {
            lastMessage: null,
            updatedAt: serverTimestamp()
          });
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}/messages/${messageId}`);
  }
}

// Reusable AudioContext singleton to avoid repeated thread creation
let sharedAudioCtx: AudioContext | null = null;

// Subtle Audio Notification using Web Audio API
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    const ctx = sharedAudioCtx;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5
    
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    // Audio context may be blocked by browser policy until interaction
  }
}
