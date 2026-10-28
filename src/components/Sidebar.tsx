import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Search, 
  MessageSquarePlus, 
  LogOut, 
  User, 
  CircleDot, 
  CheckCheck, 
  Check, 
  Users,
  Mail,
  Camera,
  Heart,
  UserPlus,
  UserCheck,
  UserX,
  Shield,
  Ban,
  Clock,
  MessageCircle,
  MoreVertical,
  X,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { UserProfile, ChatRoom, Friendship, UserBlock } from '../types';
import { 
  db, 
  handleFirestoreError, 
  OperationType,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getOrCreateChatRoom,
  deleteConversation
} from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { ThemeToggle } from './ThemeToggle';

interface SidebarProps {
  currentUser: UserProfile;
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onOpenNewChatModal: () => void;
  onOpenGmail: () => void;
  onOpenEditProfile: () => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeChatId,
  onSelectChat,
  onOpenNewChatModal,
  onOpenGmail,
  onOpenEditProfile,
  onLogout,
  isDark,
  onToggleTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>('chats');
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [partnerProfiles, setPartnerProfiles] = useState<Record<string, UserProfile>>({});
  
  // Friendship & Block states
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<UserBlock[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, UserProfile>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);

  // Active user profile listeners ref to avoid duplicate subscriptions
  const userListenersRef = useRef<Map<string, () => void>>(new Map());

