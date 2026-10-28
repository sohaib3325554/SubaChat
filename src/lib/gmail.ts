import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  User 
} from 'firebase/auth';
import { auth, syncUserProfile } from './firebase';

export const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
];

// In-memory access token cache as strictly required by workspace-integration skill
let cachedGmailAccessToken: string | null = null;
let isSigningInWithGoogle = false;

export function getCachedGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export function setCachedGmailAccessToken(token: string | null) {
  cachedGmailAccessToken = token;
}

export async function signInWithGoogleGmail(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningInWithGoogle = true;
    const provider = new GoogleAuthProvider();
    // Add Gmail scopes
    GMAIL_SCOPES.forEach((scope) => provider.addScope(scope));
    // Prompt consent to ensure fresh tokens with required scopes
    provider.setCustomParameters({
      prompt: 'consent',
      access_type: 'online'
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Google sign-in succeeded, but no Gmail access token was returned.');
    }

    cachedGmailAccessToken = credential.accessToken;
    await syncUserProfile(result.user, result.user.displayName || undefined, result.user.photoURL || undefined);

    return { user: result.user, accessToken: credential.accessToken };
  } finally {
    isSigningInWithGoogle = false;
  }
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  isUnread: boolean;
  bodyText?: string;
}

// Helper to decode Base64 URL encoded strings
function decodeBase64Url(input: string): string {
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const binStr = atob(base64);
    return decodeURIComponent(
      Array.prototype.map
        .call(binStr, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    try {
      return atob(input.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }
}

// Extract body text recursively from message payload
function extractBodyText(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Fallback to text/html stripped of tags
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
      }
      if (part.parts) {
        const nested = extractBodyText(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

// Fetch list of recent Gmail messages
export async function fetchGmailMessages(
  token: string, 
  queryStr = '', 
  maxResults = 10
): Promise<GmailMessageSummary[]> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('maxResults', String(maxResults));
  if (queryStr) {
    url.searchParams.set('q', queryStr);
  }

  const listRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!listRes.ok) {
    const errData = await listRes.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to fetch messages (Status: ${listRes.status})`);
  }

  const listData = await listRes.json();
  if (!listData.messages || listData.messages.length === 0) {
    return [];
  }

  // Fetch details for each message concurrently
  const detailPromises = listData.messages.slice(0, maxResults).map(async (msgItem: { id: string }) => {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgItem.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!msgRes.ok) return null;
      const fullMsg = await msgRes.json();

      const headers = fullMsg.payload?.headers || [];
      const getHeader = (name: string) => 
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject') || '(No Subject)';
      const from = getHeader('From') || 'Unknown Sender';
      const to = getHeader('To') || '';
      const date = getHeader('Date') || '';
      const isUnread = fullMsg.labelIds?.includes('UNREAD') || false;
      const bodyText = extractBodyText(fullMsg.payload);

      return {
        id: fullMsg.id,
        threadId: fullMsg.threadId,
        snippet: fullMsg.snippet || '',
        subject,
        from,
        to,
        date,
        isUnread,
        bodyText: bodyText || fullMsg.snippet || ''
      } as GmailMessageSummary;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(detailPromises);
  return results.filter((m): m is GmailMessageSummary => m !== null);
}

// Send an email via Gmail API
export async function sendGmailMessage(
  token: string,
  to: string,
  subject: string,
  bodyText: string
): Promise<{ id: string; threadId: string }> {
  // Construct RFC 2822 formatted message
  const lines = [
    `To: ${to.trim()}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject.trim())))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    bodyText.trim()
  ];

  const rawMessage = btoa(unescape(encodeURIComponent(lines.join('\r\n'))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: rawMessage })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to send email (Status: ${res.status})`);
  }

  return await res.json();
}

// Delete / Trash a message in Gmail API
export async function deleteGmailMessage(token: string, messageId: string): Promise<void> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `Failed to delete message (Status: ${res.status})`);
  }
}
