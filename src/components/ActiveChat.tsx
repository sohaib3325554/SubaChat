import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Send, 
  ArrowLeft, 
  Smile, 
  Check, 
  CheckCheck, 
  Volume2, 
  VolumeX, 
  Info, 
  MoreVertical,
  CircleDot,
  Mail,
  SmilePlus,
  Heart,
  Sparkles,
  Reply,
  CornerUpLeft,
  X,
  Laugh,
  Plus,
  Mic,
  Trash2,
  Ban,
  UserX,
  UserPlus,
  ShieldAlert,
  Pencil,
  Moon
} from 'lucide-react';
import { UserProfile, ChatRoom, ChatMessage, MessageReplyInfo, Friendship } from '../types';
import { 
  db, 
  sendChatMessage, 
  editChatMessage,
  unsendChatMessage,
  deleteConversation,
  markChatAsRead, 
  updateTypingStatus, 
  playNotificationSound,
  toggleMessageReaction,
  toggleLoveMode,
  toggleHumorMode,
  toggleMidnightMode,
  blockUser,
  unblockUser,
  removeFriend,
  sendFriendRequest,
  acceptFriendRequest,
  getFriendshipId,
  getBlockId,
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc 
} from 'firebase/firestore';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { EmojiPickerModal } from './EmojiPickerModal';
import { MessageItem } from './MessageItem';
import { 
  getQuickReactionEmojis, 
  getQuickComposerEmojis,
  ChatMoodMode
} from '../data/emojis';

interface ActiveChatProps {
  chatId: string;
  currentUser: UserProfile;
  onBack: () => void;
  onOpenGmail?: (partnerEmail?: string) => void;
}

