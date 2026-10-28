export interface EmojiCategory {
  name: string;
  id: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Smileys & Expressions',
    id: 'smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', 
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', 
      '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', 
      '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', 
      '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', 
      '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', 
      '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', 
      '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', 
      '🥱', '😤', '😡', '😠', '🤬', '💀', '💩', '🤡', '👻', '👽', 
      '🤖', '🎃'
    ]
  },
  {
    name: 'Gestures & People',
    id: 'gestures',
    emojis: [
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤞', 
      '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', 
      '🤚', '🖐️', '🖖', '👋', '👊', '✊', '🤛', '🤜', '💪', '🧠', 
      '👀', '👁️', '👂', '👃', '🦶', '🦵', '💅', '🤳'
    ]
  },
  {
    name: 'Hearts & Love',
    id: 'hearts',
    emojis: [
      '❤️', '💖', '💕', '💓', '💗', '💞', '💘', '💝', '❣️', '💌', 
      '🌹', '💐', '🌸', '🌷', '💍', '💋', '💏', '💑', '🫂', '🧡', 
      '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💟', '🍫'
    ]
  },
  {
    name: 'Fun, Food & Celebration',
    id: 'celebration',
    emojis: [
      '🔥', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '⭐', '🌟', '💫', 
      '⚡', '💥', '💯', '🚀', '☕', '🍕', '🍔', '🍟', '🍰', '🧁', 
      '🍦', '🍩', '🍺', '🍻', '🥂', '🍿', '🎬', '🎵', '🎶', '🎮', 
      '💡', '📱', '💻', '✨'
    ]
  },
  {
    name: 'Animals & Nature',
    id: 'animals',
    emojis: [
      '🐱', '🐶', '😹', '😻', '🙀', '🙈', '🙉', '🙊', '🐵', '🐒', 
      '🦍', '🦄', '🐸', '🐼', '🦊', '🦁', '🐯', '🐧', '🦆', '🦉', 
      '🦇', '🦋', '🐝', '🐞', '🐢', '🐙', '🐬', '🐳', '🌻', '🌺', 
      '🌴', '🍀'
    ]
  }
];

// Flat standard order of all emojis across categories
export const NORMAL_ORDER_ALL_EMOJIS: string[] = Array.from(
  new Set(EMOJI_CATEGORIES.flatMap(cat => cat.emojis))
);

// High-priority Love theme emojis
export const LOVE_PRIORITY_EMOJIS: string[] = [
  '💖', '❤️', '💕', '💓', '💗', '💞', '💘', '💝', '❣️', '😍', 
  '🥰', '😘', '💌', '🌹', '💐', '🌸', '🌷', '💍', '💋', '💏', 
  '💑', '🫂', '🤍', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', 
  '💔', '💟', '🍫'
];

// High-priority Humor theme emojis
export const HUMOR_PRIORITY_EMOJIS: string[] = [
  '😂', '🤣', '😹', '💀', '🤪', '😜', '🤡', '😆', '😸', '😝', 
  '🤠', '👻', '💩', '🤭', '🙃', '🥳', '🤯', '🥴', '🙈', '🙉', 
  '🙊', '🐒', '🍌', '🎭', '🍿', '👽', '🤖', '🎃'
];

// High-priority Midnight sultry burgundy/purple emojis
export const MIDNIGHT_PRIORITY_EMOJIS: string[] = [
  '🌚', '👄', '😈', '💋', '🫦', '🍷', '🔥', '🖤', '🌶️', '🥵',
  '🤤', '😏', '🤫', '👀', '🍾', '🍓', '⛓️', '🌙', '✨', '💜',
  '🕯️', '🥂', '🍑', '🍒'
];

export type ChatMoodMode = 'normal' | 'love' | 'humor' | 'midnight';

// Order all emojis according to active mode
export function getOrderedEmojis(mode: ChatMoodMode): string[] {
  if (mode === 'love') {
    const loveSet = new Set(LOVE_PRIORITY_EMOJIS);
    const rest = NORMAL_ORDER_ALL_EMOJIS.filter(e => !loveSet.has(e));
    return [...LOVE_PRIORITY_EMOJIS, ...rest];
  }

  if (mode === 'humor') {
    const humorSet = new Set(HUMOR_PRIORITY_EMOJIS);
    const rest = NORMAL_ORDER_ALL_EMOJIS.filter(e => !humorSet.has(e));
    return [...HUMOR_PRIORITY_EMOJIS, ...rest];
  }

  if (mode === 'midnight') {
    const midnightSet = new Set(MIDNIGHT_PRIORITY_EMOJIS);
    const rest = NORMAL_ORDER_ALL_EMOJIS.filter(e => !midnightSet.has(e));
    return [...MIDNIGHT_PRIORITY_EMOJIS, ...rest];
  }

  // Normal mode: Standard usual order
  return NORMAL_ORDER_ALL_EMOJIS;
}

// Quick reaction emojis displayed in the hovering message pill
export function getQuickReactionEmojis(mode: ChatMoodMode): string[] {
  if (mode === 'love') {
    return ['💖', '❤️', '🥰', '😍', '🌹', '💌'];
  }
  if (mode === 'humor') {
    return ['😂', '🤣', '😹', '💀', '🤪', '🤡'];
  }
  if (mode === 'midnight') {
    return ['🌚', '👄', '😈', '💋', '🍷', '🔥', '🖤', '🫦'];
  }
  return ['👍', '❤️', '😂', '🔥', '😮', '😢'];
}

// Quick composer tray emojis
export function getQuickComposerEmojis(mode: ChatMoodMode): string[] {
  if (mode === 'love') {
    return ['💖', '❤️', '😘', '🥰', '🌹', '💌', '😍', '💐', '✨', '💍', '🍫', '💕'];
  }
  if (mode === 'humor') {
    return ['😂', '🤣', '😹', '💀', '🤪', '🤡', '😆', '😜', '🍌', '🍕', '🎉', '✨'];
  }
  if (mode === 'midnight') {
    return ['🌚', '👄', '😈', '💋', '🫦', '🍷', '🔥', '🖤', '🌶️', '🥵', '🤤', '😏', '🤫', '✨'];
  }
  return ['😊', '😂', '❤️', '👍', '🔥', '🎉', '🚀', '👀', '💯', '👋', '✨', '🙌'];
}
