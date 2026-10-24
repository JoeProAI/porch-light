"""Regressions for the existing contract test corpus, never product data."""

import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from contract.validate_fixtures import FIXTURES, ROOT, validate


class ContractRegressionTests(unittest.TestCase):
    def changed(self, change):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            shutil.copytree(FIXTURES, directory, dirs_exist_ok=True)
            path = directory / "facilities_mock.json"
            data = json.loads(path.read_text())
            change(data["items"][0])
            path.write_text(json.dumps(data))
            return validate(directory)

    def test_original_labeled_test_corpus_validates(self):
        self.assertEqual(validate(), [])

    def test_wrong_weighted_product_is_rejected(self):
        errors = self.changed(lambda row: row["score"]["terms"][0].update(input=999))
        self.assertTrue(any("weighted product" in error for error in errors))

    def test_fact_reference_must_resolve(self):
        def corrupt(row):
            row["evidence"]["facts"][0]["query_id"] = row["id"]
        self.assertTrue(any("fact query_id" in error for error in self.changed(corrupt)))

    def test_rank_is_required(self):
        self.assertTrue(self.changed(lambda row: row["score"].pop("rank")))

    def test_score_is_required(self):
        self.assertTrue(self.changed(lambda row: row.pop("score")))

    def test_evidence_score_cannot_disagree(self):
        self.assertTrue(self.changed(lambda row: row["evidence"]["score"].update(total=1)))

    def test_python_required_ranked_fields_and_trace_query_ids(self):
        path = ROOT / "types/types.py"
        spec = importlib.util.spec_from_file_location("porch_light_contract_types", path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        with self.assertRaises(TypeError):
            module.RankedFacility(
                id="", country="us", name="", type=module.FacilityType.DIALYSIS,
                key=module.ExternalKey(type=module.ExternalKeyType.CCN, value=""), lat=0, lon=0,
            )
        trace = module.TraceStep(step="data_read", provider=module.ModelProvider.NONE,
                                 started_at="2026-10-22T00:00:00Z", query_ids=[])
        self.assertEqual(trace.query_ids, [])


if __name__ == "__main__":
    unittest.main()
