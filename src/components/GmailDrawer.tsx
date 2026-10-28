import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  X, 
  RefreshCw, 
  Send, 
  Trash2, 
  Share2, 
  Search, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Plus, 
  Inbox, 
  ArrowLeft,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  fetchGmailMessages, 
  sendGmailMessage, 
  deleteGmailMessage, 
  GmailMessageSummary 
} from '../lib/gmail';

interface GmailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeChatPartnerEmail?: string;
  onShareToChat?: (text: string) => void;
}

export const GmailDrawer: React.FC<GmailDrawerProps> = ({
  isOpen,
  onClose,
  activeChatPartnerEmail,
  onShareToChat,
}) => {
  const { gmailToken, connectGmail } = useAuth();
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected message to read
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageSummary | null>(null);
  
  // Compose mode
  const [isComposing, setIsComposing] = useState(false);
  const [composeTo, setComposeTo] = useState(activeChatPartnerEmail || '');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Destructive / Action Confirmation Dialog state (MANDATORY per Workspace Skill)
  const [confirmationDialog, setConfirmationDialog] = useState<{
    type: 'send' | 'delete';
    title: string;
    description: string;
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);

  // Auto-fill activeChatPartnerEmail if opening compose
  useEffect(() => {
    if (activeChatPartnerEmail) {
      setComposeTo(activeChatPartnerEmail);
    }
  }, [activeChatPartnerEmail]);

  // Load emails when token is available and drawer is open
  const loadEmails = async (query = searchQuery) => {
    if (!gmailToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGmailMessages(gmailToken, query, 12);
      setMessages(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Gmail messages. Please re-authenticate.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && gmailToken) {
      loadEmails();
    }
  }, [isOpen, gmailToken]);

  if (!isOpen) return null;

  // Confirm and Send Email
  const requestSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      setError('Please fill in recipient, subject, and message content.');
      return;
    }

    // Workspace skill requirement: Explicit confirmation dialog before sending emails
    setConfirmationDialog({
      type: 'send',
      title: 'Send Email Confirmation',
      description: `Are you sure you want to send this email to "${composeTo.trim()}" with subject "${composeSubject.trim()}" on behalf of your Google Account?`,
      confirmLabel: 'Confirm & Send',
      action: async () => {
        if (!gmailToken) return;
        setIsSending(true);
        setError(null);
        try {
          await sendGmailMessage(gmailToken, composeTo, composeSubject, composeBody);
          setActionSuccess(`Email successfully sent to ${composeTo}!`);
          setIsComposing(false);
          setComposeSubject('');
          setComposeBody('');
          setTimeout(() => setActionSuccess(null), 4000);
          loadEmails();
        } catch (err: any) {
          setError(err?.message || 'Failed to send email.');
        } finally {
          setIsSending(false);
        }
      }
    });
  };

  // Confirm and Delete Email
  const requestDeleteEmail = (msg: GmailMessageSummary) => {
    // Workspace skill requirement: Explicit confirmation dialog before deleting user data
    setConfirmationDialog({
      type: 'delete',
      title: 'Move Email to Trash?',
      description: `Are you sure you want to move the email "${msg.subject}" from "${msg.from}" to your Gmail Trash?`,
      confirmLabel: 'Move to Trash',
      action: async () => {
        if (!gmailToken) return;
        setLoading(true);
        setError(null);
        try {
          await deleteGmailMessage(gmailToken, msg.id);
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          if (selectedMessage?.id === msg.id) {
            setSelectedMessage(null);
          }
          setActionSuccess('Email moved to trash.');
          setTimeout(() => setActionSuccess(null), 3000);
        } catch (err: any) {
          setError(err?.message || 'Failed to trash email.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleShareToChat = (msg: GmailMessageSummary) => {
    if (!onShareToChat) return;
    const shareText = `📧 Shared Email:\nSubject: ${msg.subject}\nFrom: ${msg.from}\n\n${msg.snippet}`;
    onShareToChat(shareText);
    setActionSuccess('Email snippet shared to your chat room!');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Drawer Container */}
      <div className="w-full max-w-lg h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Gmail Assistant
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">
                  Workspace
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inbox, quick compose &amp; share to chats
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {gmailToken && (
              <>
                <button
                  onClick={() => { setIsComposing(!isComposing); setSelectedMessage(null); }}
                  title="Compose new email"
                  className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                    isComposing
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Compose</span>
                </button>
                <button
                  onClick={() => loadEmails()}
                  disabled={loading}
                  title="Refresh inbox"
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-500' : ''}`} />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success / Error Alerts */}
        {actionSuccess && (
          <div className="m-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div className="m-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Content Area */}
        {!gmailToken ? (
          /* Unauthenticated State: Connect Gmail */
          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-4 shadow-sm border border-red-100 dark:border-red-900/40">
              <Mail className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Connect your Gmail Account
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm leading-relaxed">
              Link your Google account to read inbox emails, compose messages directly to friends, and share email threads directly into your chat rooms with permission.
            </p>

            <button
              onClick={async () => {
                try {
                  await connectGmail();
                } catch {
                  // Handled in context
                }
              }}
              className="mt-6 flex items-center gap-3 py-3 px-6 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-sm rounded-2xl shadow-lg shadow-red-600/25 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>Connect with Google</span>
            </button>
          </div>
        ) : isComposing ? (
          /* Compose View */
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsComposing(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Inbox
              </button>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                New Message
              </span>
            </div>

            <form onSubmit={requestSendEmail} className="flex-1 flex flex-col space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  To (Recipient)
                </label>
                <input
                  type="email"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Message Body
                </label>
                <textarea
                  required
                  rows={8}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email message..."
                  className="w-full flex-1 p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none font-sans"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsComposing(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-red-600/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Review &amp; Send</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : selectedMessage ? (
          /* View Message Details */
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to List
              </button>
              <div className="flex items-center gap-1">
                {onShareToChat && (
                  <button
                    onClick={() => handleShareToChat(selectedMessage)}
                    title="Share this email into active chat room"
                    className="p-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg flex items-center gap-1"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share to Chat</span>
                  </button>
                )}
                <button
                  onClick={() => requestDeleteEmail(selectedMessage)}
                  title="Move to Trash"
                  className="p-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="py-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedMessage.subject}
              </h3>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                <div><strong>From:</strong> {selectedMessage.from}</div>
                <div><strong>Date:</strong> {selectedMessage.date}</div>
              </div>
            </div>

            <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed flex-1 overflow-y-auto font-sans">
              {selectedMessage.bodyText || selectedMessage.snippet}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between">
              <button
                onClick={() => {
                  setComposeTo(selectedMessage.from.match(/<([^>]+)>/)?.[1] || selectedMessage.from);
                  setComposeSubject(`Re: ${selectedMessage.subject.replace(/^Re:\s*/i, '')}`);
                  setIsComposing(true);
                  setSelectedMessage(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl transition-all"
              >
                Reply via Gmail
              </button>
            </div>
          </div>
        ) : (
          /* Messages Inbox List */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Input */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadEmails(searchQuery)}
                  placeholder="Search emails (press Enter)..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500 mb-2" />
                  <p className="text-xs">Loading Gmail inbox...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-16 text-center text-slate-400 p-6">
                  <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No emails found
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try searching a different keyword or compose a new email.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs truncate max-w-[240px] ${
                        msg.isUnread 
                          ? 'font-bold text-slate-900 dark:text-white' 
                          : 'font-medium text-slate-700 dark:text-slate-300'
                      }`}>
                        {msg.from}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {msg.date.split(' ').slice(0, 4).join(' ')}
                      </span>
                    </div>

                    <h4 className={`text-xs truncate mb-1 ${
                      msg.isUnread ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'
                    }`}>
                      {msg.subject}
                    </h4>

                    <p className="text-[11px] text-slate-400 truncate line-clamp-1">
                      {msg.snippet}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* Mandatory User Confirmation Dialog for Destructive / Mutating Workspace Operations */}
      {confirmationDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {confirmationDialog.title}
                </h3>
                <span className="text-xs text-slate-400">Action confirmation</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              {confirmationDialog.description}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmationDialog(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const act = confirmationDialog.action;
                  setConfirmationDialog(null);
                  await act();
                }}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all cursor-pointer ${
                  confirmationDialog.type === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                }`}
              >
                {confirmationDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
