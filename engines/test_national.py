import json
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from engines import draft_jobs, model_budget
from engines.grounded_drafts import DraftFailure
from engines.national_run import POLICY, run_county

DEMO = Path(__file__).parent / "snapshots/manatee-zetaris-chain.json"


class BudgetAndRetentionTests(unittest.TestCase):
    def test_windows_occupied_ticket_is_skipped_but_real_access_denial_is_not(self):
        actual_open = Path.open
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(model_budget, "ROOT", Path(directory)), \
                patch.object(model_budget, "MAX_ATTEMPTS", 2):
            occupied = model_budget.reserve("filesystem test, no provider request")

            def windows_open(path, *args, **kwargs):
                if path == occupied and args and args[0] == "x":
                    raise PermissionError("Occupied ticket sharing violation")
                return actual_open(path, *args, **kwargs)

            with patch.object(Path, "open", windows_open):
                ticket = model_budget.reserve("second filesystem test, no provider request")
            self.assertEqual(ticket.name, "attempt-0002.json")
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(model_budget, "ROOT", Path(directory)), \
                patch.object(Path, "open", side_effect=PermissionError("Unwritable folder")):
            with self.assertRaises(PermissionError):
                model_budget.reserve("denied filesystem test, no provider request")

    def test_concurrent_reservations_never_exceed_the_approved_limit(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(model_budget, "ROOT", Path(directory)), \
                patch.object(model_budget, "MAX_ATTEMPTS", 4):
            def reserve(_):
                try:
                    return model_budget.reserve("policy test, no provider request")
                except model_budget.BudgetExceeded:
                    return None
            with ThreadPoolExecutor(max_workers=8) as pool:
                result = list(pool.map(reserve, range(12)))
            self.assertEqual(len([value for value in result if value]), 4)
            records = [json.loads(path.read_text()) for path in Path(directory).glob("attempt-*.json")]
            self.assertEqual({record["attempt"] for record in records}, {1, 2, 3, 4})
            self.assertTrue(all(record["paid_fallback_enabled"] is False for record in records))

    def test_a_retained_real_failure_is_not_replaced_when_the_retry_has_no_budget(self):
        snapshot = json.loads(DEMO.read_text())
        row = snapshot["facilities"][0]
        event = next(event for event in snapshot["model_executions"] if event["status"] != "grounding_passed")
        with patch.object(draft_jobs, "request_selections", side_effect=[
            DraftFailure("Retained actual grounding failure", event), model_budget.BudgetExceeded(),
        ]):
            result = draft_jobs.enrich({"facilities": [row]}, "negative-retention-test")
        explanation = result["facilities"][0]["evidence"]["model_explanation"]
        self.assertIsNone(explanation["text"])
        self.assertEqual(explanation["status"], "failed")
        self.assertEqual(explanation["attempts"][0]["provider_content"], event.get("provider_content"))
        self.assertEqual(explanation["attempts"][1]["status"], "retry_not_attempted_budget")
        self.assertEqual(result["model_report"]["provider_requests"], 1)
        self.assertEqual(result["model_report"]["retry_requests_not_attempted_budget"], 1)


class LiveNationalChainTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = run_county("12081")

    def test_all_source_steps_close_and_the_fixed_formula_is_reproducible(self):
        snapshot = self.snapshot
        ids = snapshot["data_access"]["zetaris_query_ids"]
        self.assertEqual(len(ids), 7)
        self.assertEqual(len(set(ids)), 7)
        self.assertEqual(snapshot["counts"]["source_rows"],
                         len(snapshot["facilities"]) + len(snapshot["refused"]))
        self.assertGreater(len(snapshot["facilities"]), 0)
        for step in snapshot["data_access"]["chain_steps"]:
            self.assertTrue(step["audit"]["finish_successfully"])
            self.assertTrue(step["audit"]["end_time"])
            self.assertEqual(step["query_ids"], [step["audit"]["query_id"]])
        for index, row in enumerate(snapshot["facilities"], 1):
            self.assertEqual(row["rank"], index)
            self.assertEqual(row["score"]["formula_version"], POLICY["version"])
            self.assertEqual(len(row["score"]["terms"]), 4)
            self.assertAlmostEqual(sum(term["weighted"] for term in row["score"]["terms"]),
                                   row["score"]["total"], places=12)
            self.assertTrue(all(fact["query_id"] in ids for fact in row["evidence"]["facts"]))
            geography = json.loads(row["evidence"]["geography"])
            self.assertEqual(geography["source_record"][2:4], ["Match", "Exact"])
            self.assertIsNone(row["evidence"]["model_explanation"])
        self.assertIsNone(snapshot["policy"]["plan_year"])
        self.assertIsNone(snapshot["policy"]["plan_artifact"])
        self.assertTrue(all("plan_flag" not in [term["name"] for term in row["score"]["terms"]]
                            for row in snapshot["facilities"]))

    def test_real_refusals_are_preserved_instead_of_guessed_values(self):
        refused = self.snapshot["refused"]
        self.assertGreater(len(refused), 0)
        self.assertTrue(all(row["reason"] and row["query_ids"] for row in refused))
        ranked = {row["ccn"] for row in self.snapshot["facilities"]}
        self.assertFalse(ranked.intersection(row["ccn"] for row in refused))


if __name__ == "__main__":
    unittest.main()
