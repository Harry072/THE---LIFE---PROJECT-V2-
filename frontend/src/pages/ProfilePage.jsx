import { useRef, useState } from "react";
import { useUserStore } from "../store/userStore";
import Sidebar from "../components/dashboard/Sidebar";
import TopBar from "../components/dashboard/TopBar";
import Icon from "../components/Icon";
import { handleSignOut } from "../lib/auth";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  getPreferredAvatarUrl,
  getPreferredInitial,
  getPreferredUsername,
} from "../utils/userDisplayName";
import { useAppState } from "../contexts/AppStateContext";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const formatMemberSince = (createdAt) => {
  if (!createdAt) return "Recently";

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return "Recently";

  return createdDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const toFiniteNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const formatWholeNumber = (value) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)));

const getAvatarExtension = (file) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (ALLOWED_AVATAR_EXTENSIONS.has(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "";
};

const isStorageSetupError = (error) => {
  const status = String(error?.statusCode || error?.status || "");
  const message = String(error?.message || error || "").toLowerCase();
  return status === "401"
    || status === "403"
    || status === "404"
    || message.includes("bucket")
    || message.includes("not found")
    || message.includes("row-level security")
    || message.includes("permission")
    || message.includes("not authorized")
    || message.includes("unauthorized")
    || message.includes("storage");
};

const getAuthMethod = (user) => {
  const provider = user?.app_metadata?.provider;
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const providers = new Set([
    provider,
    ...identities.map(identity => identity?.provider),
  ].filter(Boolean));

  if (providers.has("google")) return "Google";
  if (providers.has("email")) return "Email";
  return "Email";
};

function AccountRow({ label, children }) {
  return (
    <div className="profile-account-row">
      <span className="profile-account-label">{label}</span>
      <p>{children}</p>
    </div>
  );
}

function StatCard({ icon, label, value, caption }) {
  return (
    <article className="profile-stat-card">
      <div className="profile-stat-icon">
        <Icon name={icon} size={18} />
      </div>
      <div>
        <p className="profile-stat-label">{label}</p>
        <strong>{value}</strong>
        <span>{caption}</span>
      </div>
    </article>
  );
}

export default function ProfilePage() {
  const user = useUserStore(state => state.user);
  const profile = useUserStore(state => state.profile);
  const fetchUser = useUserStore(state => state.fetchUser);
  const {
    stats,
    user_tree: userTree,
    user_behavior: userBehavior,
  } = useAppState();

  const fileInputRef = useRef(null);
  const [avatarError, setAvatarError] = useState("");
  const [avatarMessage, setAvatarMessage] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const displayName = getPreferredUsername(user, profile);
  const initial = getPreferredInitial(user, profile);
  const avatarUrl = getPreferredAvatarUrl(user);
  const currentStreak = toFiniteNumber(stats?.streak)
    ?? toFiniteNumber(userBehavior?.streak)
    ?? 0;
  const lifeScore = toFiniteNumber(stats?.lifeScore)
    ?? toFiniteNumber(userTree?.cumulative_score);
  const totalTasksCompleted = toFiniteNumber(userBehavior?.total_tasks_completed);
  const todayTasksCompleted = toFiniteNumber(stats?.tasksCompleted) ?? 0;
  const treeVitality = userTree
    ? toFiniteNumber(userTree?.vitality ?? stats?.vitality)
    : null;
  const reflectionsSaved = toFiniteNumber(userBehavior?.total_reflections)
    ?? toFiniteNumber(stats?.reflectionsDone);
  const focusAreas = Array.isArray(profile?.struggle_tags)
    ? profile.struggle_tags
    : [];

  const statCards = [
    {
      icon: "flame",
      label: "Current Streak",
      value: `${formatWholeNumber(currentStreak)} ${currentStreak === 1 ? "day" : "days"}`,
      caption: "Consistency built through daily practice.",
    },
  ];

  if (lifeScore !== null) {
    statCards.push({
      icon: "sparkle",
      label: "Life Score",
      value: `${formatWholeNumber(lifeScore)} pts`,
      caption: "Earned by completing meaningful actions.",
    });
  }

  statCards.push({
    icon: "check",
    label: totalTasksCompleted !== null
      ? "Tasks Completed"
      : "Tasks Completed Today",
    value: formatWholeNumber(totalTasksCompleted ?? todayTasksCompleted),
    caption: totalTasksCompleted !== null
      ? "Useful actions completed in your journey."
      : "Core actions completed today.",
  });

  if (treeVitality !== null) {
    statCards.push({
      icon: "sprout",
      label: "Tree Vitality",
      value: `${formatWholeNumber(treeVitality)}%`,
      caption: "A visual signal of your daily growth.",
    });
  }

  if (reflectionsSaved !== null) {
    statCards.push({
      icon: "leaf",
      label: "Reflections Saved",
      value: formatWholeNumber(reflectionsSaved),
      caption: "Honest check-ins with yourself.",
    });
  }

  const handleAvatarSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setAvatarError("");
    setAvatarMessage("");

    if (!file) return;

    const extension = getAvatarExtension(file);
    const hasValidMimeType = ALLOWED_AVATAR_MIME_TYPES.has(file.type);

    if (!extension || !hasValidMimeType) {
      setAvatarError("Please upload a PNG, JPG, JPEG, or WEBP image.");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image must be under 2MB.");
      return;
    }

    if (!isSupabaseConfigured) {
      setAvatarError("Profile image storage is not ready yet.");
      return;
    }

    setIsUploadingAvatar(true);
    let filePath = "";
    let sessionData = null;

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      sessionData = data;

      if (sessionError || !sessionData?.session || !user?.id) {
        if (sessionError) {
          console.log("Profile image upload failed", {
            bucket: AVATAR_BUCKET,
            filePath,
            userId: user?.id,
            hasSession: Boolean(sessionData?.session),
            errorName: sessionError?.name,
            errorMessage: sessionError?.message,
            statusCode: sessionError?.statusCode,
            status: sessionError?.status,
          });
        }

        setAvatarError("Please sign in again to update your profile photo.");
        return;
      }

      filePath = `${user.id}/profile-avatar.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);
      const publicUrl = publicUrlData?.publicUrl
        ? `${publicUrlData.publicUrl}?v=${Date.now()}`
        : "";

      if (!publicUrl) {
        throw new Error("Avatar public URL was not available.");
      }

      const existingMetadata = {
        ...(sessionData?.session?.user?.user_metadata || {}),
        ...(user?.user_metadata || {}),
      };

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          ...existingMetadata,
          avatar_url: publicUrl,
        },
      });

      if (metadataError) throw metadataError;

      setAvatarFailed(false);
      setAvatarMessage("Profile photo updated.");
      await fetchUser();
    } catch (error) {
      console.log("Profile image upload failed", {
        bucket: AVATAR_BUCKET,
        filePath,
        userId: user?.id,
        hasSession: Boolean(sessionData?.session),
        errorName: error?.name,
        errorMessage: error?.message,
        statusCode: error?.statusCode,
        status: error?.status,
      });
      setAvatarError(
        isStorageSetupError(error)
          ? "Profile image storage is not ready yet."
          : "Could not update profile photo. Please try again."
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="profile-page">
      <Sidebar />

      <main className="profile-main">
        <TopBar />

        <div className="profile-shell">
          <section className="profile-header-card">
            <div className="profile-avatar-panel">
              <div className="profile-avatar-frame">
                {avatarUrl && !avatarFailed ? (
                  <img
                    src={avatarUrl}
                    alt="User profile photo"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>

              <input
                ref={fileInputRef}
                id="profile-avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarSelect}
                className="profile-avatar-input"
              />
              <label
                htmlFor="profile-avatar-upload"
                className="profile-avatar-button"
                aria-disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? "Uploading..." : "Change Photo"}
              </label>
              <p className="profile-avatar-help">
                PNG, JPG, or WEBP. Max 2MB.
              </p>
              {avatarMessage && (
                <p className="profile-avatar-message">{avatarMessage}</p>
              )}
              {avatarError && (
                <p className="profile-avatar-error">{avatarError}</p>
              )}
            </div>

            <div className="profile-identity">
              <p className="profile-kicker">Your Profile</p>
              <h1>{displayName}</h1>
              <p>{user?.email}</p>
            </div>
          </section>

          <section className="profile-grid">
            <article className="profile-card">
              <h2>Account Details</h2>
              <div className="profile-account-list">
                <AccountRow label="Member Since">
                  {formatMemberSince(user?.created_at)}
                </AccountRow>
                <AccountRow label="Identity Status">
                  <span className="profile-active-status">
                    <Icon name="check" size={14} />
                    Active Account
                  </span>
                </AccountRow>
                <AccountRow label="Email">
                  {user?.email || "No email available"}
                </AccountRow>
                <AccountRow label="Auth Method">
                  {getAuthMethod(user)}
                </AccountRow>
              </div>
            </article>

            <article className="profile-card profile-focus-card">
              <h2>Focus Areas</h2>
              <div className="profile-focus-tags">
                {focusAreas.length > 0 ? focusAreas.map((tag) => (
                  <span key={tag}>{tag}</span>
                )) : (
                  <p>No focus areas saved yet.</p>
                )}
              </div>
            </article>
          </section>

          <section className="profile-stats-section">
            <div className="profile-section-heading">
              <p>Growth Statistics</p>
              <h2>Your progress signals</h2>
            </div>
            <div className="profile-stats-grid">
              {statCards.map((card) => (
                <StatCard
                  key={card.label}
                  icon={card.icon}
                  label={card.label}
                  value={card.value}
                  caption={card.caption}
                />
              ))}
            </div>
          </section>

          <div className="profile-actions">
            <button type="button" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      </main>

      <style>{`
        .profile-page {
          min-height: 100vh;
          background:
            radial-gradient(ellipse 56% 34% at 78% 0%, rgba(46, 204, 113, 0.07), transparent 62%),
            var(--bg);
          color: var(--text);
          position: relative;
        }

        .profile-main {
          margin-left: 240px;
          position: relative;
          z-index: 1;
        }

        .profile-shell {
          width: 100%;
          max-width: 1040px;
          margin: 0 auto;
          padding: 40px 32px 56px;
        }

        .profile-header-card,
        .profile-card,
        .profile-stats-section {
          border: 1px solid var(--border);
          background: linear-gradient(145deg, rgba(16, 26, 20, 0.82), rgba(7, 12, 10, 0.66));
          backdrop-filter: blur(24px);
          box-shadow: var(--shadow-soft);
        }

        .profile-header-card {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 28px;
          align-items: center;
          border-radius: var(--r-lg);
          padding: 28px;
          margin-bottom: 24px;
          animation: fadeUp 0.6s ease both;
        }

        .profile-avatar-panel {
          width: 184px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .profile-avatar-frame {
          width: 126px;
          height: 126px;
          border-radius: 50%;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background:
            linear-gradient(135deg, rgba(46, 204, 113, 0.92), rgba(140, 255, 188, 0.18)),
            #102019;
          box-shadow: 0 18px 42px rgba(46, 204, 113, 0.22);
        }

        .profile-avatar-frame img,
        .profile-avatar-frame span {
          width: 100%;
          height: 100%;
          border-radius: 50%;
        }

        .profile-avatar-frame img {
          object-fit: cover;
          display: block;
        }

        .profile-avatar-frame span {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--green), #1a2a1a);
          color: white;
          font-family: var(--font-display);
          font-size: 48px;
          font-weight: 600;
        }

        .profile-avatar-input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .profile-avatar-button {
          margin-top: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid rgba(46, 204, 113, 0.34);
          background: rgba(46, 204, 113, 0.08);
          color: var(--green-bright);
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.22s ease;
        }

        .profile-avatar-button:hover {
          border-color: rgba(46, 204, 113, 0.56);
          background: rgba(46, 204, 113, 0.12);
          transform: translateY(-1px);
        }

        .profile-avatar-button[aria-disabled="true"] {
          opacity: 0.64;
          pointer-events: none;
        }

        .profile-avatar-help,
        .profile-avatar-message,
        .profile-avatar-error {
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.4;
        }

        .profile-avatar-help {
          color: var(--text-faint);
        }

        .profile-avatar-message {
          color: var(--green-bright);
        }

        .profile-avatar-error {
          color: rgba(255, 168, 168, 0.9);
        }

        .profile-identity {
          min-width: 0;
        }

        .profile-kicker,
        .profile-section-heading p {
          margin: 0;
          color: var(--text-faint);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2.4px;
          text-transform: uppercase;
        }

        .profile-identity h1 {
          margin: 8px 0 8px;
          font-family: var(--font-display);
          font-size: clamp(38px, 6vw, 58px);
          font-weight: 500;
          line-height: 1;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .profile-identity > p:last-child {
          margin: 0;
          color: var(--text-dim);
          font-size: 15px;
          overflow-wrap: anywhere;
        }

        .profile-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
          gap: 24px;
          margin-bottom: 24px;
          animation: fadeUp 0.6s ease 0.12s both;
        }

        .profile-card,
        .profile-stats-section {
          border-radius: var(--r-md);
          padding: 24px;
        }

        .profile-card h2,
        .profile-section-heading h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 500;
        }

        .profile-account-list {
          display: grid;
          gap: 16px;
          margin-top: 18px;
        }

        .profile-account-label {
          display: block;
          color: var(--text-faint);
          font-size: 12px;
          margin-bottom: 4px;
        }

        .profile-account-row p {
          margin: 0;
          color: var(--text);
          font-size: 15px;
          overflow-wrap: anywhere;
        }

        .profile-active-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--green-bright);
        }

        .profile-focus-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
        }

        .profile-focus-tags span {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.045);
          color: var(--text-dim);
          font-size: 12px;
        }

        .profile-focus-tags p {
          margin: 0;
          color: var(--text-faint);
          font-size: 13px;
        }

        .profile-stats-section {
          animation: fadeUp 0.6s ease 0.2s both;
        }

        .profile-section-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .profile-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .profile-stat-card {
          min-height: 150px;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr);
          gap: 14px;
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: var(--r-md);
          background:
            radial-gradient(circle at 85% 12%, rgba(46, 204, 113, 0.11), transparent 34%),
            rgba(255, 255, 255, 0.035);
        }

        .profile-stat-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--green-bright);
          background: rgba(46, 204, 113, 0.1);
          border: 1px solid rgba(46, 204, 113, 0.16);
        }

        .profile-stat-label {
          margin: 0 0 8px;
          color: var(--text-faint);
          font-size: 11px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .profile-stat-card strong {
          display: block;
          color: var(--text);
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 500;
          line-height: 1;
        }

        .profile-stat-card span {
          display: block;
          margin-top: 10px;
          color: var(--text-dim);
          font-size: 13px;
          line-height: 1.55;
        }

        .profile-actions {
          margin-top: 28px;
          text-align: center;
        }

        .profile-actions button {
          min-height: 40px;
          padding: 0 20px;
          border-radius: var(--r-sm);
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text);
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }

        .profile-actions button:hover {
          background: rgba(255, 255, 255, 0.055);
          border-color: var(--border-strong);
        }

        @media (max-width: 767px) {
          .profile-page aside {
            display: none;
          }

          .profile-main {
            margin-left: 0;
          }

          .profile-shell {
            padding: 24px 18px 44px;
          }

          .profile-header-card,
          .profile-grid,
          .profile-stats-grid {
            grid-template-columns: 1fr;
          }

          .profile-header-card {
            text-align: center;
            justify-items: center;
            padding: 22px;
          }

          .profile-avatar-panel {
            width: 100%;
          }

          .profile-section-heading {
            display: block;
          }

          .profile-section-heading h2 {
            margin-top: 5px;
          }
        }
      `}</style>
    </div>
  );
}
