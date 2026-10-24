"""Resume model batches by facility CCN rather than rebuilt list position."""

import json
import tempfile
import unittest
from pathlib import Path

from engines.national_sweep import (
    IDENTITY_ERROR,
    apply_cached_bindings,
    assign_checkpoint_paths,
    bind_cached_facilities,
    index_cached_batches,
    load_model_checkpoints,
    model_batch_path,
    pending_model_batches,
    record_model_facility,
    save,
)


def explanation(text: str) -> dict:
    return {"text": text, "status": "passed", "attempts": [{"status": "passed"}]}


def generated(ccn: str, text: str) -> dict:
    return {"ccn": ccn, "evidence": {"model_explanation": explanation(text)}}


def source(ccn: str) -> dict:
    return {"ccn": ccn, "evidence": {"model_explanation": None}}


def checkpoint(rows: list[dict], event_id: str) -> dict:
    return {
        "facilities": rows,
        "model_executions": [{
            "event_id": event_id,
            "facility_ccns": [row["ccn"] for row in rows],
        }],
        "model_report": {"provider_requests": 1},
    }


class ResumeIdentityTests(unittest.TestCase):
    def write_batches(self, folder: Path, documents: list[dict]) -> None:
        for index, document in enumerate(documents):
            save(model_batch_path(folder, index), document)

    def test_shuffled_resume_with_matching_ccns_succeeds(self):
        # Saved order is batch 0 [111, 222], batch 1 [333, 444]. Resume rebuilt
        # the facility list as [333, 111, 444, 222]. Positional zip mismatches;
        # CCN alignment must keep each cached explanation on its own facility.
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            saved_order = ["111111", "222222", "333333", "444444"]
            self.write_batches(folder, [
                checkpoint([generated("111111", "first"), generated("222222", "second")], "e0"),
                checkpoint([generated("333333", "third"), generated("444444", "fourth")], "e1"),
            ])
            rebuilt = ["333333", "111111", "444444", "222222"]
            rows = {ccn: source(ccn) for ccn in rebuilt}
            snapshots = {"12081": {"model_executions": [], "facilities": [rows[ccn] for ccn in rebuilt]}}
            eligible = [("12081", rows[ccn]) for ccn in rebuilt]
            completed, paused = load_model_checkpoints(folder)
            self.assertEqual(paused, set())
            indexed, documents = index_cached_batches([document for _, document in completed])
            bound = bind_cached_facilities(eligible, indexed)
            pending = apply_cached_bindings(snapshots, folder, eligible, bound, documents)
            self.assertNotEqual(saved_order, rebuilt)
            self.assertEqual(sorted(saved_order), sorted(rebuilt))
            self.assertEqual(pending, [])
            self.assertEqual(
                [rows[ccn]["evidence"]["model_explanation"]["text"] for ccn in rebuilt],
                ["third", "first", "fourth", "second"],
            )
            self.assertEqual(
                [event["event_id"] for event in snapshots["12081"]["model_executions"]],
                ["e1", "e0"],
            )

    def test_partial_shuffled_resume_leaves_only_uncached_facilities_pending(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            self.write_batches(folder, [
                checkpoint([generated("111111", "first"), generated("222222", "second")], "e0"),
            ])
            rebuilt = ["222222", "555555", "111111"]
            rows = {ccn: source(ccn) for ccn in rebuilt}
            snapshots = {"12081": {"model_executions": [], "facilities": [rows[ccn] for ccn in rebuilt]}}
            eligible = [("12081", rows[ccn]) for ccn in rebuilt]
            completed, _ = load_model_checkpoints(folder)
            indexed, documents = index_cached_batches([document for _, document in completed])
            bound = bind_cached_facilities(eligible, indexed)
            pending = apply_cached_bindings(snapshots, folder, eligible, bound, documents)
            self.assertEqual(rows["222222"]["evidence"]["model_explanation"]["text"], "second")
            self.assertEqual(rows["111111"]["evidence"]["model_explanation"]["text"], "first")
            self.assertIsNone(rows["555555"]["evidence"]["model_explanation"])
            self.assertEqual(pending, [("12081", rows["555555"])])
            jobs = assign_checkpoint_paths(
                folder, pending_model_batches(pending), {path for path, _ in completed}, set())
            self.assertEqual([row["ccn"] for _, row in jobs[0][2]], ["555555"])
            self.assertNotEqual(jobs[0][0], model_batch_path(folder, 0))
            self.assertEqual(
                json.loads(model_batch_path(folder, 0).read_text())["facilities"][0]["ccn"],
                "111111")

    def test_resume_refuses_cached_ccn_missing_from_rebuilt_facilities(self):
        indexed, _ = index_cached_batches([checkpoint([
            generated("111111", "first"),
            generated("222222", "second"),
        ], "e0")])
        eligible = [("12081", source("111111")), ("12081", source("999999"))]
        with self.assertRaisesRegex(RuntimeError, "source facility identity"):
            bind_cached_facilities(eligible, indexed)

    def test_duplicate_cached_ccn_is_refused(self):
        with self.assertRaisesRegex(RuntimeError, "source facility identity"):
            index_cached_batches([
                checkpoint([generated("111111", "first")], "e0"),
                checkpoint([generated("111111", "again")], "e1"),
            ])

    def test_duplicate_source_ccn_is_refused(self):
        with self.assertRaisesRegex(RuntimeError, "source facility identity"):
            bind_cached_facilities(
                [("12081", source("111111")), ("12083", source("111111"))], {})

    def test_apply_refuses_generated_ccn_that_differs_from_source(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            row = source("111111")
            snapshots = {"12081": {"model_executions": [], "facilities": [row]}}
            with self.assertRaisesRegex(RuntimeError, IDENTITY_ERROR):
                apply_cached_bindings(
                    snapshots, folder, [("12081", row)], [generated("222222", "wrong facility")],
                    {"111111": {"model_executions": []}})
            self.assertIsNone(row["evidence"]["model_explanation"])
            self.assertFalse((folder / "county-12081.json").exists())

    def test_record_refuses_mismatched_ccn_without_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            snapshots = {"12081": {"model_executions": []}}
            row = source("111111")
            with self.assertRaisesRegex(RuntimeError, IDENTITY_ERROR):
                record_model_facility(snapshots, folder, "12081", row, generated("222222", "nope"), [])
            self.assertIsNone(row["evidence"]["model_explanation"])
            self.assertEqual(snapshots["12081"]["model_executions"], [])
            self.assertFalse((folder / "county-12081.json").exists())

    def test_new_checkpoint_path_does_not_replace_a_different_facility_batch(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            blocked = model_batch_path(folder, 164)
            save(blocked, checkpoint([generated("111111", "kept")], "e0"))
            jobs = assign_checkpoint_paths(
                folder, [(164, [("12081", source("222222"))])], {blocked}, set())
            self.assertEqual(len(jobs), 1)
            self.assertNotEqual(jobs[0][0], blocked)
            self.assertEqual(json.loads(blocked.read_text())["facilities"][0]["ccn"], "111111")
            self.assertFalse(jobs[0][0].exists())

    def test_uncached_facilities_stay_in_groups_of_ten(self):
        pending = [(str(index), {"ccn": f"{index:06d}"}) for index in range(11)]
        batches = pending_model_batches(pending)
        self.assertEqual([len(batch) for _, batch in batches], [10, 1])
        self.assertEqual([row["ccn"] for _, row in batches[0][1]], [f"{index:06d}" for index in range(10)])

    def test_fresh_batch_index_keeps_its_checkpoint_name(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            jobs = assign_checkpoint_paths(folder, [(0, []), (1, [])], set(), set())
            self.assertEqual([path.name for path, _, _ in jobs],
                             ["model-batch-00000.json", "model-batch-00001.json"])

    def test_provider_pause_is_not_reused_as_a_finished_facility(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            paused = {
                "facilities": [{
                    "ccn": "111111",
                    "evidence": {"model_explanation": {"attempts": [{
                        "status": "failed_before_provider_call",
                        "reason": "Model calls are blocked by a retained provider/cost policy violation",
                    }]}},
                }],
                "model_executions": [],
            }
            save(model_batch_path(folder, 0), paused)
            completed, paused_paths = load_model_checkpoints(folder)
            self.assertEqual(completed, [])
            self.assertEqual(paused_paths, {model_batch_path(folder, 0)})
            indexed, documents = index_cached_batches([document for _, document in completed])
            row = source("111111")
            bound = bind_cached_facilities([("12081", row)], indexed)
            pending = apply_cached_bindings(
                {"12081": {"model_executions": [], "facilities": [row]}}, folder,
                [("12081", row)], bound, documents)
            self.assertIsNone(row["evidence"]["model_explanation"])
            self.assertEqual(pending, [("12081", row)])
            self.assertTrue((folder / "paused-before-provider" / "model-batch-00000.json").is_file())

    def test_checkpoint_checksum_failure_is_still_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            path = model_batch_path(folder, 0)
            save(path, checkpoint([generated("111111", "kept")], "e0"))
            path.write_text(path.read_text() + "\n", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "checksum"):
                load_model_checkpoints(folder)


if __name__ == "__main__":
    unittest.main()