  // Subscribe to user doc if not already subscribed
  const subscribeToUser = useCallback((uid: string) => {
    if (!uid || userListenersRef.current.has(uid)) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (docSnap) => {
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        setPartnerProfiles((prev) => ({
          ...prev,
          [uid]: profile,
        }));
        setFriendProfiles((prev) => ({
          ...prev,
          [uid]: profile,
        }));
      }
    });
    userListenersRef.current.set(uid, unsub);
  }, []);

  // Clean up user listeners on unmount
  useEffect(() => {
    const listeners = userListenersRef.current;
    return () => {
      listeners.forEach((unsub) => unsub());
      listeners.clear();
    };
  }, []);

  // 1. Real-time listener for user's conversations
  useEffect(() => {
    if (!currentUser?.uid) return;

    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chatList: ChatRoom[] = [];
        snapshot.forEach((d) => {
          chatList.push({ id: d.id, ...d.data() } as ChatRoom);
        });

        // Sort chats by updatedAt or createdAt desc
        chatList.sort((a, b) => {
          const timeA = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
          const timeB = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });

        setChats(chatList);

        // Fetch live partner profiles for updated presence/online status without duplicate listeners
        chatList.forEach((chat) => {
          const otherId = chat.participants.find((p) => p !== currentUser.uid);
          if (otherId) subscribeToUser(otherId);
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, subscribeToUser]);

  // 2. Real-time listener for Friendships & Friend Requests
  useEffect(() => {
    if (!currentUser?.uid) return;

    const friendshipsRef = collection(db, 'friendships');
    const q = query(
      friendshipsRef,
      where('users', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Friendship[] = [];
        snapshot.forEach((d) => {
          const f = { id: d.id, ...d.data() } as Friendship;
          list.push(f);
          const otherId = f.users.find((u) => u !== currentUser.uid);
          if (otherId) subscribeToUser(otherId);
        });

        setFriendships(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'friendships');
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, subscribeToUser]);

  // 3. Real-time listener for blocked users
  useEffect(() => {
    if (!currentUser?.uid) return;

    const blocksRef = collection(db, 'blocks');
    const q = query(
      blocksRef,
      where('blockerId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: UserBlock[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as UserBlock);
        });
        setBlockedUsers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'blocks');
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const blockedUserIds = useMemo(
    () => new Set(blockedUsers.map((b) => b.blockedId)),
    [blockedUsers]
  );

  // Partition friendships with useMemo
  const incomingRequests = useMemo(
    () => friendships.filter((f) => f.status === 'pending' && f.addresseeId === currentUser.uid),
    [friendships, currentUser.uid]
  );

  const outgoingRequests = useMemo(
    () => friendships.filter((f) => f.status === 'pending' && f.requesterId === currentUser.uid),
    [friendships, currentUser.uid]
  );

  const mutualFriends = useMemo(
    () => friendships.filter((f) => f.status === 'accepted'),
    [friendships]
  );

  // Format timestamp helper
  const formatTime = useCallback((ts: any) => {
    if (!ts) return '';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;

      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }, []);

  const filteredChats = useMemo(() => {
    const qLower = filterQuery.toLowerCase();
    return chats.filter((chat) => {
      const partnerId = chat.participants.find((p) => p !== currentUser.uid) || '';
      const partnerDetail = chat.participantDetails?.[partnerId];
      const liveProfile = partnerProfiles[partnerId];
      const name = liveProfile?.displayName || partnerDetail?.displayName || '';

      return (
        name.toLowerCase().includes(qLower) ||
        (chat.lastMessage?.text || '').toLowerCase().includes(qLower)
      );
    });
  }, [chats, filterQuery, partnerProfiles, currentUser.uid]);

  const handleStartFriendChat = async (targetUser: UserProfile) => {
    setActionLoadingId(targetUser.uid);
    try {
      const chatId = await getOrCreateChatRoom(currentUser, targetUser);
      if (chatId) {
        onSelectChat(chatId);
      }
    } catch (err: any) {
      alert(err?.message || 'Could not start chat.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDeleteChat = async () => {
    if (!chatToDelete || deletingChat) return;
    setDeletingChat(true);
    try {
      const idToDelete = chatToDelete.id;
      await deleteConversation(idToDelete);
      if (activeChatId === idToDelete) {
        onSelectChat('');
      }
      setChatToDelete(null);
    } catch (err) {
      console.error('Failed to delete chat:', err);
      alert('Failed to delete conversation.');
    } finally {
      setDeletingChat(false);
    }
  };

  return (
    <aside className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors select-none">
      
      {/* Top Header / Current User Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          
          {/* User Info with Edit Profile Click */}
          <button
            onClick={onOpenEditProfile}
            type="button"
            title="Click to edit profile or change photo"
            className="flex items-center gap-3 min-w-0 text-left hover:opacity-85 transition-opacity cursor-pointer group"
          >
            <div className="relative shrink-0">
              <img
                src={currentUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.uid}`}
                alt={currentUser.displayName}
                className="w-10 h-10 rounded-2xl object-cover bg-slate-200 dark:bg-slate-800 border-2 border-indigo-500/30 group-hover:border-indigo-500 transition-colors"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
                title="Online"
              />
              <span className="absolute inset-0 rounded-2xl bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] transition-opacity">
                <Camera className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {currentUser.displayName}
                </h2>
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold tracking-wide">
                subachat
              </p>
            </div>
          </button>

          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenGmail}
              title="Open Gmail Assistant"
              className="p-2 rounded-xl text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer relative"
            >
              <Mail className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
            </button>
            <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
            <button
              onClick={onLogout}
              title="Log Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Chats vs Friends */}
        <div className="mt-3 grid grid-cols-2 p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs font-bold">
          <button
            onClick={() => setActiveTab('chats')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'chats'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Chats</span>
          </button>

          <button
            onClick={() => setActiveTab('friends')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
              activeTab === 'friends'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Friends</span>
            {incomingRequests.length > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-extrabold animate-pulse">
                {incomingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar / Action button */}
        {activeTab === 'chats' ? (
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all"
              />
            </div>
            <button
              onClick={onOpenNewChatModal}
              title="Add friend or start chat"
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <button
              onClick={onOpenNewChatModal}
              className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-indigo-600/20 flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Find &amp; Add New Friends</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      {activeTab === 'chats' ? (
        /* Conversations List */
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
          {filteredChats.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                No conversations yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px]">
                Add friends first to start a chat! Strangers cannot message without mutual friendship.
              </p>
              <button
                onClick={onOpenNewChatModal}
                className="mt-4 px-3.5 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition-colors cursor-pointer"
              >
                Find &amp; Add Friends
              </button>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const partnerId = chat.participants.find((p) => p !== currentUser.uid) || '';
              const partnerDetail = chat.participantDetails?.[partnerId];
              const liveProfile = partnerProfiles[partnerId];

              const name = liveProfile?.displayName || partnerDetail?.displayName || 'subachat Friend';
              const photo = liveProfile?.photoURL || partnerDetail?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`;
              const isOnline = liveProfile?.status === 'online';
              const isTyping = chat.typing?.[partnerId] === true;
              const isBlocked = blockedUserIds.has(partnerId);

              const isSelected = chat.id === activeChatId;
              const lastMsg = chat.lastMessage;
              const isLastMsgFromMe = lastMsg?.senderId === currentUser.uid;
              const isUnread = lastMsg && !isLastMsgFromMe && !lastMsg.read;

              return (
                <div
                  key={chat.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectChat(chat.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectChat(chat.id);
                    }
                  }}
                  className={`group w-full text-left p-3.5 flex items-center gap-3 transition-colors cursor-pointer relative select-none ${
                    isSelected
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-l-4 border-indigo-600 dark:border-indigo-500'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {/* Avatar with Status badge */}
                  <div className="relative shrink-0">
                    <img
                      src={photo}
                      alt={name}
                      className="w-12 h-12 rounded-2xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 transition-colors ${
                        isOnline ? 'bg-emerald-500 ring-2 ring-emerald-400/20' : 'bg-slate-400'
                      }`}
                      title={isOnline ? 'Online' : 'Offline'}
                    />
                  </div>

                  {/* Conversation Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-sm font-bold truncate flex items-center gap-1.5 ${
                        isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-900 dark:text-white'
                      }`}>
                        <span className="truncate">{name}</span>
                        {isBlocked && (
                          <span className="px-1.5 py-0.2 bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded-md">
                            Blocked
                          </span>
                        )}
                        {chat.loveMode && (
                          <span title="Love Mode Active" className="shrink-0 text-xs animate-bounce [animation-duration:2s]">
                            💖
                          </span>
                        )}
                        {chat.humorMode && (
                          <span title="Humor Mode Active" className="shrink-0 text-xs animate-bounce [animation-duration:2s]">
                            😂
                          </span>
                        )}
                        {chat.midnightMode && (
                          <span title="Midnight Mode Active" className="shrink-0 text-xs animate-pulse [animation-duration:2s]">
                            🌚
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatTime(lastMsg?.timestamp || chat.updatedAt)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatToDelete({ id: chat.id, name });
                          }}
                          title="Delete conversation"
                          className="opacity-0 group-hover:opacity-100 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer text-slate-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${
                        isUnread 
                          ? 'font-bold text-slate-900 dark:text-white' 
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {isBlocked ? (
                          <span className="text-rose-500 font-medium">Contact is blocked</span>
                        ) : isTyping ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                            typing...
                          </span>
                        ) : lastMsg ? (
                          <span>
                            {isLastMsgFromMe ? (
                              <span className="text-slate-400 font-normal">You: </span>
                            ) : null}
                            {lastMsg.text}
                          </span>
                        ) : (
                          <span className="italic text-slate-400">Say hello to start chatting 👋</span>
                        )}
                      </p>

                      {/* Unread indicator */}
                      {isUnread ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0 animate-pulse" />
                      ) : isLastMsgFromMe ? (
                        <span className="shrink-0 text-slate-400">
                          {lastMsg?.read ? (
                            <CheckCheck className="w-3.5 h-3.5 text-indigo-500" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Friends & Requests Tab */
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          
          {/* Incoming Requests Section */}
          {incomingRequests.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  Friend Requests ({incomingRequests.length})
                </span>
              </div>

              <div className="space-y-1.5">
                {incomingRequests.map((req) => {
                  const requester = friendProfiles[req.requesterId];
                  const name = requester?.displayName || 'User';
                  const photo = requester?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.requesterId}`;

                  return (
                    <div
                      key={req.id}
                      className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={photo}
                          alt={name}
                          className="w-10 h-10 rounded-xl object-cover bg-slate-200 shrink-0 border border-rose-300 dark:border-rose-800"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {name}
                          </h4>
                          <p className="text-[10px] text-rose-600 dark:text-rose-300">
                            Sent you a friend request
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => acceptFriendRequest(req.id)}
                          title="Accept friend request"
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => declineFriendRequest(req.id)}
                          title="Decline friend request"
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mutual Friends Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                My Friends ({mutualFriends.length})
              </span>
            </div>

            {mutualFriends.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                <Users className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No friends yet
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Send friend requests to connect and unlock chatting!
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {mutualFriends.map((f) => {
                  const partnerId = f.users.find((u) => u !== currentUser.uid) || '';
                  const friend = friendProfiles[partnerId];
                  const name = friend?.displayName || 'subachat Friend';
                  const photo = friend?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`;
                  const isOnline = friend?.status === 'online';
                  const isBlocked = blockedUserIds.has(partnerId);

                  return (
                    <div
                      key={f.id}
                      className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={photo}
                            alt={name}
                            className="w-10 h-10 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                          />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {name}
                            </span>
                            {isBlocked && (
                              <span className="text-[9px] px-1 bg-rose-100 text-rose-600 rounded">
                                Blocked
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!isBlocked && friend && (
                          <button
                            onClick={() => handleStartFriendChat(friend)}
                            disabled={actionLoadingId === partnerId}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                        )}

                        {isBlocked ? (
                          <button
                            onClick={() => unblockUser(currentUser.uid, partnerId)}
                            className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-emerald-100 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                            title="Unblock contact"
                          >
                            Unblock
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`Block ${name}? You will no longer be able to message each other.`)) {
                                blockUser(currentUser.uid, partnerId);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Block contact"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (confirm(`Remove ${name} from your friends?`)) {
                              removeFriend(currentUser.uid, partnerId);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Remove Friend"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Outgoing Requests Section */}
          {outgoingRequests.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Sent Requests ({outgoingRequests.length})
                </span>
              </div>

              <div className="space-y-1.5">
                {outgoingRequests.map((req) => {
                  const target = friendProfiles[req.addresseeId];
                  const name = target?.displayName || 'User';
                  const photo = target?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.addresseeId}`;

                  return (
                    <div
                      key={req.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={photo}
                          alt={name}
                          className="w-8 h-8 rounded-xl object-cover bg-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {name}
                          </h4>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3" />
                            Awaiting response
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => cancelFriendRequest(req.id)}
                        className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Blocked Users Section */}
          {blockedUsers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                Blocked Contacts ({blockedUsers.length})
              </span>
              <div className="space-y-1">
                {blockedUsers.map((b) => (
                  <div
                    key={b.id}
                    className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"
                  >
                    <span className="flex items-center gap-1.5 font-medium truncate">
                      <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="truncate">{friendProfiles[b.blockedId]?.displayName || 'Blocked Contact'}</span>
                    </span>
                    <button
                      onClick={() => unblockUser(currentUser.uid, b.blockedId)}
                      className="px-2 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Footer Info */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>subachat safe network</span>
        </div>
        <span className="font-mono text-[10px] bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-md">
          {mutualFriends.length} {mutualFriends.length === 1 ? 'friend' : 'friends'}
        </span>
      </div>

      {/* Delete Conversation Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl p-5 border shadow-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Delete Conversation?</h3>
                <p className="text-xs opacity-75 mt-0.5">Chat with <strong className="font-semibold">{chatToDelete.name}</strong></p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Are you sure you want to delete this whole conversation? All messages, audio notes, and media will be permanently removed for both participants. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingChat}
                onClick={() => setChatToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingChat}
                onClick={handleConfirmDeleteChat}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 shadow-md shadow-rose-600/25 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {deletingChat ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Conversation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
};
