# data/scoring/

The fixed scoring formula for the call-first list. Weights live in
`weights.yaml`; every output row carries a per-term breakdown so a reviewer can
recompute the score by hand.

The coefficients are the project-approved prototype policy, not observed
measurements or a clinically validated priority order.

No scoring engine is implemented yet. Missing or unverified inputs must block
ranking, not become zeros or guessed values. Normalization, provenance and real
Zetaris query IDs are required before any ranked output is produced.
