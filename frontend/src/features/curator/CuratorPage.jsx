import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../../components/Icon";
import {
  CURATOR_PATHS,
  getBookById,
  getBooksForPath,
} from "./curatorData";
import useCuratorShelf from "./useCuratorShelf";
import MysteryPathGrid from "./MysteryPathGrid";
import MysteryPathSection from "./MysteryPathSection";
import ActiveReadingShelf from "./ActiveReadingShelf";
import FirstPageRitualModal from "./FirstPageRitualModal";
import HiddenShelfGate from "./HiddenShelfGate";
import CuratorIntelligencePanel from "./CuratorIntelligencePanel";
import useCuratorIntelligence from "./useCuratorIntelligence";
import { supabase } from "../../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../../lib/appAuth";
import { API_BASE_URL } from "../../lib/apiConfig";
import { useAppState } from "../../contexts/AppStateContext";
import ContinuationCard from "../../components/ContinuationCard";
import { endChain, evaluateCompletion } from "../../hooks/useContinuationChain";
import "./CuratorPage.css";

export default function CuratorPage() {
  const navigate = useNavigate();
  const { user } = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryBookId = searchParams.get("book");
  const expandedBookId = queryBookId;
  const [ritualBookId, setRitualBookId] = useState(null);
  const [ritualMessage, setRitualMessage] = useState("");
  const shelf = useCuratorShelf();

  const ritualBook = ritualBookId ? getBookById(ritualBookId) : null;
  const activeBooks = useMemo(
    () => shelf.activeBookIds.map(getBookById).filter(Boolean),
    [shelf.activeBookIds]
  );
  const curatorIntelligence = useCuratorIntelligence(user, shelf.activeBookIds);
  const [chainResult, setChainResult] = useState(null);

  const handleChainAccept = useCallback(() => {
    const route = chainResult?.nextRoute;
    setChainResult(null);
    if (route) navigate(route, { state: { fromChain: true } });
  }, [chainResult, navigate]);

  const handleChainDismiss = useCallback(() => {
    endChain();
    setChainResult(null);
  }, []);

  useEffect(() => {
    if (!queryBookId) return;

    const book = getBookById(queryBookId);
    if (!book) return;

    // Browsing the shelf is not engagement; opening a book detail is. That
    // deliberate action IS the completion moment, exactly like saving a
    // journal entry or finishing a reset -- so this renders a card whatever
    // route the user took to get here, and needs no fromChain gate. Only
    // tree_viewed needs one, because only its completion is bare arrival.
    let cancelled = false;
    (async () => {
      const result = await evaluateCompletion(
        "curator_explored", undefined, undefined, { rendersCard: true },
      );
      if (!cancelled && result) setChainResult(result);
    })();

    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(`curator-path-${book.pathSlug}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(scrollTimer);
    };
  }, [queryBookId]);

  const saveCuratorInteraction = async ({
    actionType,
    bookId = null,
    pathSlug = null,
  }) => {
    if (!user?.id || !actionType) return;

    try {
      const accessToken = await getSupabaseOrAppAccessToken(supabase);
      if (!accessToken) return;

      await fetch(`${API_BASE_URL}/api/curator/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          action_type: actionType,
          book_id: bookId,
          path_slug: pathSlug,
        }),
      });
    } catch {
      // Metadata should never interrupt the reading experience.
    }
  };

  const handlePathSelect = (path) => {
    void saveCuratorInteraction({
      actionType: "path_opened",
      pathSlug: path.slug,
    });
    document
      .getElementById(`curator-path-${path.slug}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleToggleBook = (bookId) => {
    const nextBookId = expandedBookId === bookId ? null : bookId;

    if (nextBookId) {
      const book = getBookById(nextBookId);
      void saveCuratorInteraction({
        actionType: "book_opened",
        bookId: nextBookId,
        pathSlug: book?.pathSlug,
      });
      setSearchParams({ book: nextBookId });
    } else {
      setSearchParams({});
    }
  };

  const handleFindBook = (bookId) => {
    const book = getBookById(bookId);
    void saveCuratorInteraction({
      actionType: "find_book_opened",
      bookId,
      pathSlug: book?.pathSlug,
    });
  };

  const handleRemoveBook = (bookId) => {
    const book = getBookById(bookId);
    shelf.removeBook(bookId);
    void saveCuratorInteraction({
      actionType: "book_removed",
      bookId,
      pathSlug: book?.pathSlug,
    });
  };

  const handleBeginRitual = (bookId) => {
    setRitualMessage("");
    setRitualBookId(bookId);
  };

  const handleConfirmRitual = () => {
    if (!ritualBook) return;

    const result = shelf.takeBook(ritualBook.id);
    if (!result.ok && result.reason === "shelf-full") {
      setRitualMessage(
        "Your shelf is already holding two books. Put one back before taking another with you."
      );
      return;
    }

    setRitualMessage("");
    setRitualBookId(null);
    void saveCuratorInteraction({
      actionType: "book_saved",
      bookId: ritualBook.id,
      pathSlug: ritualBook.pathSlug,
    });
  };

  return (
    <div className="curator-page">
      <div className="curator-bg" />
      <header className="curator-topbar">
        <button
          type="button"
          className="curator-back-btn"
          onClick={() => navigate("/dashboard")}
        >
          <Icon name="arrow" size={15} style={{ transform: "rotate(180deg)" }} />
          Dashboard
        </button>
        <p className="curator-kicker">The Life Project Library</p>
      </header>

      <main className="curator-shell">
        <section className="curator-hero">
          <div>
            <p className="curator-eyebrow">Books and ideas matched to your current direction.</p>
            <h1>The Curator</h1>
            <p className="curator-subtitle">
              Every field of life carries a mystery. Choose the one you are ready
              to explore. The Curator will guide you toward a book that can turn
              knowledge into growth.
            </p>
          </div>
          <div className="curator-hero-card" aria-label="Curator prompt">
            <span>Which mystery are you ready to explore?</span>
            <p>
              Start with curiosity. Take only what helps. Then leave the screen
              and meet the book slowly.
            </p>
          </div>
        </section>

        <CuratorIntelligencePanel
          lanes={curatorIntelligence.lanes}
          readingPathBook={curatorIntelligence.readingPathBook}
          topRecommendation={curatorIntelligence.topRecommendation}
          hasPersonalSignals={curatorIntelligence.hasPersonalSignals}
          loading={curatorIntelligence.loading}
          expandedBookId={expandedBookId}
          isBookActive={shelf.isActive}
          onToggleBook={handleToggleBook}
          onBeginRitual={handleBeginRitual}
          onFindBook={handleFindBook}
        />

        {chainResult && (
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <ContinuationCard
              headline={chainResult.headline}
              question={chainResult.question}
              nextFeatureName={chainResult.nextFeatureName}
              isTerminal={chainResult.isTerminal}
              onAccept={handleChainAccept}
              onDismiss={handleChainDismiss}
            />
          </div>
        )}

        <MysteryPathGrid paths={CURATOR_PATHS} onSelectPath={handlePathSelect} />

        <ActiveReadingShelf
          books={activeBooks}
          maxBooks={shelf.maxActiveBooks}
          onRemoveBook={handleRemoveBook}
          onOpenBook={handleToggleBook}
        />

        <div className="curator-sections">
          {CURATOR_PATHS.map((path) => {
            if (path.locked) {
              return <HiddenShelfGate key={path.slug} path={path} />;
            }

            return (
              <MysteryPathSection
                key={path.slug}
                path={path}
                books={getBooksForPath(path.slug)}
                expandedBookId={expandedBookId}
                isBookActive={shelf.isActive}
                onToggleBook={handleToggleBook}
                onBeginRitual={handleBeginRitual}
                onFindBook={handleFindBook}
              />
            );
          })}
        </div>
      </main>

      <FirstPageRitualModal
        book={ritualBook}
        message={ritualMessage}
        onClose={() => {
          setRitualMessage("");
          setRitualBookId(null);
        }}
        onConfirm={handleConfirmRitual}
      />
    </div>
  );
}
