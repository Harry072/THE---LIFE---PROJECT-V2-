import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tlp.curator.activeShelf.v1";
const MAX_ACTIVE_BOOKS = 2;

const readShelf = () => {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ACTIVE_BOOKS) : [];
  } catch {
    return [];
  }
};

export default function useCuratorShelf() {
  const [activeBookIds, setActiveBookIds] = useState(readShelf);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activeBookIds));
  }, [activeBookIds]);

  const isActive = useCallback(
    (bookId) => activeBookIds.includes(bookId),
    [activeBookIds]
  );

  const takeBook = useCallback((bookId) => {
    if (!bookId) {
      return { ok: false, reason: "missing" };
    }

    if (activeBookIds.includes(bookId)) {
      return { ok: true, reason: "already-active" };
    }

    if (activeBookIds.length >= MAX_ACTIVE_BOOKS) {
      return { ok: false, reason: "shelf-full" };
    }

    setActiveBookIds((current) => [...current, bookId].slice(0, MAX_ACTIVE_BOOKS));
    return { ok: true, reason: "added" };
  }, [activeBookIds]);

  const removeBook = useCallback((bookId) => {
    setActiveBookIds((current) => current.filter((id) => id !== bookId));
  }, []);

  return {
    activeBookIds,
    takeBook,
    removeBook,
    isActive,
    maxActiveBooks: MAX_ACTIVE_BOOKS,
  };
}
