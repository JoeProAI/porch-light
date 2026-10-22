"""Integration checks against the real dedicated PostGIS service and real captured inputs."""

import json
import subprocess
import unittest

from data.adapters.us.capture_census import source_records
from data.adapters.us.county_sources import CMS
from data.adapters.us.counties import MANATEE
from data.snapshot.db import CONTAINER, query_json
from data.snapshot.load_snapshot import load
from data.snapshot.reader import query as reader_query


class RealDatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.loaded = load(("manatee",))
        cls.snapshot = cls.loaded["snapshot_hash"]

    def rows(self, select):
        return query_json(
            select + f" WHERE snapshot_hash='{self.snapshot}' ORDER BY county_fips,ccn"
        )

    def test_real_source_rows_and_spatial_results_are_partitioned_by_county(self):
        self.assertEqual(self.loaded["coverage"], [
            {"county_fips": "12081", "source_rows": 20, "geography_rows": 18,
             "current_zone_covered_rows": 18, "svi_rows": 18, "empower_rows": 18},
        ])

    def test_original_cms_rows_are_preserved_in_jsonb(self):
        actual = {
            (row["source_kind"], row["ccn"]): row["raw_record"]
            for row in self.rows(
                "SELECT county_fips,source_kind,ccn,raw_record FROM porch_light.facility_source"
            )
        }
        expected = {}
        for profile in (MANATEE,):
            for kind, row, _ in source_records(CMS, profile):
                expected[(kind, row["CMS Certification Number (CCN)"])] = row
        self.assertEqual(actual, expected)

    def test_actual_refusals_have_no_invented_point(self):
        actual = query_json(
            "SELECT ccn,geography_observation->>'status' AS status,geom IS NULL AS no_point "
            "FROM porch_light.facility_source "
            f"WHERE snapshot_hash='{self.snapshot}' AND geom IS NULL ORDER BY ccn"
        )
        self.assertEqual({row["ccn"] for row in actual}, {"102538", "102646"})
        self.assertTrue(all(row["no_point"] for row in actual))

    def test_jdbc_exports_use_portable_scalar_columns_and_retain_limits(self):
        types = query_json(
            "SELECT column_name,udt_name FROM information_schema.columns "
            "WHERE table_schema='porch_light' AND table_name='facility_export'"
        )
        self.assertTrue(types)
        self.assertFalse(any(row["udt_name"] in ("geometry", "geography", "jsonb") for row in types))
        rows = self.rows(
            "SELECT county_fips,ccn,ranking_ready,zetaris_query_performed,"
            "archived_plan_captured FROM porch_light.facility_export"
        )
        self.assertEqual(len(rows), 20)
        self.assertTrue(all(not row["ranking_ready"] and not row["zetaris_query_performed"] for row in rows))
        self.assertTrue(all(not row["archived_plan_captured"] for row in rows if row["county_fips"] == "12115"))

    def test_restricted_role_authenticates_and_cannot_write_source_tables(self):
        proof = json.loads(reader_query(
            "SELECT json_build_object('role',current_user,"
            "'read_only',current_setting('default_transaction_read_only'),"
            "'can_write',has_table_privilege(current_user,'porch_light.facility_source','INSERT'),"
            f"'rows',(SELECT count(*) FROM porch_light.facility_export WHERE snapshot_hash='{self.snapshot}'));"
        ))
        self.assertEqual(proof, {
            "role": "porchlight_zetaris_read", "read_only": "on", "can_write": False, "rows": 20,
        })
        labels = subprocess.run(
            ["docker", "inspect", "--format", "{{json .NetworkSettings.Ports}}", CONTAINER],
            capture_output=True, text=True, check=True,
        )
        ports = json.loads(labels.stdout)
        self.assertFalse(any(value for value in ports.values()))

    def test_loading_the_same_inputs_again_is_idempotent(self):
        before = query_json(
            "SELECT count(*) AS rows FROM porch_light.facility_source "
            f"WHERE snapshot_hash='{self.snapshot}'"
        )
        again = load(("manatee",))
        self.assertEqual(again["snapshot_hash"], self.snapshot)
        after = query_json(
            "SELECT count(*) AS rows FROM porch_light.facility_source "
            f"WHERE snapshot_hash='{self.snapshot}'"
        )
        self.assertEqual(before, after)
        self.assertEqual(after, [{"rows": 20}])


if __name__ == "__main__":
    unittest.main()
