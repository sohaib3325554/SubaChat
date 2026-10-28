import React from 'react';
import { MessageSquare, MessageSquarePlus, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { UserProfile } from '../types';

interface EmptyChatStateProps {
  currentUser: UserProfile;
  onOpenNewChat: () => void;
}

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({
  currentUser,
  onOpenNewChat,
}) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50/50 dark:bg-slate-950/50 transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 shadow-xl shadow-indigo-500/5">
        
        {/* Main Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white mx-auto mb-5 shadow-lg shadow-indigo-500/25">
          <MessageSquare className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Welcome to subachat, {currentUser.displayName}!
        </h2>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          Select a conversation from the sidebar or initiate a new 1-on-1 chat by searching a friend&apos;s email address.
        </p>

        {/* Action Button */}
        <button
          onClick={onOpenNewChat}
          className="mt-6 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-indigo-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>Start a New Conversation</span>
        </button>

        {/* Features Highlights */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 text-left">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <Zap className="w-4 h-4 text-amber-500 mb-1" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Instant Sync
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live updates with Firestore WebSockets
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-500 mb-1" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Presence & Typing
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live typing indicators & read status
            </p>
          </div>
        </div>

        {/* Tip for testing 2 users in split screen */}
        <div className="mt-4 p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-700 dark:text-indigo-300">
          💡 <strong>Tip:</strong> Open another browser tab in Incognito, log in with a Demo account, and test real-time chat side-by-side!
        </div>

      </div>
    </div>
  );
};
