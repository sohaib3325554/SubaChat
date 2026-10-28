export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  status: 'online' | 'offline';
  lastSeen?: any;
  createdAt?: any;
  bio?: string;
}

export interface MessageReplyInfo {
  messageId: string;
  text: string;
  senderName: string;
  senderId: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: any;
  read: boolean;
  reactions?: Record<string, string>; // userId -> emoji
  replyTo?: MessageReplyInfo;
  audioUrl?: string; // base64 data URL for voice message
  audioDuration?: number; // duration in seconds
  isEdited?: boolean;
  editedAt?: any;
}

export interface ParticipantDetail {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  participantDetails: Record<string, ParticipantDetail>;
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: any;
    read: boolean;
  };
  createdAt?: any;
  updatedAt?: any;
  typing?: Record<string, boolean>;
  loveMode?: boolean;
  humorMode?: boolean;
  midnightMode?: boolean;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: string; // `${minUid}_${maxUid}`
  users: string[]; // [uid1, uid2]
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt?: any;
  updatedAt?: any;
}

export interface UserBlock {
  id: string; // `${blockerId}_${blockedId}`
  blockerId: string;
  blockedId: string;
  createdAt?: any;
}
