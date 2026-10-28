import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  MessageSquarePlus, 
  Mail, 
  Check, 
  Loader2, 
  Sparkles, 
  UserPlus,
  UserCheck, 
  Clock,
  Ban,
  ShieldCheck,
  CircleDot 
} from 'lucide-react';
import { UserProfile, Friendship, UserBlock } from '../types';
import { 
  searchUsers, 
  getOrCreateChatRoom, 
  sendFriendRequest, 
  acceptFriendRequest, 
  cancelFriendRequest,
  unblockUser,
  db, 
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';
import { collection, query, where, limit, getDocs, onSnapshot } from 'firebase/firestore';

interface NewChatModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSelectChat,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Friendships and blocks live subscriptions
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<UserBlock[]>([]);

  // 1. Listen to friendships for current user
  useEffect(() => {
    if (!isOpen || !currentUser.uid) return;

    const q = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: Friendship[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Friendship));
      setFriendships(list);
    });

    return () => unsub();
  }, [isOpen, currentUser.uid]);

  // 2. Listen to blocks
  useEffect(() => {
    if (!isOpen || !currentUser.uid) return;

    const q = query(
      collection(db, 'blocks'),
      where('blockerId', '==', currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: UserBlock[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as UserBlock));
      setBlockedUsers(list);
    });

    return () => unsub();
  }, [isOpen, currentUser.uid]);

  const blockedUserIds = new Set(blockedUsers.map((b) => b.blockedId));

  // 3. Load directory of registered users
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    
    async function loadDirectory() {
      try {
        const q = query(collection(db, 'users'), limit(20));
        const snap = await getDocs(q);
        const users: UserProfile[] = [];
        snap.forEach((d) => {
          const u = d.data() as UserProfile;
          if (u.uid !== currentUser.uid) {
            users.push(u);
          }
        });
        if (isMounted) setAllUsers(users);
      } catch (err) {
        // Handled silently
      }
    }
    loadDirectory();

    return () => { isMounted = false; };
  }, [isOpen, currentUser.uid]);

  // 4. Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchUsers(searchTerm, currentUser.uid);
        setResults(found);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, currentUser.uid]);

  if (!isOpen) return null;

  const getFriendshipWith = (targetUid: string) => {
    return friendships.find((f) => f.users.includes(targetUid)) || null;
  };

  const handleStartChat = async (targetUser: UserProfile) => {
    const friendship = getFriendshipWith(targetUser.uid);
    if (!friendship || friendship.status !== 'accepted') {
      setInfoMessage(`You must be mutual friends with ${targetUser.displayName} to chat. Please send a friend request first!`);
      return;
    }

    setActionLoadingId(targetUser.uid);
    try {
      const chatId = await getOrCreateChatRoom(currentUser, targetUser);
      if (chatId) {
        onSelectChat(chatId);
        onClose();
      }
    } catch (err: any) {
      setInfoMessage(err?.message || 'Could not start chat.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendFriendRequest = async (targetUser: UserProfile) => {
    setActionLoadingId(targetUser.uid);
    setInfoMessage(null);
    try {
      await sendFriendRequest(currentUser.uid, targetUser.uid);
      setInfoMessage(`Friend request sent to ${targetUser.displayName}!`);
    } catch (err: any) {
      setInfoMessage(err?.message || 'Failed to send friend request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptRequest = async (friendshipId: string, targetName: string) => {
    setActionLoadingId(friendshipId);
    setInfoMessage(null);
    try {
      await acceptFriendRequest(friendshipId);
      setInfoMessage(`You are now friends with ${targetName}! You can now start chatting.`);
    } catch (err: any) {
      setInfoMessage(err?.message || 'Failed to accept friend request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelRequest = async (friendshipId: string) => {
    setActionLoadingId(friendshipId);
    try {
      await cancelFriendRequest(friendshipId);
    } catch (err: any) {
      setInfoMessage(err?.message || 'Failed to cancel request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const displayList = searchTerm.trim() ? results : allUsers;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Find Friends &amp; Connect
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connect with contacts on subachat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security / Friendship Notice Banner */}
        <div className="px-5 py-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
          <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span>
            <strong>subachat Friendship System:</strong> Strangers cannot chat unless both users are mutual friends. Send a request to connect!
          </span>
        </div>

        {/* Alert/Info message if any */}
        {infoMessage && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
            <span>{infoMessage}</span>
            <button 
              onClick={() => setInfoMessage(null)}
              className="text-amber-600 hover:text-amber-900 dark:text-amber-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email address..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {loading ? (
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-indigo-500">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {!searchTerm.trim() && (
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 dark:text-slate-500 px-2 py-1">
              <span>COMMUNITY DIRECTORY</span>
              <span className="text-[11px]">{displayList.length} users</span>
            </div>
          )}

          {displayList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <p className="text-sm">Searching users database...</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Mail className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    No users found matching &quot;{searchTerm}&quot;
                  </p>
                  <p className="text-xs">
                    Invite your friends to register and join subachat!
                  </p>
                </div>
              )}
            </div>
          ) : (
            displayList.map((user) => {
              const isLoading = actionLoadingId === user.uid;
              const isOnline = user.status === 'online';
              const isBlocked = blockedUserIds.has(user.uid);
              const friendship = getFriendshipWith(user.uid);

              const isFriend = friendship?.status === 'accepted';
              const isPendingSent = friendship?.status === 'pending' && friendship.requesterId === currentUser.uid;
              const isPendingReceived = friendship?.status === 'pending' && friendship.addresseeId === currentUser.uid;

              return (
                <div
                  key={user.uid}
                  className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-800/60 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`}
                        alt={user.displayName}
                        className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                        title={isOnline ? 'Online' : 'Offline'}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {user.displayName}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                            isOnline
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {user.bio || 'Using subachat'}
                      </p>
                    </div>
                  </div>

                  {/* Actions according to friendship status */}
                  <div className="shrink-0 ml-3 flex items-center gap-2">
                    {isBlocked ? (
                      <button
                        onClick={() => unblockUser(currentUser.uid, user.uid)}
                        className="py-1.5 px-3 rounded-xl font-bold text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
                      >
                        Unblock
                      </button>
                    ) : isFriend ? (
                      <button
                        onClick={() => handleStartChat(user)}
                        disabled={isLoading}
                        className="py-1.5 px-3 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <MessageSquarePlus className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </>
                        )}
                      </button>
                    ) : isPendingSent ? (
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 rounded-lg border border-amber-200 dark:border-amber-900/40 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Requested</span>
                        </span>
                        <button
                          onClick={() => friendship && handleCancelRequest(friendship.id)}
                          title="Cancel request"
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : isPendingReceived ? (
                      <button
                        onClick={() => friendship && handleAcceptRequest(friendship.id, user.displayName)}
                        disabled={isLoading}
                        className="py-1.5 px-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendFriendRequest(user)}
                        disabled={isLoading}
                        className="py-1.5 px-3 rounded-xl font-bold text-xs bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Add Friend</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
          Tip: You can search friends by their display name or email address
        </div>
      </div>
    </div>
  );
};
