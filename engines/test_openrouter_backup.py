"""OpenRouter backup gates, spend cap, and Meterless-primary fallback (mocked; no live spend)."""

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

from engines import openrouter_backup
from engines.grounded_drafts import DraftFailure, request_selections
from engines.generate_drafts import read_verified_snapshot


class OpenRouterBackupUnit(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)
        self.ledger = self.home / "openrouter-spend" / "ledger.jsonl"
        self.env = {
            "OPENROUTER_API_KEY": "sk-or-v1-test-key-not-real",
            "OPENROUTER_MAX_SPEND_USD": "5",
            "PORCHLIGHT_OPENROUTER_BACKUP": "call_script",
        }
        self.patches = [
            patch.object(openrouter_backup, "LEDGER_DIR", self.home / "openrouter-spend"),
            patch.object(openrouter_backup, "LEDGER", self.ledger),
            patch.dict(os.environ, self.env, clear=False),
            patch.object(openrouter_backup, "load_dotenv_files", return_value=[]),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in self.patches:
            item.stop()
        self.tmp.cleanup()

    def test_call_script_allowed_explanation_blocked(self):
        ok, _ = openrouter_backup.can_backup("call_script")
        self.assertTrue(ok)
        ok, why = openrouter_backup.can_backup("explanation_batch")
        self.assertFalse(ok)
        self.assertIn("not enabled", why)

    def test_cap_blocks_when_ledger_full(self):
        self.ledger.parent.mkdir(parents=True)
        with self.ledger.open("w", encoding="utf-8") as stream:
            stream.write(json.dumps({"actual_usd": 5.0}) + "\n")
        ok, why = openrouter_backup.can_backup("call_script")
        self.assertFalse(ok)
        self.assertIn("exhausted", why)

    def test_estimate_lightning_call_script_scale(self):
        # Matches the live Scout Intent receipt shape (~982 in / 1999 out).
        cost = openrouter_backup.estimate_usd(
            "nvidia/nemotron-3.5-lightning-30b-a3b",
            {"prompt_tokens": 982, "completion_tokens": 1999},
        )
        self.assertGreater(cost, 0)
        self.assertLess(cost, 0.01)

    def test_refuses_non_nemotron_model(self):
        with patch.dict(os.environ, {"OPENROUTER_NEMOTRON_MODEL": "openai/gpt-4o"}, clear=False):
            with self.assertRaises(openrouter_backup.OpenRouterDisabled):
                openrouter_backup.resolve_model("openai/gpt-4o")


class OpenRouterFallbackIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        snap = read_verified_snapshot(Path(__file__).parent / "snapshots/manatee-zetaris-chain.json")
        cls.row = snap["facilities"][0]

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)
        self.ledger = self.home / "openrouter-spend" / "ledger.jsonl"
        self.env_patch = patch.dict(os.environ, {
            "OPENROUTER_API_KEY": "sk-or-v1-test-key-not-real",
            "OPENROUTER_MAX_SPEND_USD": "5",
            "PORCHLIGHT_OPENROUTER_BACKUP": "call_script",
            "LOCALAPPDATA": str(self.home / "local"),
        }, clear=False)
        self.env_patch.start()
        (self.home / "local" / "ai.meterless.runtime").mkdir(parents=True)
        (self.home / "local" / "ai.meterless.runtime" / "proxy-token").write_text("meterless-test-token", encoding="utf-8")
        self.patches = [
            patch.object(openrouter_backup, "LEDGER_DIR", self.home / "openrouter-spend"),
            patch.object(openrouter_backup, "LEDGER", self.ledger),
            patch.object(openrouter_backup, "load_dotenv_files", return_value=[]),
            patch("engines.grounded_drafts.Path.home", return_value=self.home),
            patch("engines.model_budget.ROOT", self.home / "model-budget" / "porch-light-national-20261023"),
            patch("engines.model_budget.Path.home", return_value=self.home),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in self.patches:
            item.stop()
        self.env_patch.stop()
        self.tmp.cleanup()

    def test_meterless_http_failure_falls_back_to_openrouter(self):
        selection = {
            "id": "chatcmpl-openrouter-test",
            "model": "nvidia/nemotron-3.5-lightning-30b-a3b",
            "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
            "choices": [{"message": {"content": json.dumps({
                "drafts": [{
                    "ccn": self.row["ccn"],
                    "clause_ids": ["cms_rating", "tract_svi", "zip_context"],
                    "question_ids": ["contact", "power"],
                }]
            })}}],
        }

        def fake_urlopen(request, timeout=180):
            url = request.full_url if hasattr(request, "full_url") else request.get_full_url()
            if "127.0.0.1:8088" in url:
                raise HTTPError(url, 503, "Unavailable", hdrs=None, fp=None)
            if "openrouter.ai" in url:
                class Resp:
                    def read(self, n=-1):
                        return json.dumps(selection).encode()
                    def __enter__(self):
                        return self
                    def __exit__(self, *args):
                        return False
                return Resp()
            raise AssertionError(f"unexpected url {url}")

        with patch("engines.grounded_drafts.urlopen", side_effect=fake_urlopen):
            with patch("engines.openrouter_backup.urlopen", side_effect=fake_urlopen):
                result = request_selections([self.row], "call_script", run_id="test-or-backup")
        self.assertEqual(result["drafts"][0]["provider"], "openrouter")
        self.assertTrue(result["execution"]["paid_fallback_enabled"])
        self.assertEqual(result["execution"]["status"], "grounding_passed")
        self.assertTrue(self.ledger.exists())
        spent = openrouter_backup.spent_usd()
        self.assertGreater(spent, 0)
        self.assertLess(spent, 1)

    def test_explanation_batch_does_not_use_openrouter(self):
        def fake_urlopen(request, timeout=180):
            url = request.full_url if hasattr(request, "full_url") else request.get_full_url()
            raise HTTPError(url, 503, "Unavailable", hdrs=None, fp=None)

        with patch("engines.grounded_drafts.urlopen", side_effect=fake_urlopen):
            with self.assertRaises(DraftFailure) as ctx:
                request_selections([self.row], "explanation_batch", run_id="test-no-or")
        self.assertFalse(ctx.exception.event.get("paid_fallback_enabled"))
        self.assertIn("not enabled", ctx.exception.event.get("openrouter_backup_reason", ""))


if __name__ == "__main__":
    unittest.main()
