import React, { useState, useMemo } from 'react';
import { X, Search, Sparkles, Heart, Laugh, Moon } from 'lucide-react';
import { getOrderedEmojis, EMOJI_CATEGORIES, ChatMoodMode } from '../data/emojis';

interface EmojiPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  mode: ChatMoodMode;
  title?: string;
}

export const EmojiPickerModal: React.FC<EmojiPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  mode,
  title = 'Pick an Emoji',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const orderedEmojis = useMemo(() => {
    return getOrderedEmojis(mode);
  }, [mode]);

  const displayedEmojis = useMemo(() => {
    let list = orderedEmojis;

    if (selectedCategory !== 'all') {
      const cat = EMOJI_CATEGORIES.find((c) => c.id === selectedCategory);
      if (cat) {
        const catSet = new Set(cat.emojis);
        list = orderedEmojis.filter((e) => catSet.has(e));
      }
    }

    if (searchTerm.trim()) {
      // In case user searches specific emoji or character
      const term = searchTerm.trim().toLowerCase();
      list = list.filter((e) => e.includes(term));
    }

    return list;
  }, [orderedEmojis, selectedCategory, searchTerm]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm sm:max-w-md rounded-2xl shadow-2xl border flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-150 ${
          mode === 'humor'
            ? 'bg-amber-50/95 dark:bg-slate-900 border-amber-300 dark:border-amber-800'
            : mode === 'love'
              ? 'bg-rose-50/95 dark:bg-slate-900 border-rose-200 dark:border-rose-900'
              : mode === 'midnight'
                ? 'bg-gradient-to-b from-[#1f031b] to-[#120015] border-purple-800/80 text-purple-100 shadow-purple-950/50'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'humor' ? (
              <Laugh className="w-5 h-5 text-amber-500 animate-bounce" />
            ) : mode === 'love' ? (
              <Heart className="w-5 h-5 text-rose-500 animate-pulse fill-rose-500" />
            ) : mode === 'midnight' ? (
              <div className="flex items-center gap-1">
                <Moon className="w-5 h-5 text-purple-400 fill-purple-400/30 animate-pulse" />
                <span className="text-base">🌚</span>
              </div>
            ) : (
              <Sparkles className="w-5 h-5 text-indigo-500" />
            )}
            <h3 className={`font-bold text-sm ${mode === 'midnight' ? 'text-purple-100' : 'text-slate-800 dark:text-slate-100'}`}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              mode === 'midnight'
                ? 'text-purple-300 hover:text-purple-100 hover:bg-purple-900/50'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Hint Banner */}
        {mode !== 'normal' && (
          <div className={`px-4 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 border-b ${
            mode === 'humor'
              ? 'bg-amber-100/80 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900/60'
              : mode === 'love'
                ? 'bg-rose-100/70 dark:bg-rose-950/70 text-rose-900 dark:text-pink-200 border-pink-200 dark:border-pink-900/60'
                : 'bg-gradient-to-r from-[#4a0421]/90 to-[#3b0764]/90 text-purple-200 border-purple-800/60'
          }`}>
            <span>
              {mode === 'humor'
                ? '😂 Humor Mode: Laugh & funny emojis shown first!'
                : mode === 'love'
                  ? '💖 Love Mode: Romantic & heart emojis shown first!'
                  : '🌚 Midnight Mode: Sultry, late-night & spicy emojis shown first! 👄🍷'}
            </span>
          </div>
        )}

        {/* Search Input */}
        <div className="p-3 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter emojis..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-xl outline-hidden focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        {/* Categories Bar */}
        <div className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs ${
          mode === 'midnight' ? 'border-purple-900/60' : 'border-slate-200/60 dark:border-slate-800/60'
        }`}>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? mode === 'humor'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : mode === 'love'
                    ? 'bg-rose-500 text-white font-bold'
                    : mode === 'midnight'
                      ? 'bg-gradient-to-r from-[#831843] to-[#6b21a8] text-white font-bold shadow-xs'
                      : 'bg-indigo-600 text-white font-bold'
                : mode === 'midnight'
                  ? 'text-purple-300 hover:bg-purple-950/70 hover:text-purple-100'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Emojis
          </button>
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? mode === 'humor'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : mode === 'love'
                      ? 'bg-rose-500 text-white font-bold'
                      : mode === 'midnight'
                        ? 'bg-gradient-to-r from-[#831843] to-[#6b21a8] text-white font-bold shadow-xs'
                        : 'bg-indigo-600 text-white font-bold'
                  : mode === 'midnight'
                    ? 'text-purple-300 hover:bg-purple-950/70 hover:text-purple-100'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Emoji Grid */}
        <div className="p-3 overflow-y-auto flex-1 max-h-[340px] grid grid-cols-6 sm:grid-cols-8 gap-2 scrollbar-thin">
          {displayedEmojis.length === 0 ? (
            <div className={`col-span-full py-8 text-center text-xs ${mode === 'midnight' ? 'text-purple-400' : 'text-slate-400'}`}>
              No emojis found
            </div>
          ) : (
            displayedEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                type="button"
                onClick={() => {
                  onSelectEmoji(emoji);
                  onClose();
                }}
                className={`text-2xl p-1.5 rounded-xl hover:scale-125 active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
                  mode === 'humor'
                    ? 'hover:bg-amber-200/60 dark:hover:bg-amber-900/40'
                    : mode === 'love'
                      ? 'hover:bg-pink-100 dark:hover:bg-rose-950/50'
                      : mode === 'midnight'
                        ? 'hover:bg-purple-900/60 hover:shadow-xs'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={`Select ${emoji}`}
              >
                {emoji}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
