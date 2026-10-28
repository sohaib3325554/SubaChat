# Security Specification & Threat Model

## Data Invariants
1. **User Identity Invariant**: A user can only create or update their own user document where `userId == request.auth.uid`.
2. **Chat Participation Invariant**: Only authenticated users whose `uid` is in `resource.data.participants` or `request.resource.data.participants` can read, create, or update the conversation.
3. **Message Sender Invariant**: A message must have `request.resource.data.senderId == request.auth.uid` and the sender must be a participant in the parent chat room.
4. **Message Integrity**: Once written, messages cannot be deleted or forged by arbitrary 3rd parties. Read status can only be updated by the intended recipient or chat participant.

## The Dirty Dozen Payloads (Designed to Fail)
1. **Impersonate User Creation**: User A writes to `/users/{userB_uid}` with their own credentials. (Expected: PERMISSION_DENIED)
2. **Chat Snooping**: Non-participant queries or reads `/chats/{chatId}` where `auth.uid` is not in `participants`. (Expected: PERMISSION_DENIED)
3. **Sender ID Spoofing**: User A sends a message in a chat with `senderId: userB`. (Expected: PERMISSION_DENIED)
4. **Unauthenticated Read**: Anonymous/unauthenticated client queries `/users` or `/chats`. (Expected: PERMISSION_DENIED)
5. **Junk Document ID Injection**: Attempting to create document with 2000-character malicious path. (Expected: PERMISSION_DENIED)
6. **Oversized Message Payload**: Attempting to post a message with 5MB text string. (Expected: PERMISSION_DENIED)
7. **Cross-Room Message Injection**: Injecting a message into `/chats/roomA/messages/msg1` with `chatId: 'roomB'`. (Expected: PERMISSION_DENIED)
8. **Malicious Presence Hijacking**: User A changes user B's online status to offline. (Expected: PERMISSION_DENIED)
9. **Arbitrary Field Injection (Shadow Update)**: User updates `/users/{uid}` with malicious field `isAdmin: true`. (Expected: PERMISSION_DENIED)
10. **Tampering with Another's Message**: User B changes text content of User A's previously sent message. (Expected: PERMISSION_DENIED)
11. **Orphan Message Creation**: Creating message in non-existent chat room where user is not a member. (Expected: PERMISSION_DENIED)
12. **Participant List Tampering**: Attempting to update chat participants to remove existing users without authorization. (Expected: PERMISSION_DENIED)
