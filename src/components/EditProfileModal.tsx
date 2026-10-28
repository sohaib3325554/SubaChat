import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  User, 
  Camera, 
  Check, 
  Loader2, 
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import { UserProfile } from '../types';
import { updateUserProfile, compressAndResizeImage } from '../lib/firebase';

const PRESET_AVATARS = [
  { id: '1', label: 'Cyber Fox', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=b6e3f4' },
  { id: '2', label: 'Cosmic Bear', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Nova&backgroundColor=c0aede' },
  { id: '3', label: 'Pixel Cat', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Milo&backgroundColor=d1d4f9' },
  { id: '4', label: 'Spark Bot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Spark&backgroundColor=ffd5dc' },
  { id: '5', label: 'Astro Pup', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Luna&backgroundColor=ffdfbf' },
  { id: '6', label: 'Glitch Owl', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Echo&backgroundColor=b6e3f4' },
];

interface EditProfileModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  currentUser,
  isOpen,
  onClose,
}) => {
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const compressedDataUrl = await compressAndResizeImage(file, 256, 256);
      setPhotoURL(compressedDataUrl);
    } catch (err: any) {
      setError(err?.message || 'Failed to process selected image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateUserProfile(currentUser.uid, {
        displayName: displayName.trim(),
        photoURL,
        bio: bio.trim()
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Profile
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update your avatar and display name
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {/* Profile Picture Upload Section */}
          <div className="flex flex-col items-center text-center">
            <div className="relative group mb-3">
              <img
                src={photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.uid}`}
                alt="Profile Preview"
                className="w-24 h-24 rounded-3xl object-cover bg-slate-100 dark:bg-slate-800 border-4 border-indigo-500/20 shadow-lg"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Upload Photo"
                className="absolute inset-0 rounded-3xl bg-slate-950/40 group-hover:bg-slate-950/60 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold">Change</span>
                  </>
                )}
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Custom Photo</span>
            </button>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports PNG, JPG, WEBP &bull; Auto-scaled &amp; optimized
            </p>
          </div>

          {/* Or Select Preset */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Or Choose Preset Avatar
            </label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setPhotoURL(av.url)}
                  className={`p-1 rounded-xl border-2 transition-all cursor-pointer ${
                    photoURL === av.url
                      ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 scale-105'
                      : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <img src={av.url} alt={av.label} className="w-full aspect-square rounded-lg" />
                </button>
              ))}
            </div>
          </div>

          {/* Display Name Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Bio Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Status Bio
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Exploring the real-time universe..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
