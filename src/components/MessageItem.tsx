import React, { useState, useRef } from 'react';
import { 
  Reply, 
  SmilePlus, 
  CornerUpLeft, 
  Check, 
  CheckCheck, 
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2
} from 'lucide-react';
import { ChatMessage } from '../types';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';

interface MessageItemProps {
  msg: ChatMessage;
  index: number;
  isMe: boolean;
  isHumorMode: boolean;
  isLoveMode: boolean;
  isMidnightMode: boolean;
  activeReactionEmojis: string[];
  reactionMenuMsgId: string | null;
  setReactionMenuMsgId: (id: string | null) => void;
  setActiveModalMessageId: (id: string | null) => void;
  handleToggleReaction: (msgId: string, emoji: string) => void;
  handleStartReply: (msg: ChatMessage) => void;
  formatMsgTime: (ts: any) => string;
  getGroupedReactions: (reactions?: Record<string, string>) => Array<{ emoji: string; count: number; hasReacted: boolean }>;
  onEditMessage: (msg: ChatMessage) => void;
  onUnsendMessage: (msg: ChatMessage) => void;
  desktopMenuMsgId: string | null;
  setDesktopMenuMsgId: (id: string | null) => void;
}

const MessageItemComponent: React.FC<MessageItemProps> = ({
  msg,
  index,
  isMe,
  isHumorMode,
  isLoveMode,
  isMidnightMode,
  activeReactionEmojis,
  reactionMenuMsgId,
  setReactionMenuMsgId,
  setActiveModalMessageId,
  handleToggleReaction,
  handleStartReply,
  formatMsgTime,
  getGroupedReactions,
  onEditMessage,
  onUnsendMessage,
  desktopMenuMsgId,
  setDesktopMenuMsgId,
}) => {
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isTouching, setIsTouching] = useState<boolean>(false);
  const [isThresholdReached, setIsThresholdReached] = useState<boolean>(false);

  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const hasTriggeredHapticRef = useRef<boolean>(false);
  const isLongPressTriggeredRef = useRef<boolean>(false);

  const SWIPE_THRESHOLD = 50;
  const MAX_SWIPE = 75;

  // Mood-matched text vibe configuration
  const getVibeConfig = () => {
    if (isHumorMode) {
      return {
        editLabel: 'This joke needs some editing',
        editEmoji: '✍️😂',
        unsendLabel: 'This was a bad one, unsend it',
        unsendEmoji: '🗑️💀',
        editedBadge: '(fine-tuned joke 😂)',
        dropdownBg: 'bg-white dark:bg-amber-950/95 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100',
        itemHover: 'hover:bg-amber-100/80 dark:hover:bg-amber-900/60',
        dangerHover: 'hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400',
      };
    }
    if (isLoveMode) {
      return {
        editLabel: 'Whisper it sweeter',
        editEmoji: '💌✨',
        unsendLabel: 'Take back my heart flutter',
        unsendEmoji: '💔💨',
        editedBadge: '(whispered sweeter 💕)',
        dropdownBg: 'bg-white dark:bg-pink-950/95 border-pink-200 dark:border-pink-800 text-rose-950 dark:text-pink-100',
        itemHover: 'hover:bg-pink-100/80 dark:hover:bg-pink-900/60',
        dangerHover: 'hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400',
      };
    }
    if (isMidnightMode) {
      return {
        editLabel: 'Whisper it darker',
        editEmoji: '🍷🌚',
        unsendLabel: 'Too scandalous, unsend it',
        unsendEmoji: '🌚💨',
        editedBadge: '(whispered darker 🌚)',
        dropdownBg: 'bg-[#1c0215] dark:bg-[#140110] border-purple-800/90 text-purple-100 shadow-purple-950/60',
        itemHover: 'hover:bg-purple-900/60 text-purple-100',
        dangerHover: 'hover:bg-rose-950/70 text-rose-300',
      };
    }
    return {
      editLabel: 'Edit message',
      editEmoji: '✏️',
      unsendLabel: 'Unsend message',
      unsendEmoji: '🗑️',
      editedBadge: '(edited)',
      dropdownBg: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100',
      itemHover: 'hover:bg-slate-100 dark:hover:bg-slate-800',
      dangerHover: 'hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400',
    };
  };

  const vibeConfig = getVibeConfig();

  // Touch handlers for mobile hold-to-react & slide-to-reply
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Don't trigger swipe/longpress if interacting with specific buttons or player controls
    if (target.closest('button, [data-interactive="true"]')) {
      return;
    }

    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    isHorizontalSwipeRef.current = null;
    hasTriggeredHapticRef.current = false;
    isLongPressTriggeredRef.current = false;
    setIsTouching(true);

    // 1. Long-press timer (hold to open fast react & edit/unsend section)
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setReactionMenuMsgId(msg.id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(45);
        } catch {}
      }
    }, 420);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;
    const totalDist = Math.hypot(deltaX, deltaY);

    // If moved more than 8px, cancel long-press
    if (totalDist > 8 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // If long press already fired, do not swipe
    if (isLongPressTriggeredRef.current) {
      return;
    }

    // Determine swipe axis on first movement
    if (isHorizontalSwipeRef.current === null && totalDist > 8) {
      if (Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
        isHorizontalSwipeRef.current = true;
      } else {
        isHorizontalSwipeRef.current = false;
      }
    }

    // If vertical scrolling, let browser handle normal scroll
    if (isHorizontalSwipeRef.current === false) {
      return;
    }

    // Sliding toward the middle of the chat:
    const pullTowardsMiddle = isMe ? -deltaX : deltaX;

    if (pullTowardsMiddle > 0) {
      const damped = Math.min(MAX_SWIPE, Math.pow(pullTowardsMiddle, 0.86) * 1.6);
      const visualOffset = isMe ? -damped : damped;
      setSwipeOffset(visualOffset);

      const reached = pullTowardsMiddle >= SWIPE_THRESHOLD;
      setIsThresholdReached(reached);

      if (reached && !hasTriggeredHapticRef.current) {
        hasTriggeredHapticRef.current = true;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(30);
          } catch {}
        }
      } else if (!reached) {
        hasTriggeredHapticRef.current = false;
      }
    } else {
      setSwipeOffset(0);
      setIsThresholdReached(false);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    setIsTouching(false);

    // If swiped toward middle past threshold, trigger reply!
    if (isThresholdReached && !isLongPressTriggeredRef.current) {
      handleStartReply(msg);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([15, 30, 20]);
        } catch {}
      }
    }

    // Spring back to center
    setSwipeOffset(0);
    setIsThresholdReached(false);
    isHorizontalSwipeRef.current = null;
    hasTriggeredHapticRef.current = false;
  };

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsTouching(false);
    setSwipeOffset(0);
    setIsThresholdReached(false);
    isHorizontalSwipeRef.current = null;
  };

  const groupedReactions = getGroupedReactions(msg.reactions);
  const pullProgress = Math.min(1, Math.abs(swipeOffset) / SWIPE_THRESHOLD);

  return (
    <div
      id={`msg-${msg.id}`}
      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group mb-1.5 transition-all relative select-none sm:select-auto`}
    >
      {/* Outer row with relative positioning for gesture icon & slide */}
      <div className={`relative flex items-center w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
        
        {/* Reply Indicator Icon that reveals behind the sliding message */}
        <div 
          className={`absolute z-0 flex items-center pointer-events-none transition-all duration-75 ${
            isMe ? 'right-2 flex-row-reverse' : 'left-2 flex-row'
          } ${Math.abs(swipeOffset) > 8 ? 'opacity-100' : 'opacity-0'}`}
          style={{
            transform: `scale(${0.4 + pullProgress * 0.7})`,
          }}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${
              isThresholdReached
                ? isHumorMode
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 scale-110 shadow-amber-400/40'
                  : isLoveMode
                    ? 'bg-rose-500 text-white ring-2 ring-pink-300 scale-110 shadow-rose-500/40'
                    : 'bg-indigo-600 text-white ring-2 ring-indigo-300 scale-110 shadow-indigo-600/40'
                : 'bg-slate-200/90 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <Reply className="w-4 h-4" />
          </div>
          {isThresholdReached && (
            <span 
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md mx-1 animate-in fade-in duration-150 ${
                isHumorMode
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200'
                  : isLoveMode
                    ? 'bg-pink-100 dark:bg-pink-950/80 text-rose-700 dark:text-rose-200'
                    : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-200'
              }`}
            >
              Reply
            </span>
          )}
        </div>

        {/* Sliding Message Container */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          style={{
            transform: `translate3d(${swipeOffset}px, 0, 0)`,
            transition: isTouching ? 'none' : 'transform 0.24s cubic-bezier(0.175, 0.885, 0.32, 1.25)',
            touchAction: 'pan-y',
            willChange: isTouching ? 'transform' : 'auto',
          }}
          className={`relative z-10 flex items-center gap-2 max-w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
        >
          {/* Floating Reaction Bar & Mobile Hold Quick-Menu */}
          {reactionMenuMsgId === msg.id && (
            <div 
              data-reaction-menu="true"
              className={`absolute z-30 -top-12 ${
                isMe ? 'right-0' : 'left-0'
              } flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-2xl animate-in zoom-in-95 duration-150 min-w-[210px] sm:min-w-0`}
            >
              {/* Top Row: Emojis */}
              <div className="flex items-center gap-1 justify-between px-1">
                {activeReactionEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    data-interactive="true"
                    onClick={() => handleToggleReaction(msg.id, emoji)}
                    className="text-lg p-1 hover:scale-130 active:scale-95 transition-transform cursor-pointer"
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}

                {/* + button to view all categorized emojis */}
                <button
                  type="button"
                  data-interactive="true"
                  onClick={() => {
                    setReactionMenuMsgId(null);
                    setActiveModalMessageId(msg.id);
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-110 active:scale-95 cursor-pointer border border-slate-200/80 dark:border-slate-700/80 shrink-0"
                  title="See all emojis (+)"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>

              {/* Sender Actions for Mobile Hold: Edit & Unsend with mood vibe */}
              {isMe && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-0.5">
                  {!msg.audioUrl && (
                    <button
                      type="button"
                      data-interactive="true"
                      onClick={() => {
                        setReactionMenuMsgId(null);
                        onEditMessage(msg);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${vibeConfig.itemHover}`}
                    >
                      <span className="text-sm shrink-0">{vibeConfig.editEmoji}</span>
                      <span className="truncate">{vibeConfig.editLabel}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    data-interactive="true"
                    onClick={() => {
                      setReactionMenuMsgId(null);
                      onUnsendMessage(msg);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${vibeConfig.dangerHover}`}
                  >
                    <span className="text-sm shrink-0">{vibeConfig.unsendEmoji}</span>
                    <span className="truncate">{vibeConfig.unsendLabel}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Humor Mode Animated Laugh Emoji Next to Message */}
          {isHumorMode && (
            <div 
              className="select-none text-xl sm:text-2xl animate-bounce [animation-duration:2.5s] shrink-0" 
              title="Humor Mode active 😂"
            >
              {index % 2 === 0 ? '😂' : '🤣'}
            </div>
          )}

          {/* Midnight Mode Animated Sultry Emoji Next to Message */}
          {isMidnightMode && (
            <div 
              className="select-none text-xl sm:text-2xl animate-pulse [animation-duration:2s] shrink-0" 
              title="Midnight Mode active 🌚"
            >
              {index % 2 === 0 ? '🌚' : '👄'}
            </div>
          )}

          {/* Bubble */}
          <div
            className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-sm break-words shadow-xs transition-all ${
              isMe
                ? isHumorMode
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-medium shadow-md shadow-amber-400/20 rounded-br-xs'
                  : isLoveMode
                    ? 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 text-white shadow-md shadow-rose-500/20 rounded-br-xs'
                    : isMidnightMode
                      ? 'bg-gradient-to-r from-[#700b34] via-[#881337] to-[#581c87] text-white shadow-md shadow-purple-950/40 rounded-br-xs'
                      : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs'
                : isHumorMode
                  ? 'bg-white/95 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800/80 text-slate-900 dark:text-amber-100 rounded-bl-xs shadow-sm'
                  : isLoveMode
                    ? 'bg-white/95 dark:bg-pink-950/70 border border-pink-200/90 dark:border-pink-800/80 text-rose-950 dark:text-pink-100 rounded-bl-xs shadow-sm'
                    : isMidnightMode
                      ? 'bg-white/95 dark:bg-[#1f031b]/95 border border-purple-300/80 dark:border-purple-900/90 text-purple-950 dark:text-purple-100 rounded-bl-xs shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-bl-xs'
            }`}
          >
            {/* Quoted Replied-To Message */}
            {msg.replyTo && (
              <div 
                data-interactive="true"
                onClick={() => {
                  const target = document.getElementById(`msg-${msg.replyTo?.messageId}`);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                    const ringColor = isHumorMode ? 'ring-amber-400' : isLoveMode ? 'ring-pink-400' : isMidnightMode ? 'ring-purple-400' : 'ring-indigo-400';
                    target.classList.add('ring-2', ringColor, 'rounded-2xl');
                    setTimeout(() => target.classList.remove('ring-2', ringColor, 'rounded-2xl'), 1500);
                  }
                }}
                className={`mb-2 p-2 rounded-xl text-xs border-l-4 cursor-pointer transition-all ${
                  isMe
                    ? isHumorMode 
                      ? 'bg-amber-500/25 border-slate-900 text-slate-950'
                      : isLoveMode 
                        ? 'bg-white/20 border-white text-white' 
                        : isMidnightMode
                          ? 'bg-white/15 border-white text-white'
                          : 'bg-black/15 border-white text-white'
                    : isHumorMode
                      ? 'bg-amber-100/80 dark:bg-amber-900/40 border-amber-500 text-amber-950 dark:text-amber-200'
                      : isLoveMode
                        ? 'bg-pink-100/70 dark:bg-pink-900/40 border-pink-500 text-rose-950 dark:text-pink-200'
                        : isMidnightMode
                          ? 'bg-purple-100/70 dark:bg-purple-950/70 border-purple-500 text-purple-950 dark:text-purple-200'
                          : 'bg-slate-100 dark:bg-slate-800 border-indigo-500 text-slate-700 dark:text-slate-300'
                }`}
                title="Click to jump to quoted message"
              >
                <div className="font-bold flex items-center gap-1 text-[11px] opacity-90">
                  <CornerUpLeft className="w-3 h-3" />
                  <span>{msg.replyTo.senderName}</span>
                </div>
                <p className="truncate text-[11px] opacity-80 mt-0.5 font-normal">
                  {msg.replyTo.text}
                </p>
              </div>
            )}

            {/* Voice Message Audio Player OR Regular Text */}
            {msg.audioUrl ? (
              <div data-interactive="true">
                <VoiceMessagePlayer
                  audioUrl={msg.audioUrl}
                  duration={msg.audioDuration}
                  isMe={isMe}
                  isHumorMode={isHumorMode}
                  isLoveMode={isLoveMode}
                  isMidnightMode={isMidnightMode}
                />
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed selection:bg-white/30">
                {msg.text}
              </p>
            )}

            <div
              className={`flex items-center justify-end gap-1 text-[10px] mt-1 font-medium select-none ${
                isMe 
                  ? isHumorMode ? 'text-amber-900' : isLoveMode ? 'text-pink-100' : isMidnightMode ? 'text-purple-200' : 'text-indigo-200'
                  : isHumorMode ? 'text-amber-700 dark:text-amber-400' : isLoveMode ? 'text-rose-400' : isMidnightMode ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'
              }`}
            >
              {/* Mood-matched Edited Badge */}
              {msg.isEdited && (
                <span 
                  className={`text-[9px] font-medium mr-0.5 opacity-90 ${
                    isMe
                      ? isHumorMode ? 'text-amber-950 font-semibold' : isLoveMode ? 'text-pink-100' : isMidnightMode ? 'text-purple-200 font-semibold' : 'text-indigo-100'
                      : isHumorMode ? 'text-amber-800 dark:text-amber-300' : isLoveMode ? 'text-rose-500 dark:text-pink-300' : isMidnightMode ? 'text-purple-700 dark:text-purple-300' : 'text-slate-500 dark:text-slate-400'
                  }`}
                  title="Message was edited"
                >
                  {vibeConfig.editedBadge}
                </span>
              )}

              <span>{formatMsgTime(msg.timestamp)}</span>
              {isMe && (
                <span>
                  {msg.read ? (
                    <CheckCheck className={`w-3.5 h-3.5 inline ${
                      isHumorMode ? 'text-slate-900 font-bold' : isLoveMode ? 'text-white' : isMidnightMode ? 'text-purple-200 font-bold' : 'text-emerald-300'
                    }`} />
                  ) : (
                    <Check className={`w-3.5 h-3.5 inline ${
                      isHumorMode ? 'text-amber-800' : isLoveMode ? 'text-pink-200' : isMidnightMode ? 'text-purple-300' : 'text-indigo-300'
                    }`} />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons: Reply, React, and Desktop 3-dots Menu (...) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
            {/* Reply Button */}
            <button
              type="button"
              data-interactive="true"
              onClick={() => handleStartReply(msg)}
              title="Reply to this message"
              className="p-1.5 rounded-full text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Reply className="w-4 h-4" />
            </button>

            {/* Reaction Trigger Button */}
            <button
              type="button"
              data-interactive="true"
              onClick={() => setReactionMenuMsgId(reactionMenuMsgId === msg.id ? null : msg.id)}
              title="Add emoji reaction"
              className="p-1.5 rounded-full text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <SmilePlus className="w-4 h-4" />
            </button>

            {/* Desktop 3-dots Menu (...) for Sender */}
            {isMe && (
              <div className="relative" data-desktop-menu="true">
                <button
                  type="button"
                  data-interactive="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDesktopMenuMsgId(desktopMenuMsgId === msg.id ? null : msg.id);
                  }}
                  title="More options (edit, unsend)"
                  className="p-1.5 rounded-full text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {desktopMenuMsgId === msg.id && (
                  <div
                    className={`absolute z-40 top-full mt-1 ${
                      isMe ? 'right-0' : 'left-0'
                    } w-60 py-1.5 px-1 border rounded-2xl shadow-2xl animate-in zoom-in-95 duration-150 ${vibeConfig.dropdownBg}`}
                  >
                    {!msg.audioUrl && (
                      <button
                        type="button"
                        data-interactive="true"
                        onClick={() => {
                          setDesktopMenuMsgId(null);
                          onEditMessage(msg);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${vibeConfig.itemHover}`}
                      >
                        <span className="text-base shrink-0">{vibeConfig.editEmoji}</span>
                        <span className="truncate">{vibeConfig.editLabel}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      data-interactive="true"
                      onClick={() => {
                        setDesktopMenuMsgId(null);
                        onUnsendMessage(msg);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${vibeConfig.dangerHover}`}
                    >
                      <span className="text-base shrink-0">{vibeConfig.unsendEmoji}</span>
                      <span className="truncate">{vibeConfig.unsendLabel}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Displayed Reaction Pills */}
      {groupedReactions.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 px-1 z-10 ${isMe ? 'justify-end' : 'justify-start'}`}>
          {groupedReactions.map((g) => (
            <button
              key={g.emoji}
              type="button"
              data-interactive="true"
              onClick={() => handleToggleReaction(msg.id, g.emoji)}
              title={
                g.hasReacted
                  ? `You reacted with ${g.emoji} (click to remove)`
                  : `Click to react with ${g.emoji}`
              }
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                g.hasReacted
                  ? isHumorMode
                    ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-400 text-amber-900 dark:text-amber-200 shadow-xs'
                    : isLoveMode
                      ? 'bg-rose-100 dark:bg-rose-950/80 border-rose-400 text-rose-700 dark:text-rose-300 shadow-xs'
                      : isMidnightMode
                        ? 'bg-purple-100 dark:bg-purple-950/80 border-purple-500 text-purple-900 dark:text-purple-200 shadow-xs'
                        : 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-400 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <span>{g.emoji}</span>
              <span className="text-[10px]">{g.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const MessageItem = React.memo(MessageItemComponent, (prev, next) => {
  // Check if reaction popup state changed for this message
  const prevIsMenuOpen = prev.reactionMenuMsgId === prev.msg.id;
  const nextIsMenuOpen = next.reactionMenuMsgId === next.msg.id;
  if (prevIsMenuOpen !== nextIsMenuOpen) return false;

  // Check if desktop menu state changed
  const prevIsDesktopOpen = prev.desktopMenuMsgId === prev.msg.id;
  const nextIsDesktopOpen = next.desktopMenuMsgId === next.msg.id;
  if (prevIsDesktopOpen !== nextIsDesktopOpen) return false;

  // Check critical message properties
  if (prev.msg.id !== next.msg.id) return false;
  if (prev.msg.text !== next.msg.text) return false;
  if (prev.msg.isEdited !== next.msg.isEdited) return false;
  if (prev.msg.read !== next.msg.read) return false;
  if (prev.msg.audioUrl !== next.msg.audioUrl) return false;
  if (prev.msg.audioDuration !== next.msg.audioDuration) return false;
  if (prev.isHumorMode !== next.isHumorMode) return false;
  if (prev.isLoveMode !== next.isLoveMode) return false;
  if (prev.isMidnightMode !== next.isMidnightMode) return false;
  if (prev.isMe !== next.isMe) return false;

  // Check reactions equality
  const prevR = prev.msg.reactions;
  const nextR = next.msg.reactions;
  if (prevR !== nextR) {
    if (!prevR || !nextR) return false;
    const prevKeys = Object.keys(prevR);
    const nextKeys = Object.keys(nextR);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of prevKeys) {
      if (prevR[key] !== nextR[key]) return false;
    }
  }

  // Check reply quote
  if (prev.msg.replyTo?.messageId !== next.msg.replyTo?.messageId) return false;

  return true;
});
