import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthContext";
import { X, Camera, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface ProfileEditorProps {
  open: boolean;
  onClose: () => void;
  currentName: string;
  currentAvatarUrl: string | null;
  onSaved: (newName: string, newAvatarUrl: string | null) => void;
}

export function ProfileEditor({ open, onClose, currentName, currentAvatarUrl, onSaved }: ProfileEditorProps) {
  const { user } = useAuth();
  const [name, setName] = useState(currentName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open || !user) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;

      // Upload to storage (upsert)
      const { error: uploadError } = await supabase.storage
        .from("profile_avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("profile_avatars")
        .getPublicUrl(path);

      // Add cache-bust param
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;
      setAvatarUrl(publicUrl);
      toast.success("Photo uploaded");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error("Failed to upload photo: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const updates: { full_name: string; avatar_url?: string | null } = {
        full_name: name.trim(),
      };
      if (avatarUrl !== currentAvatarUrl) {
        updates.avatar_url = avatarUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      // Also update trainer_name in module_trainers if this user is a trainer
      // This ensures name changes don't break module assignments
      if (name.trim() !== currentName) {
        await supabase
          .from("module_trainers")
          .update({ trainer_name: name.trim() })
          .eq("trainer_id", user.id);
      }

      onSaved(name.trim(), avatarUrl);
      toast.success("Profile updated");
      onClose();
    } catch (err: any) {
      console.error("Profile save error:", err);
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(13,37,67,0.25)] w-full max-w-[400px] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#0d2543]">Edit Profile</h2>
          <button
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="size-24 rounded-full object-cover border-2 border-gray-100"
                />
              ) : (
                <div className="size-24 rounded-full bg-[#0d2543] text-white flex items-center justify-center text-2xl font-semibold">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                {uploading ? (
                  <Loader2 className="size-6 text-white animate-spin" />
                ) : (
                  <Camera className="size-6 text-white" />
                )}
              </button>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-sm text-[#4493BF] hover:underline"
            >
              {uploading ? "Uploading..." : "Change photo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Display Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-[#0d2543] focus:border-[#4493BF] focus:ring-2 focus:ring-[#4493BF]/20 outline-none transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#0d2543] hover:bg-[#0d2543]/90 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
