import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { 
  MessageSquare, 
  Mail, 
  Lock, 
  User, 
  Sparkles, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Users,
  Upload,
  Camera
} from 'lucide-react';
import { compressAndResizeImage } from '../lib/firebase';

const PRESET_AVATARS = [
  { id: '1', label: 'Cyber Fox', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=b6e3f4' },
  { id: '2', label: 'Cosmic Bear', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Nova&backgroundColor=c0aede' },
  { id: '3', label: 'Pixel Cat', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Milo&backgroundColor=d1d4f9' },
  { id: '4', label: 'Spark Bot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Spark&backgroundColor=ffd5dc' },
  { id: '5', label: 'Astro Pup', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Luna&backgroundColor=ffdfbf' },
  { id: '6', label: 'Glitch Owl', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Echo&backgroundColor=b6e3f4' },
];

const DEMO_ACCOUNTS = [
  {
    name: 'Alex Rivera',
    email: 'alex@subachat.demo',
    pass: 'DemoPass123!',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alex&backgroundColor=b6e3f4',
    badge: 'Demo User 1'
  },
  {
    name: 'Jordan Lee',
    email: 'jordan@subachat.demo',
    pass: 'DemoPass123!',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Jordan&backgroundColor=ffd5dc',
    badge: 'Demo User 2'
  },
  {
    name: 'Taylor Chen',
    email: 'taylor@subachat.demo',
    pass: 'DemoPass123!',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Taylor&backgroundColor=c0aede',
    badge: 'Demo User 3'
  }
];

interface AuthViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ isDark, onToggleTheme }) => {
  const { login, register, quickDemoLogin, loginWithGoogle, authError, clearError } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0].url);
  const [customAvatar, setCustomAvatar] = useState('');
  const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setLocalError(null);
    try {
      const dataUrl = await compressAndResizeImage(file, 256, 256);
      setUploadedAvatar(dataUrl);
      setCustomAvatar('');
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to process image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim() || !password.trim()) {
      setLocalError('Please fill in both email and password.');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      setLocalError('Please provide a display name.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        const photo = uploadedAvatar || customAvatar.trim() || selectedAvatar;
        await register(email, password, displayName, photo);
      } else {
        await login(email, password);
      }
    } catch {
      // Handled in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setLocalError(null);
    clearError();
    try {
      await loginWithGoogle();
    } catch {
      // Handled in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demo: typeof DEMO_ACCOUNTS[0]) => {
    setSubmitting(true);
    setLocalError(null);
    clearError();
    try {
      await quickDemoLogin(demo.email, demo.pass, demo.name, demo.avatar);
    } catch {
      // Handled in context
    } finally {
      setSubmitting(false);
    }
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 transition-colors duration-200">
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white leading-none">
              subachat
            </h1>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Real-time Messenger &amp; Gmail
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        </div>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-md mx-auto my-6">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/5 transition-all">
          
          {/* Header Title & Switch */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isSignUp 
                ? 'Join to connect and chat with friends in real-time' 
                : 'Enter your credentials to access your conversations'}
            </p>

            {/* Official Sign in with Google Button */}
            <div className="mt-5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-sm rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow-md transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                <span>Continue with Google &amp; Gmail</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 absolute">
                Or with email
              </span>
            </div>

            {/* Pill Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => { setIsSignUp(false); clearError(); setLocalError(null); }}
                className={`py-2 text-sm font-semibold rounded-xl transition-all ${
                  !isSignUp 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); clearError(); setLocalError(null); }}
                className={`py-2 text-sm font-semibold rounded-xl transition-all ${
                  isSignUp 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Register
              </button>
            </div>
          </div>

          {/* Error Message */}
          {activeError && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs sm:text-sm animate-in fade-in slide-in-from-top-1">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{activeError}</p>
                  {(activeError.includes('Firebase Console') || activeError.includes('operation-not-allowed')) && (
                    <div className="mt-2.5 p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-rose-200 dark:border-rose-900/60">
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-1">
                        How to enable Email/Password:
                      </p>
                      <ol className="list-decimal list-inside text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                        <li>Open the Firebase Console for your project.</li>
                        <li>Under <strong>Sign-in method</strong>, select <strong>Email/Password</strong>.</li>
                        <li>Toggle <strong>Enable</strong> on and click <strong>Save</strong>.</li>
                      </ol>
                      <a
                        href="https://console.firebase.google.com/project/ethereal-land-r61jg/authentication/providers"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <span>Open Firebase Auth Console</span>
                        <span>&rarr;</span>
                      </a>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => { clearError(); setLocalError(null); }}
                  className="text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 text-xs font-bold px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Registration Avatar Picker */}
            {isSignUp && (
              <div className="pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Choose Avatar / Profile Picture
                </label>

                {/* Upload Custom Photo or Select Preset */}
                <div className="flex items-center gap-3 mb-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                  <div className="relative shrink-0">
                    <img 
                      src={uploadedAvatar || customAvatar || selectedAvatar} 
                      alt="Selected Avatar" 
                      className="w-14 h-14 rounded-2xl object-cover bg-white dark:bg-slate-900 border-2 border-indigo-500 shadow-sm"
                    />
                    {uploadedAvatar && (
                      <span className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImage ? 'Processing...' : 'Upload Photo'}</span>
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1 truncate">
                      Upload from phone or computer
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-2 mb-2">
                  {PRESET_AVATARS.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => {
                        setSelectedAvatar(av.url);
                        setCustomAvatar('');
                        setUploadedAvatar(null);
                      }}
                      className={`relative p-1 rounded-xl transition-all border-2 ${
                        selectedAvatar === av.url && !customAvatar && !uploadedAvatar
                          ? 'border-indigo-600 dark:border-indigo-400 scale-105 shadow-md bg-indigo-50/50 dark:bg-indigo-950/40'
                          : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <img src={av.url} alt={av.label} className="w-full h-auto rounded-lg aspect-square" />
                      {selectedAvatar === av.url && !customAvatar && !uploadedAvatar && (
                        <div className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <input
                  type="url"
                  value={customAvatar}
                  onChange={(e) => {
                    setCustomAvatar(e.target.value);
                    setUploadedAvatar(null);
                  }}
                  placeholder="Or paste custom image URL (optional)"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Create My Account' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Accounts Banner for seamless real-time testing */}
          <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                1-Click Demo Accounts (Instant Test)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Open another tab in incognito or split screen and select a different user to test 2-way instant messaging!
            </p>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoLogin(demo)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <img src={demo.avatar} alt={demo.name} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1.5">
                        {demo.name}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {demo.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {demo.email}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Sign in <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto text-center py-2 text-xs text-slate-400 dark:text-slate-600">
        EchoChat &bull; Powered by Firebase Firestore, Authentication &amp; Gmail API
      </footer>
    </div>
  );
};
