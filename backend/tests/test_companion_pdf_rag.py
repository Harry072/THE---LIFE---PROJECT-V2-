import json
from pathlib import Path
import unittest

from ai.companion_intents import detect_companion_intent
from ai.companion_knowledge import retrieve_companion_knowledge
from ai.companion_pdf_knowledge import load_companion_pdf_chunks
from ai.fallbacks import generate_life_companion_crisis_response, generate_life_companion_fallback
from ai.prompts import build_life_companion_prompt
from ai.validator import LifeCompanionValidationError, validate_life_companion_response


def combined_text(response: dict) -> str:
    parts = [response.get("reply", "")]
    for section in response.get("sections") or []:
        parts.append(section.get("title", ""))
        parts.append(section.get("body", ""))
        parts.extend(section.get("items") or [])
    return " ".join(str(part) for part in parts).lower()


class CompanionPdfRagTests(unittest.TestCase):
    def test_pdf_ingestion_splits_meaningful_sections_with_internal_metadata(self):
        chunks = load_companion_pdf_chunks()
        titles = {chunk["section_title"] for chunk in chunks}

        self.assertGreaterEqual(len(chunks), 40)
        self.assertIn("Breakup & Heartbreak", titles)
        self.assertTrue(any(title.startswith("Peaceful Places in India") for title in titles))

        breakup = next(chunk for chunk in chunks if chunk["section_title"] == "Breakup & Heartbreak")
        for key in ["section_title", "playbook_type", "tags", "priority", "safety_level"]:
            self.assertIn(key, breakup)
        self.assertEqual(breakup["playbook_type"], "emotional_support")
        self.assertIn("breakup", breakup["tags"])

    def test_retrieval_uses_pdf_for_expected_behavior_cases(self):
        cases = [
            ("I had breakup with my girlfriend.", "pdf_life_companion_4_2_breakup_heartbreak"),
            ("In India what are peaceful places to visit?", "pdf_life_companion_9_5_peaceful_places_in_india_recommendations"),
            ("I can't focus on studies.", "pdf_life_companion_5_1_exam_academic_pressure"),
            ("I feel anxious right now.", "pdf_life_companion_4_4_anxiety_panic"),
            ("What did I say before?", "pdf_life_companion_7_4_multi_turn_conversations_using_context_across_messages"),
        ]

        for message, expected_chunk_id in cases:
            with self.subTest(message=message):
                intent = detect_companion_intent(message, "understand_me")
                chunks = retrieve_companion_knowledge(
                    message,
                    "understand_me",
                    intent,
                    max_chunks=4,
                    safe_memory_summary={
                        "previous_user_summary": "You mentioned a breakup or relationship pain.",
                    },
                )
                self.assertLessEqual(len(chunks), 4)
                self.assertIn(expected_chunk_id, [chunk["id"] for chunk in chunks])

    def test_prompt_keeps_pdf_chunk_ids_out_of_model_context(self):
        message = "I had breakup with my girlfriend."
        intent = detect_companion_intent(message, "understand_me")
        chunks = retrieve_companion_knowledge(message, "understand_me", intent, max_chunks=4)
        rag_context = "\n\n".join(
            str(chunk.get("content") or chunk.get("guidance") or "")[:600]
            for chunk in chunks[:4]
            if isinstance(chunk, dict)
        )
        prompt_parts = build_life_companion_prompt(
            user_message=message,
            rag_context=rag_context,
        )
        full_context = prompt_parts["system"] + " " + prompt_parts.get("context", "")

        self.assertNotIn("pdf_life_companion_", full_context)
        self.assertNotIn("chunk_id", full_context)

    def test_fallback_behavior_matches_required_scenarios(self):
        memory_context = {
            "safe_memory_summary": {
                "previous_user_summary": "You mentioned a breakup or relationship pain.",
            }
        }
        cases = [
            ("I had breakup with my girlfriend.", ["breakup", "phone"], "none"),
            ("In India what are peaceful places to visit?", ["ashram", "gurudwara"], "none"),
            ("I can't focus on studies.", ["25", "active recall"], "none"),
            ("I feel anxious right now.", ["feet", "breath"], "none"),
            ("What did I say before?", ["earlier", "breakup"], "none"),
            ("what should I use in this app if restless?", ["reset space"], "reset"),
        ]

        for message, required_terms, action_type in cases:
            with self.subTest(message=message):
                response = generate_life_companion_fallback(
                    "understand_me",
                    memory_context,
                    user_message=message,
                )
                text = combined_text(response)
                for term in required_terms:
                    self.assertIn(term, text)
                self.assertEqual(response["suggested_action"]["type"], action_type)
                validate_life_companion_response(
                    json.dumps(response),
                    expected_intent=response.get("intent"),
                    user_message=message,
                )

    def test_crisis_override_has_no_app_route(self):
        response = generate_life_companion_crisis_response()

        self.assertEqual(response["safety"]["risk_level"], "crisis")
        self.assertEqual(response["suggested_action"]["type"], "none")
        self.assertIsNone(response["suggested_action"]["route"])

    def test_validator_rejects_source_leakage(self):
        payload = {
            "reply": "According to the PDF, you should ground yourself first.",
            "reply_format": "grounding",
            "sections": [{"title": "Step", "body": "This came from page 4 of the knowledge base."}],
            "suggested_action": {"type": "none", "label": "", "route": None},
            "tone": "grounded",
            "safety": {"risk_level": "none", "message": None},
        }

        with self.assertRaises(LifeCompanionValidationError) as raised:
            validate_life_companion_response(
                json.dumps(payload),
                expected_intent="anxiety_grounding",
            )

        self.assertEqual(raised.exception.reason, "source_metadata_leakage")

    def test_life_companion_logging_omits_raw_message_and_chunk_ids(self):
        source = Path(__file__).resolve().parents[1].joinpath("main.py").read_text(encoding="utf-8")

        self.assertIn("message_chars={len(raw_message)}", source)
        self.assertIn("knowledge_used_count=", source)
        self.assertNotIn("knowledge_chunk_ids", source)
        self.assertNotIn("knowledge_used={knowledge_used}", source)


if __name__ == "__main__":
    unittest.main()
