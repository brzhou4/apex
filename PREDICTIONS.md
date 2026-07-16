# PREDICTIONS.md

The company obeys its own epistemology (Constitution, Article 6). Before a
feature ships, we preregister what we expect it to do, how confident we are,
and what result would count as failure. Resolutions get appended — including
the wrong ones. **Never reward looking correct. Reward exposing yourself to
correction.**

---

## Prediction #001 — The protocol retains

**Registered:** 2026-07-11, before Phase 1 shipped.

**Claim:** Among users who resolve **5 or more** predictions, at least **50%**
will go on to resolve **15 or more** within 30 days of their fifth.

**Confidence:** 60%

**Why we believe it:** Receipts are about *you*, arrive instantly, and cost
10 seconds — the loop is tighter than any other mechanic in the app.

**Failure condition:** Fewer than 50% reach 15 resolutions → the atomic
protocol does not retain on its own and needs redesign, not decoration.

**Resolution:** *unresolved — awaiting data.*

---

## Prediction #002 — Feedback improves estimation (within-user)

**Registered:** 2026-07-11, before Phase 1 shipped.

**Claim:** For users with 20+ resolutions, the median absolute prediction
error of their **second ten** resolutions will be lower than their **first
ten**.

**Confidence:** 55%

**Why we believe it:** Immediate, unambiguous feedback is the textbook
condition for calibration practice (Tetlock-style forecasting training).

**Failure condition:** No within-user improvement → repeated preregistration
with honest feedback does not, by itself, improve self-prediction — the
central hypothesis takes a hit and we say so.

**Known confound (declared now, not after):** improvement measured only on
retained users is survivorship-biased; the resolution must report churned
cohorts alongside.

**Resolution:** *unresolved — awaiting data.*

---

## Prediction #003 — Planning fallacy replicates (V1 research claim)

**Registered:** 2026-07-11, before Phase 1 shipped.

**Claim:** Across each user's first 10 resolutions, **at least 60% of users**
will show mean signed error below zero (reality < prediction — people
overestimate how long they'll work).

**Confidence:** 70%

**Why we believe it:** This is a replication, not a discovery — the planning
fallacy (Buehler, Griffin & Ross, 1994) is one of the most robust effects in
judgment research. Our instrument should reproduce it in ecological settings
with camera-verified outcomes instead of self-report.

**Failure condition:** If it does *not* replicate, either our instrument is
broken or session-length predictions behave differently from task-duration
predictions (plausible — see limitation below). Both would be worth knowing.

**Declared limitation:** A prediction about one's own upcoming behavior is
part forecast, part commitment device — the two are entangled at n=1, and
session-length predictions are the most contaminated type. We hide the
predicted number during the session to reduce (not eliminate) goalpost
effects. Later prediction types (accuracy counts, week-horizon forecasts)
will be less contaminated.

**Resolution:** *unresolved — awaiting data.*
