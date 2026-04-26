const normalizeName = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
};

const fallbackFromEmail = (email, fallback) => {
  if (typeof email !== "string" || !email.includes("@")) return fallback;

  const localPart = email.split("@")[0] || "";
  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) return fallback;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

export function getPreferredUsername(user, _profile, fallback = "Explorer") {
  const metadataUsername = normalizeName(user?.user_metadata?.username);
  if (metadataUsername) return metadataUsername;

  const metadataFullName = normalizeName(user?.user_metadata?.full_name);
  if (metadataFullName) return metadataFullName;

  return fallbackFromEmail(user?.email, fallback);
}

export function getPreferredInitial(user, profile, fallback = "E") {
  const name = getPreferredUsername(user, profile, fallback);
  return (name.charAt(0) || fallback.charAt(0) || "E").toUpperCase();
}
