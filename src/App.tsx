import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/AuthView';
import { Sidebar } from './components/Sidebar';
import { ActiveChat } from './components/ActiveChat';
import { EmptyChatState } from './components/EmptyChatState';
import { NewChatModal } from './components/NewChatModal';
import { GmailDrawer } from './components/GmailDrawer';
import { EditProfileModal } from './components/EditProfileModal';
import { MessageSquare, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, sendChatMessage } from './lib/firebase';
import { ChatRoom } from './types';

function ChatDashboard({
  isDark,
  onToggleTheme,
}: {
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  const { userProfile, logout } = useAuth();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isGmailOpen, setIsGmailOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [gmailPreFillEmail, setGmailPreFillEmail] = useState<string | undefined>(undefined);
  const [activePartnerEmail, setActivePartnerEmail] = useState<string | undefined>(undefined);

  // Sync partner email from active chat
  useEffect(() => {
    if (!activeChatId || !userProfile) {
      setActivePartnerEmail(undefined);
      return;
    }

    async function loadChatPartner() {
      if (!activeChatId) return;
      try {
        const snap = await getDoc(doc(db, 'chats', activeChatId));
        if (snap.exists()) {
          const chatData = snap.data() as ChatRoom;
          const otherId = chatData.participants.find((p) => p !== userProfile?.uid);
          if (otherId && chatData.participantDetails?.[otherId]) {
            setActivePartnerEmail(chatData.participantDetails[otherId].email);
          }
        }
      } catch {
        // Handled silently
      }
    }

    loadChatPartner();
  }, [activeChatId, userProfile]);

  const handleShareEmailToChat = async (shareText: string) => {
    if (!activeChatId || !userProfile) return;
    try {
      const snap = await getDoc(doc(db, 'chats', activeChatId));
      if (snap.exists()) {
        const chatData = snap.data() as ChatRoom;
        const otherId = chatData.participants.find((p) => p !== userProfile.uid);
        if (otherId) {
          await sendChatMessage(activeChatId, userProfile.uid, otherId, shareText);
        }
      }
    } catch (e) {
      console.error('Error sharing email to chat:', e);
    }
  };

  if (!userProfile) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-3" />
        <p className="text-sm font-semibold">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* Sidebar: Left Side */}
      <div
        className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${
          activeChatId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <Sidebar
          currentUser={userProfile}
          activeChatId={activeChatId}
          onSelectChat={(chatId) => setActiveChatId(chatId)}
          onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
          onOpenGmail={() => {
            setGmailPreFillEmail(activePartnerEmail);
            setIsGmailOpen(true);
          }}
          onOpenEditProfile={() => setIsEditProfileOpen(true)}
          onLogout={logout}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
        />
      </div>

      {/* Main Active Chat Area: Right Side */}
      <main
        className={`flex-1 h-full overflow-hidden ${
          !activeChatId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeChatId ? (
          <ActiveChat
            chatId={activeChatId}
            currentUser={userProfile}
            onBack={() => setActiveChatId(null)}
            onOpenGmail={(email) => {
              setGmailPreFillEmail(email || activePartnerEmail);
              setIsGmailOpen(true);
            }}
          />
        ) : (
          <EmptyChatState
            currentUser={userProfile}
            onOpenNewChat={() => setIsNewChatModalOpen(true)}
          />
        )}
      </main>

      {/* Modal for creating a new chat / searching user directory */}
      <NewChatModal
        currentUser={userProfile}
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onSelectChat={(chatId) => {
          setActiveChatId(chatId);
          setIsNewChatModalOpen(false);
        }}
      />

      {/* Edit Profile & Photo Upload Modal */}
      <EditProfileModal
        currentUser={userProfile}
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />

      {/* Gmail Workspace Drawer */}
      <GmailDrawer
        isOpen={isGmailOpen}
        onClose={() => setIsGmailOpen(false)}
        activeChatPartnerEmail={gmailPreFillEmail}
        onShareToChat={activeChatId ? handleShareEmailToChat : undefined}
      />

    </div>
  );
}

function MainApp() {
  const { currentUser, loading } = useAuth();
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('subachat_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('subachat_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('subachat_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 mb-4 animate-bounce">
          <MessageSquare className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
          Connecting to subachat...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView isDark={isDark} onToggleTheme={toggleTheme} />;
  }

  return <ChatDashboard isDark={isDark} onToggleTheme={toggleTheme} />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