export const ActiveChat: React.FC<ActiveChatProps> = ({
  chatId,
  currentUser,
  onBack,
  onOpenGmail,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reactionMenuMsgId, setReactionMenuMsgId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<MessageReplyInfo | null>(null);

  // Friendship & Block states
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [hasBlockedMe, setHasBlockedMe] = useState(false);
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteConversationModal, setShowDeleteConversationModal] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);

  // Full Emoji Picker Modal State
  const [activeModalMessageId, setActiveModalMessageId] = useState<string | null>(null);
  const [isTextEmojiModalOpen, setIsTextEmojiModalOpen] = useState(false);

  // Voice Message Recording State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingAudioLevels, setRecordingAudioLevels] = useState<number[]>([25, 45, 65, 35, 20]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCurrentlyTypingRef = useRef<boolean>(false);
  const lastMessageCountRef = useRef<number>(0);

  // MediaRecorder references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastAudioLevelUpdateRef = useRef<number>(0);

  const isLoveMode = chatRoom?.loveMode === true;
  const isHumorMode = chatRoom?.humorMode === true;
  const isMidnightMode = chatRoom?.midnightMode === true;
  const activeMode: ChatMoodMode = isHumorMode ? 'humor' : isLoveMode ? 'love' : isMidnightMode ? 'midnight' : 'normal';

  const activeQuickEmojis = useMemo(() => getQuickComposerEmojis(activeMode), [activeMode]);
  const activeReactionEmojis = useMemo(() => getQuickReactionEmojis(activeMode), [activeMode]);

  // 1. Listen to parent chat room details (typing indicators, participant details, loveMode, humorMode)
  useEffect(() => {
    if (!chatId) return;

    const chatDocRef = doc(db, 'chats', chatId);
    const unsubscribeChat = onSnapshot(
      chatDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as ChatRoom;
          setChatRoom(data);

          // Find partner ID
          const partnerId = data.participants.find((p) => p !== currentUser.uid);
          if (partnerId) {
            // Listen to partner user profile for live online status & avatar
            const userDocRef = doc(db, 'users', partnerId);
            onSnapshot(userDocRef, (uSnap) => {
              if (uSnap.exists()) {
                setPartnerProfile(uSnap.data() as UserProfile);
              }
            });
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `chats/${chatId}`);
      }
    );

    return () => {
      unsubscribeChat();
      // Reset typing on unmount/chat switch
      updateTypingStatus(chatId, currentUser.uid, false);
    };
  }, [chatId, currentUser.uid]);

  // 1b. Real-time listener for friendship & block status with partner
  useEffect(() => {
    const partnerId = chatRoom?.participants.find((p) => p !== currentUser.uid);
    if (!partnerId || !currentUser?.uid) return;

    // My block on partner
    const myBlockRef = doc(db, 'blocks', getBlockId(currentUser.uid, partnerId));
    const unsubMyBlock = onSnapshot(myBlockRef, (snap) => {
      setIsBlockedByMe(snap.exists());
    });

    // Partner block on me
    const theirBlockRef = doc(db, 'blocks', getBlockId(partnerId, currentUser.uid));
    const unsubTheirBlock = onSnapshot(theirBlockRef, (snap) => {
      setHasBlockedMe(snap.exists());
    });

    // Friendship record
    const fId = getFriendshipId(currentUser.uid, partnerId);
    const fRef = doc(db, 'friendships', fId);
    const unsubFriendship = onSnapshot(fRef, (snap) => {
      if (snap.exists()) {
        setFriendship({ id: snap.id, ...snap.data() } as Friendship);
      } else {
        setFriendship(null);
      }
    });

    return () => {
      unsubMyBlock();
      unsubTheirBlock();
      unsubFriendship();
    };
  }, [chatRoom?.participants, currentUser.uid]);

  // Message Editing & Unsend states
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [messageToUnsend, setMessageToUnsend] = useState<ChatMessage | null>(null);
  const [desktopMenuMsgId, setDesktopMenuMsgId] = useState<string | null>(null);

  // Close options menu when tapping outside
  useEffect(() => {
    if (!showOptionsMenu) return;
    const handleTap = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-options-menu]')) {
        setShowOptionsMenu(false);
      }
    };
    window.addEventListener('mousedown', handleTap);
    window.addEventListener('touchstart', handleTap);
    return () => {
      window.removeEventListener('mousedown', handleTap);
      window.removeEventListener('touchstart', handleTap);
    };
  }, [showOptionsMenu]);

  // Close reaction menu and desktop 3-dots menu when tapping outside
  useEffect(() => {
    if (!reactionMenuMsgId && !desktopMenuMsgId) return;
    const handleTap = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-reaction-menu="true"]') && !target.closest('[data-desktop-menu="true"]')) {
        setReactionMenuMsgId(null);
        setDesktopMenuMsgId(null);
      }
    };
    window.addEventListener('mousedown', handleTap);
    window.addEventListener('touchstart', handleTap);
    return () => {
      window.removeEventListener('mousedown', handleTap);
      window.removeEventListener('touchstart', handleTap);
    };
  }, [reactionMenuMsgId, desktopMenuMsgId]);

  // 2. Real-time messages listener
  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribeMessages = onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((d) => {
          msgs.push({ id: d.id, ...d.data() } as ChatMessage);
        });

        // Check if a new message was received from partner to play chime
        if (
          lastMessageCountRef.current > 0 &&
          msgs.length > lastMessageCountRef.current
        ) {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.senderId !== currentUser.uid && soundEnabled) {
            playNotificationSound();
          }
        }
        lastMessageCountRef.current = msgs.length;

        setMessages(msgs);

        // Mark incoming messages as read only when unread messages exist
        const hasUnread = msgs.some((m) => m.senderId !== currentUser.uid && !m.read);
        if (hasUnread) {
          const partnerId = chatRoom?.participants.find((p) => p !== currentUser.uid);
          if (partnerId) {
            markChatAsRead(chatId, currentUser.uid, partnerId);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
      }
    );

    return () => unsubscribeMessages();
  }, [chatId, currentUser.uid, chatRoom?.participants, soundEnabled]);

  // Smooth scroll to bottom on message updates or partner typing status
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatRoom?.typing]);

  // Close reaction menu when tapping or clicking outside
  useEffect(() => {
    if (!reactionMenuMsgId) return;

    const handleTapOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-reaction-menu]')) {
        setReactionMenuMsgId(null);
      }
    };

    window.addEventListener('mousedown', handleTapOutside);
    window.addEventListener('touchstart', handleTapOutside);

    return () => {
      window.removeEventListener('mousedown', handleTapOutside);
      window.removeEventListener('touchstart', handleTapOutside);
    };
  }, [reactionMenuMsgId]);

  // Handle typing status debounce with state tracking
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Only broadcast typing=true once on initial typing activity
    if (!isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = true;
      updateTypingStatus(chatId, currentUser.uid, true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isCurrentlyTypingRef.current) {
        isCurrentlyTypingRef.current = false;
        updateTypingStatus(chatId, currentUser.uid, false);
      }
    }, 2200);
  };

  const handleInputBlur = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = false;
      updateTypingStatus(chatId, currentUser.uid, false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    // If currently editing a previously sent message, save the edit!
    if (editingMessage) {
      setSending(true);
      const editTarget = editingMessage;
      setEditingMessage(null);
      setInputText('');
      setShowEmojiPicker(false);
      try {
        await editChatMessage(chatId, editTarget.id, trimmed);
      } catch (err) {
        console.error('Failed to edit message:', err);
      } finally {
        setSending(false);
      }
      return;
    }

    const partnerId = chatRoom?.participants.find((p) => p !== currentUser.uid);
    if (!partnerId) return;

    const currentReply = replyingToMessage;
    setSending(true);
    setInputText('');
    setReplyingToMessage(null);
    setShowEmojiPicker(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = false;
      updateTypingStatus(chatId, currentUser.uid, false);
    }

    try {
      await sendChatMessage(chatId, currentUser.uid, partnerId, trimmed, currentReply || undefined);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  // Voice recording helpers
  const cleanupRecordingResources = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    setIsRecordingVoice(false);
    setRecordingDuration(0);
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    audioChunksRef.current = [];
    cleanupRecordingResources();
  };

  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Microphone access is not supported by your browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Realtime audio wave level analyzer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);
          analyserRef.current = analyser;

          const updateLevels = () => {
            if (!analyserRef.current) return;
            const now = performance.now();
            if (now - lastAudioLevelUpdateRef.current >= 60) {
              lastAudioLevelUpdateRef.current = now;
              const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
              analyserRef.current.getByteFrequencyData(dataArray);
              const levels = [
                Math.max(20, (dataArray[1] || 0) / 2.2),
                Math.max(25, (dataArray[3] || 0) / 1.8),
                Math.max(30, (dataArray[5] || 0) / 1.6),
                Math.max(25, (dataArray[7] || 0) / 2.0),
                Math.max(20, (dataArray[9] || 0) / 2.4),
              ];
              setRecordingAudioLevels(levels);
            }
            animationFrameRef.current = requestAnimationFrame(updateLevels);
          };
          animationFrameRef.current = requestAnimationFrame(updateLevels);
        }
      } catch (e) {
        console.warn('Audio visualization fallback:', e);
      }

      mediaRecorder.start(200);
      setIsRecordingVoice(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 120) {
            stopAndSendVoiceRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording voice message:', err);
      alert('Microphone permission is required to record voice messages.');
    }
  };

  const stopAndSendVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cleanupRecordingResources();
      return;
    }

    const durationToSend = Math.max(1, recordingDuration);

    recorder.onstop = async () => {
      try {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (base64Audio) {
            const partnerId = chatRoom?.participants.find((p) => p !== currentUser.uid);
            if (partnerId) {
              const currentReply = replyingToMessage;
              setReplyingToMessage(null);
              await sendChatMessage(
                chatId,
                currentUser.uid,
                partnerId,
                `🎤 Voice message (${durationToSend}s)`,
                currentReply || undefined,
                { audioUrl: base64Audio, audioDuration: durationToSend }
              );
            }
          }
        };
        reader.readAsDataURL(audioBlob);
      } catch (err) {
        console.error('Failed to send voice message:', err);
      } finally {
        cleanupRecordingResources();
      }
    };

    recorder.stop();
  };

  // Clean up recording on unmount or chat switch
  useEffect(() => {
    return () => {
      cancelVoiceRecording();
    };
  }, [chatId]);

  const partnerId = chatRoom?.participants.find((p) => p !== currentUser.uid) || '';
  const partnerDetail = chatRoom?.participantDetails?.[partnerId];
  const partnerName = partnerProfile?.displayName || partnerDetail?.displayName || 'subachat Friend';
  const partnerEmail = partnerProfile?.email || partnerDetail?.email || '';
  const partnerPhoto = partnerProfile?.photoURL || partnerDetail?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${partnerId}`;
  const isPartnerOnline = partnerProfile?.status === 'online';
  const isPartnerTyping = partnerId ? chatRoom?.typing?.[partnerId] === true : false;
  const isFriend = friendship?.status === 'accepted';

  const addEmoji = useCallback((emoji: string) => {
    setInputText((prev) => prev + emoji);
    inputRef.current?.focus();
  }, []);

  const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
    setReactionMenuMsgId(null);
    try {
      await toggleMessageReaction(chatId, messageId, currentUser.uid, emoji);
    } catch (err) {
      console.error('Failed to update reaction:', err);
    }
  }, [chatId, currentUser.uid]);

  const handleStartReply = useCallback((msg: ChatMessage) => {
    const isMe = msg.senderId === currentUser.uid;
    setReplyingToMessage({
      messageId: msg.id,
      text: msg.text,
      senderName: isMe ? 'You' : partnerName,
      senderId: msg.senderId,
    });
    setReactionMenuMsgId(null);
    inputRef.current?.focus();
  }, [currentUser.uid, partnerName]);

  const handleStartEdit = useCallback((msg: ChatMessage) => {
    setReplyingToMessage(null);
    setEditingMessage(msg);
    setInputText(msg.text);
    setReactionMenuMsgId(null);
    setDesktopMenuMsgId(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 40);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInputText('');
  }, []);

  const handleRequestUnsend = useCallback((msg: ChatMessage) => {
    setReactionMenuMsgId(null);
    setDesktopMenuMsgId(null);
    setMessageToUnsend(msg);
  }, []);

  const handleConfirmUnsend = useCallback(async () => {
    if (!messageToUnsend || !chatId) return;
    const targetId = messageToUnsend.id;
    try {
      setMessageToUnsend(null);
      if (editingMessage?.id === targetId) {
        setEditingMessage(null);
        setInputText('');
      }
      await unsendChatMessage(chatId, targetId);
    } catch (err) {
      console.error('Failed to unsend message:', err);
    }
  }, [chatId, messageToUnsend, editingMessage]);

  const handleDeleteConversation = useCallback(async () => {
    if (deletingConversation || !chatId) return;
    setDeletingConversation(true);
    try {
      await deleteConversation(chatId);
      setShowDeleteConversationModal(false);
      onBack();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      alert('Failed to delete conversation.');
    } finally {
      setDeletingConversation(false);
    }
  }, [chatId, deletingConversation, onBack]);

  const getGroupedReactions = useCallback((reactions?: Record<string, string>) => {
    if (!reactions) return [];
    const groups: Record<string, { emoji: string; count: number; hasReacted: boolean; userIds: string[] }> = {};
    
    Object.entries(reactions).forEach(([uId, emoji]) => {
      if (!groups[emoji]) {
        groups[emoji] = { emoji, count: 0, hasReacted: false, userIds: [] };
      }
      groups[emoji].count += 1;
      groups[emoji].userIds.push(uId);
      if (uId === currentUser.uid) {
        groups[emoji].hasReacted = true;
      }
    });

    return Object.values(groups);
  }, [currentUser.uid]);

  // Format message time helper
  const formatMsgTime = useCallback((ts: any) => {
    if (!ts) return 'Sending...';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, []);

  // Group messages by date
  const formatDateGroup = useCallback((ts: any) => {
    if (!ts) return 'Today';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      const today = new Date();
      if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      ) {
        return 'Today';
      }
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        return 'Yesterday';
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Today';
    }
  }, []);

  return (
    <div 
      className={`w-full h-full flex flex-col transition-colors relative overflow-hidden ${
        isHumorMode
          ? 'bg-gradient-to-br from-amber-50/95 via-yellow-50/70 to-amber-100/60 dark:from-amber-950/60 dark:via-yellow-950/40 dark:to-slate-950'
          : isLoveMode 
            ? 'bg-gradient-to-br from-pink-50/90 via-rose-50/50 to-pink-100/60 dark:from-rose-950/60 dark:via-pink-950/40 dark:to-slate-950' 
            : isMidnightMode
              ? 'bg-gradient-to-br from-[#190214] via-[#2d0528] to-[#0d0016] text-purple-100'
              : 'bg-slate-50 dark:bg-slate-950'
      }`}
    >
      {/* Love Mode Floating Heart Accents */}
      {isLoveMode && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 opacity-25 dark:opacity-15 transform-gpu [contain:paint_layout]">
          <div className="absolute top-12 left-10 text-3xl animate-pulse will-change-transform">💖</div>
          <div className="absolute top-1/4 right-12 text-2xl animate-bounce [animation-duration:3s] will-change-transform">💕</div>
          <div className="absolute bottom-24 left-1/3 text-4xl animate-pulse [animation-duration:4s] will-change-transform">🌹</div>
          <div className="absolute bottom-16 right-20 text-3xl animate-bounce [animation-duration:2.5s] will-change-transform">✨</div>
          <div className="absolute top-1/2 left-8 text-2xl animate-pulse will-change-transform">💘</div>
        </div>
      )}

      {/* Humor Mode Floating Laugh Accents */}
      {isHumorMode && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 opacity-25 dark:opacity-15 transform-gpu [contain:paint_layout]">
          <div className="absolute top-12 left-10 text-3xl animate-bounce [animation-duration:2s] will-change-transform">😂</div>
          <div className="absolute top-1/4 right-12 text-3xl animate-pulse [animation-duration:3s] will-change-transform">🤣</div>
          <div className="absolute bottom-24 left-1/4 text-4xl animate-bounce [animation-duration:2.8s] will-change-transform">🤪</div>
          <div className="absolute bottom-16 right-16 text-3xl animate-pulse will-change-transform">😹</div>
          <div className="absolute top-1/2 left-12 text-2xl animate-bounce [animation-duration:2.2s] will-change-transform">🍌</div>
          <div className="absolute top-2/3 right-1/3 text-3xl animate-pulse will-change-transform">✨</div>
        </div>
      )}

      {/* Midnight Mode Floating Sultry Accents */}
      {isMidnightMode && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 opacity-20 dark:opacity-25 transform-gpu [contain:paint_layout]">
          <div className="absolute top-10 left-10 text-3xl animate-pulse will-change-transform">🌚</div>
          <div className="absolute top-1/4 right-10 text-3xl animate-bounce [animation-duration:3.2s] will-change-transform">👄</div>
          <div className="absolute bottom-28 left-1/4 text-4xl animate-pulse [animation-duration:4s] will-change-transform">🍷</div>
          <div className="absolute bottom-16 right-16 text-3xl animate-bounce [animation-duration:2.6s] will-change-transform">😈</div>
          <div className="absolute top-1/2 left-8 text-2xl animate-pulse will-change-transform">💋</div>
          <div className="absolute top-2/3 right-1/3 text-3xl animate-pulse will-change-transform">🔥</div>
          <div className="absolute top-1/3 left-1/2 text-2xl animate-bounce [animation-duration:3s] will-change-transform">🫦</div>
        </div>
      )}
      
      {/* Top Chat Header */}
      <header 
        className={`px-3 sm:px-4 py-2.5 sm:py-3 border-b flex items-center justify-between shadow-xs relative z-20 transition-colors w-full max-w-full ${
          isHumorMode
            ? 'bg-white/85 dark:bg-slate-900/90 backdrop-blur-md border-amber-200 dark:border-amber-900/60 shadow-amber-500/5'
            : isLoveMode 
              ? 'bg-white/80 dark:bg-slate-900/90 backdrop-blur-md border-pink-200 dark:border-pink-900/60 shadow-pink-500/5'
              : isMidnightMode
                ? 'bg-[#1b0216]/95 backdrop-blur-md border-purple-900/70 shadow-purple-950/30 text-purple-100'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2">
          {/* Back button on mobile */}
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            title="Back to conversation list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Partner Avatar & Info */}
          <div className="relative shrink-0">
            <img
              src={partnerPhoto}
              alt={partnerName}
              className={`w-10 h-10 rounded-2xl object-cover bg-slate-100 dark:bg-slate-800 border ${
                isHumorMode
                  ? 'border-amber-400 shadow-sm shadow-amber-400/30'
                  : isLoveMode 
                    ? 'border-pink-400 shadow-sm shadow-pink-400/30' 
                    : isMidnightMode
                      ? 'border-purple-600 shadow-sm shadow-purple-900/40'
                      : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                isPartnerOnline ? 'bg-emerald-500 ring-2 ring-emerald-400/20' : 'bg-slate-400'
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className={`font-bold text-sm sm:text-base flex items-center gap-1.5 min-w-0 ${isMidnightMode ? 'text-purple-100' : 'text-slate-900 dark:text-white'}`}>
              <span className="truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-none">{partnerName}</span>
              {isBlockedByMe && (
                <span className="shrink-0 text-[10px] text-rose-600 dark:text-rose-400 font-bold px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50">
                  🚫 Blocked
                </span>
              )}
              {!isFriend && !isBlockedByMe && (
                <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50">
                  Not Friends
                </span>
              )}
              {isHumorMode && (
                <span className="shrink-0 text-[10px] text-amber-700 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded-md bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-900/50 flex items-center gap-1">
                  <span>😂 Humor</span>
                </span>
              )}
              {isLoveMode && (
                <span className="shrink-0 text-[10px] text-rose-500 font-bold px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 flex items-center gap-1">
                  <Heart className="w-2.5 h-2.5 fill-rose-500" />
                  <span>Love</span>
                </span>
              )}
              {isMidnightMode && (
                <span className="shrink-0 text-[10px] text-purple-300 font-bold px-1.5 py-0.5 rounded-md bg-purple-950/80 border border-purple-800/70 flex items-center gap-1 shadow-xs">
                  <span>🌚 Midnight</span>
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1.5 text-xs truncate">
              {isPartnerTyping ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  typing...
                </span>
              ) : isPartnerOnline ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Online
                </span>
              ) : (
                <span className={`truncate ${isMidnightMode ? 'text-purple-400/80' : 'text-slate-400'}`}>Offline</span>
              )}
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Active Mode Pill (for desktop >= sm) */}
          {isHumorMode && (
            <button
              onClick={() => toggleHumorMode(chatId, false)}
              type="button"
              title="Humor Mode active - Click to turn off or use menu"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 shadow-xs shadow-amber-400/30 hover:bg-amber-300 transition-colors cursor-pointer"
            >
              <span>😂</span>
              <span>Humor</span>
            </button>
          )}
          {isLoveMode && (
            <button
              onClick={() => toggleLoveMode(chatId, false)}
              type="button"
              title="Love Mode active - Click to turn off or use menu"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-500 text-white shadow-xs shadow-rose-500/25 hover:bg-rose-600 transition-colors cursor-pointer"
            >
              <Heart className="w-3 h-3 fill-white" />
              <span>Love</span>
            </button>
          )}
          {isMidnightMode && (
            <button
              onClick={() => toggleMidnightMode(chatId, false)}
              type="button"
              title="Midnight Mode active - Click to turn off or use menu"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-gradient-to-r from-[#700b34] to-[#6b21a8] text-white shadow-xs shadow-purple-950/40 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <span>🌚</span>
              <span>Midnight</span>
            </button>
          )}

          {/* Vertical 3-dots Menu Button (Present on both PC and mobile app) */}
          <div className="relative" data-options-menu>
            <button
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              type="button"
              title="Chat menu: Modes, Mute, Email, Block, Remove Friend, Delete Conversation"
              aria-label="Chat options menu"
              className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                showOptionsMenu
                  ? isMidnightMode
                    ? 'bg-purple-900/80 text-purple-100 ring-2 ring-purple-600/50'
                    : isHumorMode
                      ? 'bg-amber-200 dark:bg-amber-900/80 text-amber-950 dark:text-amber-100 ring-2 ring-amber-400'
                      : isLoveMode
                        ? 'bg-pink-200 dark:bg-pink-900/80 text-pink-950 dark:text-pink-100 ring-2 ring-pink-400'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                  : isMidnightMode
                    ? 'text-purple-300 hover:text-purple-100 hover:bg-purple-900/50'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <MoreVertical className="w-5 h-5 stroke-[2.2]" />
            </button>

            {/* Backdrop overlay so tapping anywhere outside or over messages dismisses the menu */}
            {showOptionsMenu && (
              <div 
                className="fixed inset-0 z-40 bg-black/25 dark:bg-black/40 backdrop-blur-xs transition-opacity"
                onClick={() => setShowOptionsMenu(false)}
              />
            )}

            {/* Floating Menu Appearing Over Messages in Both PC & Mobile */}
            {showOptionsMenu && (
              <div
                className={`absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl shadow-2xl border z-50 py-2 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md overflow-hidden ${
                  isMidnightMode
                    ? 'bg-[#1b0217]/95 border-purple-800 text-purple-100 shadow-purple-950/80 divide-purple-900/60'
                    : isHumorMode
                      ? 'bg-white/95 dark:bg-slate-900/95 border-amber-300 dark:border-amber-800/80 text-slate-900 dark:text-white shadow-amber-500/10 divide-amber-100 dark:divide-amber-900/40'
                      : isLoveMode
                        ? 'bg-white/95 dark:bg-slate-900/95 border-pink-200 dark:border-pink-800/80 text-slate-900 dark:text-white shadow-pink-500/10 divide-pink-100 dark:divide-pink-900/40'
                        : 'bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl divide-slate-100 dark:divide-slate-800/80'
                } divide-y`}
              >
                {/* 1. CHAT MODES SECTION */}
                <div className="p-2 space-y-1">
                  <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider opacity-70">
                    <span>Chat Mood / Modes</span>
                    <span className="text-[9px] lowercase font-semibold opacity-75">tap to switch</span>
                  </div>

                  {/* Standard Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      toggleHumorMode(chatId, false);
                      toggleLoveMode(chatId, false);
                      toggleMidnightMode(chatId, false);
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      !isHumorMode && !isLoveMode && !isMidnightMode
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm shrink-0">
                        💬
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">Standard Mode</div>
                        <div className="text-[10px] opacity-60 truncate">Default clean chat</div>
                      </div>
                    </div>
                    {!isHumorMode && !isLoveMode && !isMidnightMode && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>

                  {/* Humor Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      toggleHumorMode(chatId, !isHumorMode);
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isHumorMode
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-bold'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 flex items-center justify-center text-sm shrink-0">
                        😂
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">Humor Mode</div>
                        <div className="text-[10px] opacity-60 truncate">Yellow theme, jokes &amp; witty vibe</div>
                      </div>
                    </div>
                    {isHumorMode && (
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>

                  {/* Love Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      toggleLoveMode(chatId, !isLoveMode);
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isLoveMode
                        ? 'bg-pink-100 dark:bg-pink-950/60 text-rose-900 dark:text-pink-200 font-bold'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-pink-100 dark:bg-pink-900/60 text-rose-600 flex items-center justify-center text-sm shrink-0">
                        💖
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">Love Mode</div>
                        <div className="text-[10px] opacity-60 truncate">Sweet romantic pink &amp; flutters</div>
                      </div>
                    </div>
                    {isLoveMode && (
                      <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>

                  {/* Midnight Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      toggleMidnightMode(chatId, !isMidnightMode);
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isMidnightMode
                        ? 'bg-purple-900/60 text-purple-100 font-bold'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-purple-900/80 text-purple-200 flex items-center justify-center text-sm shrink-0">
                        🌚
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">Midnight Mode</div>
                        <div className="text-[10px] opacity-60 truncate">Burgundy &amp; purple sultry vibe</div>
                      </div>
                    </div>
                    {isMidnightMode && (
                      <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                </div>

                {/* 2. AUDIO & EMAIL CONTROLS */}
                <div className="p-2 space-y-1">
                  {/* Mute Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setSoundEnabled(!soundEnabled);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        soundEnabled ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}>
                        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">
                          {soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
                        </div>
                        <div className="text-[10px] opacity-60 truncate">
                          {soundEnabled ? 'Notification sounds active' : 'Notifications muted'}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      soundEnabled 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {soundEnabled ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Send Email */}
                  {partnerEmail ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowOptionsMenu(false);
                        if (onOpenGmail) {
                          onOpenGmail(partnerEmail);
                        } else {
                          window.location.href = `mailto:${partnerEmail}`;
                        }
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors cursor-pointer text-slate-800 dark:text-slate-100"
                    >
                      <span className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold">Send Email</div>
                        <div className="text-[10px] opacity-60 truncate">{partnerEmail}</div>
                      </div>
                    </button>
                  ) : (
                    <div className="px-2.5 py-2 flex items-center gap-2.5 opacity-50 cursor-not-allowed">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold">Email Not Available</div>
                        <div className="text-[10px] opacity-60">No email on profile</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. CONTACT & SAFETY (BLOCK & REMOVE FRIEND) */}
                <div className="p-2 space-y-1">
                  {isBlockedByMe ? (
                    <button
                      type="button"
                      onClick={async () => {
                        setShowOptionsMenu(false);
                        if (partnerId) await unblockUser(currentUser.uid, partnerId);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer font-semibold text-xs"
                    >
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </span>
                      <span>Unblock Contact</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        setShowOptionsMenu(false);
                        if (confirm(`Block ${partnerName}? You will not be able to message each other.`)) {
                          if (partnerId) await blockUser(currentUser.uid, partnerId);
                        }
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer font-semibold text-xs"
                    >
                      <span className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                        <Ban className="w-4 h-4" />
                      </span>
                      <span>Block Contact</span>
                    </button>
                  )}

                  {isFriend && (
                    <button
                      type="button"
                      onClick={async () => {
                        setShowOptionsMenu(false);
                        if (confirm(`Remove ${partnerName} from your friends list?`)) {
                          if (partnerId) await removeFriend(currentUser.uid, partnerId);
                        }
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer font-semibold text-xs"
                    >
                      <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                        <UserX className="w-4 h-4" />
                      </span>
                      <span>Remove Friend</span>
                    </button>
                  )}
                </div>

                {/* 4. DANGER ZONE: DELETE WHOLE CONVERSATION */}
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setShowDeleteConversationModal(true);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer font-semibold text-xs group"
                  >
                    <span className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-600 group-hover:bg-rose-200 dark:group-hover:bg-rose-900 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div>Delete Conversation</div>
                      <div className="text-[10px] opacity-60">Permanently delete all messages</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 space-y-4 relative z-10 w-full max-w-full">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-2xl mb-3 shadow-inner ${
              isHumorMode
                ? 'bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-3xl'
                : isLoveMode 
                  ? 'bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-3xl' 
                  : isMidnightMode
                    ? 'bg-gradient-to-br from-[#4a0421] to-[#3b0764] border border-purple-800 text-3xl shadow-purple-950/50'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40'
            }`}>
              {isHumorMode ? '😂' : isLoveMode ? '💖' : isMidnightMode ? '🌚' : '💬'}
            </div>
            <h3 className={`text-base font-bold ${isMidnightMode ? 'text-purple-100' : 'text-slate-800 dark:text-slate-200'}`}>
              {isHumorMode 
                ? `Ready for some laughs with ${partnerName}? 🤣` 
                : isLoveMode 
                  ? `Sweet messages with ${partnerName}` 
                  : isMidnightMode
                    ? `Late night vibes with ${partnerName} 🌚🍷`
                    : `Start a conversation with ${partnerName}`}
            </h3>
            <p className={`text-xs max-w-xs mt-1 ${isMidnightMode ? 'text-purple-300/80' : 'text-slate-400'}`}>
              {isHumorMode
                ? 'Humor Mode is active! Messages are surrounded by joy, laughs, and sunny yellow energy.'
                : isLoveMode 
                  ? 'Love Mode is active! Messages are wrapped in a sweet romantic theme.'
                  : isMidnightMode
                    ? 'Midnight Mode is active! Sultry burgundy and purple vibes for whispers, late-night confessions and spicy sparks.'
                    : 'Say hello or ask a question. Messages are encrypted and synced in real time!'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {(isHumorMode
                ? ['Tell me a joke! 😂', 'Why so serious? 🤪', 'You won’t believe this... 🤣']
                : isLoveMode 
                  ? ['Thinking of you 💖', 'Hey gorgeous! 🥰', 'Ready for our chat? ✨']
                  : isMidnightMode
                    ? ['You up? 🌚', 'Tell me a secret... 🍷', 'Late night thoughts 👄', 'Feeling so spicy 🔥']
                    : ['Hey there! 👋', 'How are you doing?', 'Ready for our chat? ✨']
              ).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInputText(prompt)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isHumorMode
                      ? 'bg-white/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 hover:border-amber-500 text-amber-900 dark:text-amber-200'
                      : isLoveMode
                        ? 'bg-white/90 dark:bg-rose-950/70 border border-pink-200 dark:border-pink-800 hover:border-rose-400 text-rose-700 dark:text-rose-200'
                        : isMidnightMode
                          ? 'bg-[#25031f] border border-purple-800 hover:border-purple-500 text-purple-200 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.uid;
            const prevMsg = messages[index - 1];
            const showDateHeader =
              !prevMsg || formatDateGroup(prevMsg.timestamp) !== formatDateGroup(msg.timestamp);

            return (
              <React.Fragment key={msg.id}>
                {/* Date separator */}
                {showDateHeader && (
                  <div className="flex items-center justify-center my-4">
                    <span className={`text-[11px] font-semibold tracking-wider uppercase px-3 py-1 rounded-full border ${
                      isHumorMode
                        ? 'bg-amber-100/90 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-900/60'
                        : isLoveMode
                          ? 'bg-pink-100/80 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 border-pink-200 dark:border-pink-900/60'
                          : isMidnightMode
                            ? 'bg-[#22021c] text-purple-300 border-purple-800/80 shadow-xs'
                            : 'bg-slate-200/60 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-300/40 dark:border-slate-700/50'
                    }`}>
                      {formatDateGroup(msg.timestamp)}
                    </span>
                  </div>
                )}

                {/* Message Row with Swipe-to-Reply and Hold-to-React */}
                <MessageItem
                  msg={msg}
                  index={index}
                  isMe={isMe}
                  isHumorMode={isHumorMode}
                  isLoveMode={isLoveMode}
                  isMidnightMode={isMidnightMode}
                  activeReactionEmojis={activeReactionEmojis}
                  reactionMenuMsgId={reactionMenuMsgId}
                  setReactionMenuMsgId={setReactionMenuMsgId}
                  setActiveModalMessageId={setActiveModalMessageId}
                  handleToggleReaction={handleToggleReaction}
                  handleStartReply={handleStartReply}
                  formatMsgTime={formatMsgTime}
                  getGroupedReactions={getGroupedReactions}
                  onEditMessage={handleStartEdit}
                  onUnsendMessage={handleRequestUnsend}
                  desktopMenuMsgId={desktopMenuMsgId}
                  setDesktopMenuMsgId={setDesktopMenuMsgId}
                />
              </React.Fragment>
            );
          })
        )}

        {/* PROMINENT LIVE TYPING INDICATOR */}
        {isPartnerTyping && (
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <img 
              src={partnerPhoto} 
              alt={partnerName}
              className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
            <div className={`border px-3.5 py-2.5 rounded-2xl rounded-bl-xs flex items-center gap-1.5 shadow-sm ${
              isHumorMode
                ? 'bg-white/95 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-700'
                : isLoveMode 
                  ? 'bg-white/95 dark:bg-rose-950/80 border-pink-200 dark:border-pink-800 text-rose-600'
                  : isMidnightMode
                    ? 'bg-[#1f031b]/95 border-purple-800 text-purple-300 shadow-purple-950/40'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}>
              <span className={`w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s] ${
                isHumorMode ? 'bg-amber-500' : isLoveMode ? 'bg-rose-500' : isMidnightMode ? 'bg-purple-400' : 'bg-indigo-500'
              }`} />
              <span className={`w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s] ${
                isHumorMode ? 'bg-yellow-500' : isLoveMode ? 'bg-pink-500' : isMidnightMode ? 'bg-pink-500' : 'bg-indigo-500'
              }`} />
              <span className={`w-2 h-2 rounded-full animate-bounce ${
                isHumorMode ? 'bg-amber-500' : isLoveMode ? 'bg-rose-500' : isMidnightMode ? 'bg-purple-400' : 'bg-indigo-500'
              }`} />
            </div>
            <span className={`text-[11px] font-semibold ${isMidnightMode ? 'text-purple-300' : 'text-slate-500 dark:text-slate-400'}`}>
              {partnerName} is typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar Section */}
      <div 
        className={`border-t relative z-10 transition-colors w-full max-w-full overflow-hidden ${
          isHumorMode
            ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-amber-200 dark:border-amber-900/60'
            : isLoveMode 
              ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-pink-200 dark:border-pink-900/60'
              : isMidnightMode
                ? 'bg-[#180214]/95 backdrop-blur-md border-purple-900/70 text-purple-100'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}
      >
        {/* Replying Banner */}
        {replyingToMessage && (
          <div className={`px-4 py-2 border-b flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 duration-150 ${
            isHumorMode
              ? 'bg-amber-100/90 dark:bg-amber-950/80 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
              : isLoveMode
                ? 'bg-rose-100/80 dark:bg-rose-950/80 border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-pink-100'
                : isMidnightMode
                  ? 'bg-[#290322]/95 border-purple-800 text-purple-200'
                  : 'bg-slate-50/90 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                isHumorMode
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : isLoveMode
                    ? 'bg-rose-500 text-white shadow-xs'
                    : isMidnightMode
                      ? 'bg-gradient-to-r from-[#700b34] to-[#6b21a8] text-white shadow-xs'
                      : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
              }`}>
                <CornerUpLeft className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold">
                  Replying to {replyingToMessage.senderName}
                </span>
                <p className={`text-[11px] truncate max-w-sm ${
                  isHumorMode
                    ? 'text-amber-800 dark:text-amber-300'
                    : isLoveMode
                      ? 'text-rose-700 dark:text-pink-300'
                      : isMidnightMode
                        ? 'text-purple-300'
                        : 'text-slate-400'
                }`}>
                  {replyingToMessage.text}
                </p>
              </div>
            </div>
            <button
              onClick={() => setReplyingToMessage(null)}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Editing Banner */}
        {editingMessage && (
          <div className={`px-4 py-2 border-b flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 duration-150 ${
            isHumorMode
              ? 'bg-amber-100/95 dark:bg-amber-950/90 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100'
              : isLoveMode
                ? 'bg-rose-100/90 dark:bg-rose-950/90 border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-pink-100'
                : isMidnightMode
                  ? 'bg-gradient-to-r from-[#3b041e] to-[#2b043c] border-purple-800 text-purple-100 shadow-xs'
                  : 'bg-indigo-50/90 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                isHumorMode
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : isLoveMode
                    ? 'bg-rose-500 text-white shadow-xs'
                    : isMidnightMode
                      ? 'bg-gradient-to-r from-[#700b34] to-[#6b21a8] text-white shadow-xs'
                      : 'bg-indigo-600 text-white shadow-xs'
              }`}>
                <Pencil className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-1.5">
                  <span>
                    {isHumorMode 
                      ? 'This joke needs some editing ✍️😂' 
                      : isLoveMode 
                        ? 'Whisper it sweeter 💌✨' 
                        : isMidnightMode
                          ? 'Whisper it darker 🍷🌚'
                          : 'Edit message ✏️'}
                  </span>
                  <span className="text-[10px] font-normal opacity-70 hidden sm:inline">(Enter to save, Esc to cancel)</span>
                </div>
                <p className="text-[11px] truncate max-w-sm opacity-80 mt-0.5">
                  {editingMessage.text}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Cancel editing"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Emoji picker drawer */}
        {showEmojiPicker && !isBlockedByMe && !hasBlockedMe && isFriend && (
          <div 
            className={`absolute bottom-full left-2 sm:left-4 mb-2 p-3 border rounded-2xl shadow-xl z-20 flex flex-wrap items-center gap-2 max-w-[calc(100vw-1.5rem)] sm:max-w-xs animate-in zoom-in-95 duration-150 ${
              isHumorMode
                ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800'
                : isLoveMode 
                  ? 'bg-white dark:bg-slate-900 border-pink-200 dark:border-pink-800' 
                  : isMidnightMode
                    ? 'bg-[#1c0216] border-purple-800 text-purple-200 shadow-purple-950/60'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            {activeQuickEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className={`text-xl p-1.5 rounded-xl transition-transform hover:scale-125 cursor-pointer ${
                  isMidnightMode ? 'hover:bg-purple-900/60' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {emoji}
              </button>
            ))}

            {/* + Button to open full emoji library modal */}
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker(false);
                setIsTextEmojiModalOpen(true);
              }}
              className={`w-8 h-8 rounded-xl border border-dashed flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                isMidnightMode
                  ? 'border-purple-700 text-purple-300 hover:text-white hover:border-purple-400'
                  : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400'
              }`}
              title="See all emojis (+)"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        )}

        <div className="p-3 sm:p-4">
          {isBlockedByMe ? (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold">
                <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>You have blocked {partnerName}. Unblock to send and receive messages.</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (partnerId) await unblockUser(currentUser.uid, partnerId);
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                Unblock Contact
              </button>
            </div>
          ) : hasBlockedMe ? (
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
              <Ban className="w-4 h-4 text-slate-400" />
              <span>You cannot send messages to this contact.</span>
            </div>
          ) : !isFriend ? (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Strangers cannot chat on subachat. You must be mutual friends to send messages.</span>
              </div>
              {friendship?.status === 'pending' && friendship.requesterId === currentUser.uid ? (
                <span className="px-3 py-1.5 bg-amber-200/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-xl font-bold">
                  Friend Request Pending
                </span>
              ) : friendship?.status === 'pending' && friendship.addresseeId === currentUser.uid ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (friendship) await acceptFriendRequest(friendship.id);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                >
                  Accept Friend Request
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (partnerId) await sendFriendRequest(currentUser.uid, partnerId);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Friend</span>
                </button>
              )}
            </div>
          ) : isRecordingVoice ? (
            /* Active Live Voice Recording Bar */
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/80 shadow-xs">
                {/* Pulsing red dot */}
                <div className="relative flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute" />
                  <div className="w-3 h-3 rounded-full bg-red-600 relative" />
                </div>

                {/* Duration timer */}
                <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400 min-w-[36px]">
                  {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60) < 10 ? '0' : ''}{recordingDuration % 60}
                </span>

                {/* Dynamic animated voice waveform */}
                <div className="flex-1 flex items-center justify-center gap-1.5 h-6">
                  {recordingAudioLevels.map((lvl, i) => (
                    <div
                      key={i}
                      style={{ height: `${Math.min(100, Math.max(25, lvl))}%` }}
                      className="w-1.5 bg-red-500 rounded-full transition-all duration-75"
                    />
                  ))}
                </div>

                <span className="text-[11px] font-medium text-red-500/90 hidden sm:inline">
                  Recording voice note...
                </span>
              </div>

              {/* Cancel Recording */}
              <button
                type="button"
                onClick={cancelVoiceRecording}
                className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                title="Discard voice recording"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              {/* Stop & Send Recording */}
              <button
                type="button"
                onClick={stopAndSendVoiceRecording}
                className={`p-2.5 active:scale-95 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center ${
                  isHumorMode
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-bold shadow-amber-400/30'
                    : isLoveMode
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 shadow-rose-500/25'
                      : isMidnightMode
                        ? 'bg-gradient-to-r from-[#700b34] to-[#6b21a8] shadow-purple-950/40 text-white font-bold'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
                title="Send voice message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          ) : (
            /* Standard Text & Voice Input Form */
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              {/* Emoji Drawer Toggle */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Emoji reactions"
                className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                  isHumorMode
                    ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                    : isLoveMode 
                      ? 'text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40' 
                      : isMidnightMode
                        ? 'text-purple-300 hover:text-purple-100 hover:bg-purple-900/50'
                        : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Text Input field */}
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && editingMessage) {
                    handleCancelEdit();
                  }
                }}
                placeholder={
                  editingMessage
                    ? isHumorMode
                      ? 'Improve this joke... 😂 (Enter to save, Esc to cancel)'
                      : isLoveMode
                        ? 'Whisper sweeter words... 💌 (Enter to save, Esc to cancel)'
                        : isMidnightMode
                          ? 'Whisper it darker... 🌚🍷 (Enter to save, Esc to cancel)'
                          : 'Edit your message... (Enter to save, Esc to cancel)'
                    : replyingToMessage
                      ? `Replying to ${replyingToMessage.senderName}...`
                      : isHumorMode
                        ? `Drop a funny joke or witty message... 😂`
                        : isLoveMode 
                          ? `Send some love to ${partnerName}... 💌`
                          : isMidnightMode
                            ? `Late night confessions or whispering dark secrets... 🌚🍷`
                            : `Message ${partnerName}... (Press Enter to send)`
                }
                className={`flex-1 py-2.5 px-4 rounded-2xl text-sm focus:outline-none transition-all ${
                  editingMessage
                    ? isHumorMode
                      ? 'bg-amber-100/70 dark:bg-amber-950/60 border-2 border-amber-500 text-slate-900 dark:text-white placeholder:text-amber-700/60 ring-2 ring-amber-400/20'
                      : isLoveMode
                        ? 'bg-pink-100/70 dark:bg-pink-950/60 border-2 border-rose-500 text-slate-900 dark:text-white placeholder:text-rose-600/60 ring-2 ring-rose-400/20'
                        : isMidnightMode
                          ? 'bg-[#24031e] border-2 border-purple-500 text-purple-100 placeholder:text-purple-400/60 ring-2 ring-purple-600/30'
                          : 'bg-indigo-50/70 dark:bg-indigo-950/60 border-2 border-indigo-500 text-slate-900 dark:text-white placeholder:text-indigo-400 ring-2 ring-indigo-400/20'
                    : isHumorMode
                      ? 'bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-900/60 text-slate-900 dark:text-white placeholder:text-amber-600/70 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                      : isLoveMode
                        ? 'bg-pink-50/70 dark:bg-pink-950/40 border border-pink-200/80 dark:border-pink-900/60 text-slate-900 dark:text-white placeholder:text-rose-400/70 focus:border-rose-400 focus:ring-1 focus:ring-rose-400'
                        : isMidnightMode
                          ? 'bg-[#21021b] border border-purple-800 text-purple-100 placeholder:text-purple-400/60 focus:border-purple-400 focus:ring-1 focus:ring-purple-400'
                          : 'bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-900 dark:text-white placeholder:text-slate-400'
                }`}
              />

              {/* Voice Message Record Button (hidden when editing) */}
              {!editingMessage && (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className={`p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0 ${
                    isHumorMode
                      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/60'
                      : isLoveMode
                        ? 'text-rose-500 dark:text-pink-400 hover:bg-rose-50 dark:hover:bg-rose-950/60'
                        : isMidnightMode
                          ? 'text-purple-300 hover:text-purple-100 hover:bg-purple-900/50'
                          : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800'
                  }`}
                  title="Hold or click to record voice message"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}

              {/* Send / Save Button */}
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className={`p-2.5 active:scale-95 text-white rounded-xl shadow-md disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  isHumorMode
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-bold shadow-amber-400/30'
                    : isLoveMode
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 shadow-rose-500/25'
                      : isMidnightMode
                        ? 'bg-gradient-to-r from-[#700b34] to-[#6b21a8] hover:from-[#881337] hover:to-[#7e22ce] text-white shadow-purple-950/40'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                }`}
                title={editingMessage ? 'Save changes' : 'Send Message'}
              >
                {editingMessage ? (
                  <span className="flex items-center gap-1 text-xs font-bold px-1.5">
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Save</span>
                  </span>
                ) : isHumorMode ? (
                  <span className="text-base">😂</span>
                ) : isLoveMode ? (
                  <Heart className="w-5 h-5 fill-white" />
                ) : isMidnightMode ? (
                  <span className="text-base">🌚</span>
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Full Emoji Picker Modal for Message Reactions */}
      <EmojiPickerModal
        isOpen={activeModalMessageId !== null}
        onClose={() => setActiveModalMessageId(null)}
        onSelectEmoji={(emoji) => {
          if (activeModalMessageId) {
            handleToggleReaction(activeModalMessageId, emoji);
          }
        }}
        mode={activeMode}
        title="React with Emoji"
      />

      {/* Full Emoji Picker Modal for Text Input Drawer */}
      <EmojiPickerModal
        isOpen={isTextEmojiModalOpen}
        onClose={() => setIsTextEmojiModalOpen(false)}
        onSelectEmoji={(emoji) => {
          addEmoji(emoji);
        }}
        mode={activeMode}
        title="Pick an Emoji"
      />

      {/* Unsend Confirmation Modal with Mood Vibe */}
      {messageToUnsend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className={`w-full max-w-sm rounded-3xl p-5 border shadow-2xl animate-in zoom-in-95 duration-150 ${
              isHumorMode
                ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800 text-slate-900 dark:text-amber-100 shadow-amber-500/10'
                : isLoveMode
                  ? 'bg-rose-50 dark:bg-rose-950 border-pink-200 dark:border-pink-800 text-slate-900 dark:text-pink-100 shadow-pink-500/10'
                  : isMidnightMode
                    ? 'bg-gradient-to-b from-[#24031f] to-[#140114] border-purple-800 text-purple-100 shadow-purple-950/60'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                isHumorMode 
                  ? 'bg-amber-200 dark:bg-amber-900/60' 
                  : isLoveMode 
                    ? 'bg-rose-200 dark:bg-rose-900/60' 
                    : isMidnightMode
                      ? 'bg-purple-900/60 text-purple-200 shadow-xs'
                      : 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
              }`}>
                {isHumorMode ? '🗑️' : isLoveMode ? '💔' : isMidnightMode ? '🌚' : <Trash2 className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  {isHumorMode 
                    ? 'This was a bad one, unsend it?' 
                    : isLoveMode 
                      ? 'Take back my heart flutter?' 
                      : isMidnightMode
                        ? 'Too scandalous, unsend it?'
                        : 'Unsend message?'}
                </h3>
                <p className={`text-xs mt-0.5 ${isMidnightMode ? 'text-purple-300/80' : 'opacity-75'}`}>
                  {isHumorMode
                    ? 'Even the best comedians drop a bad one sometimes! This joke will vanish for both of you.'
                    : isLoveMode
                      ? 'Take back this sweet flutter? It will be gently erased from the chat.'
                      : isMidnightMode
                        ? 'Take back this midnight secret? It will vanish into the shadows like it never happened.'
                        : 'This message will be permanently removed for everyone in this chat.'}
                </p>
              </div>
            </div>

            {/* Message preview snippet */}
            <div className={`p-2.5 rounded-xl text-xs mb-4 border truncate font-normal ${
              isHumorMode
                ? 'bg-white/70 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                : isLoveMode
                  ? 'bg-white/70 dark:bg-pink-900/40 border-pink-200 dark:border-pink-800 text-rose-950 dark:text-pink-200'
                  : isMidnightMode
                    ? 'bg-[#2e0427]/80 border-purple-800 text-purple-200'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              <span className="font-semibold mr-1">Message:</span>
              <span>{messageToUnsend.text}</span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMessageToUnsend(null)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isMidnightMode ? 'text-purple-300 hover:bg-purple-900/40 hover:text-purple-100' : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {isHumorMode ? 'Keep this joke' : isLoveMode ? 'Keep it 💕' : isMidnightMode ? 'Keep it spicy 🍷' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmUnsend}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-95 cursor-pointer ${
                  isHumorMode
                    ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-slate-950 font-extrabold shadow-amber-600/30'
                    : isLoveMode
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-rose-500/25'
                      : isMidnightMode
                        ? 'bg-gradient-to-r from-[#700b34] to-[#6b21a8] hover:from-[#881337] hover:to-[#7e22ce] text-white shadow-purple-950/40'
                        : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                }`}
              >
                {isHumorMode 
                  ? 'This was a bad one, unsend it 💨' 
                  : isLoveMode 
                    ? 'Take back my heart flutter 💨' 
                    : isMidnightMode
                      ? 'Too scandalous, unsend it 💨'
                      : 'Unsend message'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Whole Conversation Confirmation Modal */}
      {showDeleteConversationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className={`w-full max-w-sm rounded-3xl p-5 border shadow-2xl animate-in zoom-in-95 duration-150 ${
              isHumorMode
                ? 'bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800 text-slate-900 dark:text-amber-100 shadow-amber-500/10'
                : isLoveMode
                  ? 'bg-rose-50 dark:bg-rose-950 border-pink-200 dark:border-pink-800 text-slate-900 dark:text-pink-100 shadow-pink-500/10'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xl shrink-0">
                <Trash2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete Conversation?
                </h3>
                <p className="text-xs opacity-75 mt-0.5">
                  Chat with <strong className="font-semibold">{partnerName}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Are you sure you want to delete this whole conversation? All messages, voice notes, and media will be permanently deleted for both of you. This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingConversation}
                onClick={() => setShowDeleteConversationModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingConversation}
                onClick={handleDeleteConversation}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 shadow-md shadow-rose-600/25 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {deletingConversation ? (
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

    </div>
  );
};
