// Display-name resolution — mirrors the backend orchestrator's chain:
// profile name column (absent today, tolerated) → auth metadata full_name
// → username → email prefix, every candidate cleaned. A handle-looking
// string ("1har4y09") can never reach the screen: digits and separators
// are stripped and the first letter capitalised, so the worst case for a
// digit-heavy email prefix is a short clean name, never the raw handle.

const cleanDisplayName = (value) => {
  if (typeof value !== "string") return "";
  const stripped = value.replace(/[0-9_.\-]+/g, " ");
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  if (!collapsed) return "";
  return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
};

export function getPreferredUsername(user, profile, fallback = "Explorer") {
  const fromProfile = cleanDisplayName(
    profile?.display_name || profile?.full_name
  );
  if (fromProfile) return fromProfile;

  const fromFullName = cleanDisplayName(user?.user_metadata?.full_name);
  if (fromFullName) return fromFullName;

  const fromUsername = cleanDisplayName(user?.user_metadata?.username);
  if (fromUsername) return fromUsername;

  const email = user?.email;
  if (typeof email === "string" && email.includes("@")) {
    const fromEmail = cleanDisplayName(email.split("@")[0]);
    if (fromEmail) return fromEmail;
  }

  return fallback;
}

export function getPreferredInitial(user, profile, fallback = "E") {
  const name = getPreferredUsername(user, profile, fallback);
  return (name.charAt(0) || fallback.charAt(0) || "E").toUpperCase();
}

export function getPreferredAvatarUrl(user) {
  const avatarUrl = user?.user_metadata?.avatar_url;
  return typeof avatarUrl === "string" ? avatarUrl.trim() : "";
}

// Every word capitalised, not just the first — applied at each render
// site regardless of what the source (backend payload, profile row, auth
// metadata) returned. cleanDisplayName above only capitalises the first
// letter of the whole string, so "harpreet singh" needs this on top.
export function toTitleCase(value) {
  if (typeof value !== "string" || !value) return value;
  return value
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}
