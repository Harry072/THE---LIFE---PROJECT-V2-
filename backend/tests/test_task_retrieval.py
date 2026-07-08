import unittest

from ai.task_retrieval import (
    INNER_LAYER_ALIASES,
    _passes_safety_gates,
    load_task_library,
    retrieve_candidates,
)


class TaskLibraryLoaderTests(unittest.TestCase):
    def test_loader_returns_all_tasks(self):
        tasks = load_task_library()
        self.assertEqual(len(tasks), 54)
        self.assertTrue(all("id" in t and "_embedding" in t for t in tasks))

    def test_loader_normalizes_inner_layer_aliases_and_casing(self):
        tasks = {t["id"]: t for t in load_task_library()}

        # "kaam" is an alias for "lust" (same concept, different spelling).
        self.assertEqual(INNER_LAYER_ALIASES.get("kaam"), "lust")
        self.assertEqual(tasks["L2-10"]["inner_layer"], "lust")
        self.assertEqual(tasks["L2-14"]["inner_layer"], "lust")

        # "Awareness" (capitalized in the source data) is lowercased, not merged
        # into an unrelated bucket.
        self.assertEqual(tasks["L2-11"]["inner_layer"], "awareness")

        # Layers that were already canonical pass through untouched.
        self.assertEqual(tasks["L1-01"]["inner_layer"], "distraction")
        self.assertEqual(tasks["L2-01"]["inner_layer"], "anger")


class SafetyGateTests(unittest.TestCase):
    FOOD_QUERY = "sugar habit comfort cravings no self-control"
    MONEY_QUERY = "no savings spend everything money slips away"

    def test_food_gate_excluded_by_default(self):
        results = retrieve_candidates(self.FOOD_QUERY, max_candidates=10, allow_food=False)
        ids = [r["id"] for r in results]
        self.assertNotIn("L2-14", ids)
        self.assertNotIn("L3-01", ids)

    def test_food_gate_included_when_opted_in_and_not_foundation(self):
        results = retrieve_candidates(self.FOOD_QUERY, max_candidates=10, allow_food=True)
        ids = [r["id"] for r in results]
        self.assertIn("L2-14", ids)  # level=recognition
        self.assertIn("L3-01", ids)  # level=integration

    def test_food_gate_blocks_foundation_even_when_opted_in(self):
        synthetic_task = {"safety_gate": "food", "level": "foundation"}
        self.assertFalse(_passes_safety_gates(synthetic_task, allow_food=True))
        self.assertFalse(_passes_safety_gates(synthetic_task, allow_food=False))

    def test_money_gate_never_excluded(self):
        for allow_food in (True, False):
            results = retrieve_candidates(self.MONEY_QUERY, max_candidates=3, allow_food=allow_food)
            self.assertEqual(results[0]["id"], "L3-20")

    def test_money_gate_is_annotated_in_output(self):
        results = retrieve_candidates(self.MONEY_QUERY, max_candidates=1)
        self.assertEqual(results[0]["safety_gate"], "money")


class LevelBoostTests(unittest.TestCase):
    QUERY = "stuck same walls need change"  # strongly matches L3-14 (integration)

    def test_level_is_boost_not_wall(self):
        # L3-14 is level=integration. Passing a mismatched journey_phase must
        # never remove it from candidates.
        results = retrieve_candidates(self.QUERY, max_candidates=5, journey_phase="foundation")
        ids = [r["id"] for r in results]
        self.assertIn("L3-14", ids)

    def test_level_boost_increases_score_on_phase_match(self):
        baseline = retrieve_candidates(self.QUERY, max_candidates=1)[0]
        boosted = retrieve_candidates(self.QUERY, max_candidates=1, journey_phase="integration")[0]
        self.assertEqual(baseline["id"], "L3-14")
        self.assertEqual(boosted["id"], "L3-14")
        self.assertAlmostEqual(boosted["score"] - baseline["score"], 0.08, places=4)


class BalanceNudgeTests(unittest.TestCase):
    QUERY = "isolated withdrawn not helping anyone"  # strongly matches L3-03 (outward)

    def test_balance_nudge_noop_by_default(self):
        no_arg = retrieve_candidates(self.QUERY, max_candidates=5)
        explicit_none = retrieve_candidates(self.QUERY, max_candidates=5, recent_directions=None)
        self.assertEqual(no_arg, explicit_none)

    def test_balance_nudge_boosts_outward_when_all_recent_inward_and_noop_when_mixed(self):
        baseline = retrieve_candidates(self.QUERY, max_candidates=1)[0]
        nudged = retrieve_candidates(
            self.QUERY, max_candidates=1, recent_directions=["inward", "inward", "inward"]
        )[0]
        mixed = retrieve_candidates(
            self.QUERY, max_candidates=1, recent_directions=["inward", "outward"]
        )[0]

        self.assertEqual(baseline["id"], "L3-03")
        self.assertEqual(nudged["id"], "L3-03")
        self.assertAlmostEqual(nudged["score"] - baseline["score"], 0.08, places=4)
        self.assertEqual(mixed["score"], baseline["score"])  # mixed history = no-op


class RetrievalMechanicsTests(unittest.TestCase):
    def test_max_candidates_is_respected(self):
        self.assertLessEqual(len(retrieve_candidates("a quiet ordinary day", max_candidates=3)), 3)
        self.assertLessEqual(len(retrieve_candidates("a quiet ordinary day", max_candidates=1)), 1)

    def test_tie_break_is_deterministic(self):
        query = "I am so angry I could snap"
        first = retrieve_candidates(query, max_candidates=5)
        second = retrieve_candidates(query, max_candidates=5)
        self.assertEqual([r["id"] for r in first], [r["id"] for r in second])

        # Everything below the real (non-zero) anger match is an unbroken tie
        # at score 0.0 — the tie-break key (task id, ascending) must sort them.
        self.assertEqual(first[0]["id"], "L2-01")
        zero_score_tail = [r["id"] for r in first[1:] if r["score"] == 0.0]
        self.assertEqual(zero_score_tail, sorted(zero_score_tail))


class RetrievalQualityTests(unittest.TestCase):
    def test_retrieval_surfaces_distraction_task_for_focus_struggle(self):
        results = retrieve_candidates("I can't focus, I keep scrolling", max_candidates=3)
        self.assertEqual(results[0]["inner_layer"], "distraction")

    def test_retrieval_surfaces_anger_task_for_anger_struggle(self):
        results = retrieve_candidates("I am so angry I could snap", max_candidates=3)
        self.assertEqual(results[0]["id"], "L2-01")


if __name__ == "__main__":
    unittest.main()
