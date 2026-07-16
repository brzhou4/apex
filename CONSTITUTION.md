# The APEX Constitution

APEX is not a productivity app, a habit app, or a self-improvement app.

**APEX is the first app that helps you measure and improve your judgment about your own life.**

The company is an experiment. The hypothesis under test:

> People become better decision-makers when they repeatedly preregister
> predictions about their own behavior and compare them against reality.

Every feature must survive all seven articles. If it violates one, it doesn't
get built. Every pull request answers one question: **which article does this
serve?** If the answer is "none," it closes.

---

## Article 1 — Reality is the authority.

The app never declares success. Reality does. The AI never grades the user;
the world grades the user *and* the AI.

## Article 2 — Commit before observation.

No learning without preregistration. A prediction recorded after the outcome
is not a prediction. Hindsight bias is the fundamental bug; the timestamped
commitment is the fix.

## Article 3 — Reward exposure, not correctness.

Wrong predictions are valuable. Hidden predictions are worthless. XP flows to
making predictions, resolving them honestly, logging counterexamples, and
revising beliefs — never to having been right. The moment "being right"
becomes the target, people stop taking informative risks.

**The game may motivate exposure. It may never distort measurement.** The
pet, the streak, the XP exist to buy repeated exposure to reality; the moment
any reward depends on the *outcome* of a prediction rather than the *making*
of one, the instrument is dead. This is the one asymmetry the whole app rests
on.

## Article 4 — Every insight must expose provenance.

Every conclusion the app presents answers three questions:
- What evidence supports this?
- How confident are we?
- What would change our mind?

"We don't know yet" is a feature, and it is the most common honest answer.

## Article 5 — The AI is an instrument.

Never the authority. Never the life coach. Always the statistician and, much
later, the Socratic tutor. The human does the reasoning; the AI facilitates.

## Article 6 — The company obeys its own epistemology.

Every published claim ships with evidence, uncertainty, and limitations. The
flagship claim — "users become measurably better-calibrated forecasters of
their own behavior" — is itself a preregistered hypothesis, defended with
held-out transfer domains and cohort analysis, not survivorship-biased
on-app improvement.

## Article 7 — Symmetry: never ask of the user what the company won't do itself.

APEX never asks users to practice an epistemic behavior it refuses to
practice. If users preregister, APEX preregisters (PREDICTIONS.md). If users
expose uncertainty, APEX exposes uncertainty. If users update beliefs when
reality disagrees, APEX publishes its revisions — including the belief that
better calibration leads anywhere good at all (see PREDICTIONS.md #004: that
downstream link is an intermediate variable we hold uncertainly, not a
marketing claim we assume). The instrument is only trustworthy if it is
pointed at itself first.

## Article 8 — Never claim more than the evidence supports.

Findings are stated inside their envelope, never universalized. Not "sleep
causes better predictions" but "within this population, under these
conditions, we observed...". Three specific translations are forbidden and
their honest forms required:
- correlation is never dressed as cause;
- an intermediate variable is never dressed as an outcome (calibration ≠
  a better life until #004 says so);
- a finding from users willing to self-preregister is never dressed as a
  finding about people.

The restraint is not a legal hedge. It is the product. People trust an
instrument precisely because it refuses to overstate itself — the day APEX
oversells one finding, every other number it has ever shown becomes suspect.

---

## The norms (what the articles protect)

The articles are law; the norms are the culture the law exists to protect.
Code gets rewritten, phases complete, models change — what must survive is a
handful of norms a contributor who never met the founders should absorb from
this repo alone:

1. **Predictions happen before reality.**
2. **Being wrong is expected.**
3. **Updating is admirable.** Status lives in the *revision*, not the result:
   a careful, well-justified belief change outranks having been accurate. When
   the social layer is built, it rewards the best update, never the best score.
4. **Claims carry evidence.**
5. **The company updates itself publicly.**

Features merely instantiate norms. If a feature reinforces none of them, it
does not belong — the same filter as "which article does this serve," in the
language of culture instead of law.

The objective these norms serve, as sharply as it can be put: APEX does not
evaluate your knowledge (that is school) or your behavior (that is a
productivity app). **It evaluates the quality of the internal model you use
to predict yourself, and tries to improve it.** That is the unusual thing
being built, and the sentence to hand a stranger who asks what APEX is.

## The protocol

> Commit before reality. Compare after reality. Learn from the difference.

## Progressive disclosure

Insight is earned by data, not granted by defaults. An individual resolution
is a *receipt*, not an insight — receipts show immediately. The gates apply
to aggregates and interpretation:

- **0–29 resolved predictions** — receipts only. Calibration says "we don't know yet."
- **30+** — calibration becomes visible.
- **100+** — patterns, without interpretation. Evidence only.
- **300+** — the AI may ask questions about the patterns. Not answer them.
- **1000+** — the AI may propose *hypotheses*, each with supporting evidence,
  counterexamples, confidence, and an offer to test. Never conclusions.

## The three layers

- **Game** — the pet, streaks, XP: gets users back. XP rewards exposure
  (predictions made, honest resolutions, counterexamples), never correctness.
- **Instrument** — camera-verified sessions and preregistered predictions:
  collects reality.
- **School** — eventually, a curriculum that teaches each user's weakest
  epistemic skill, diagnosed by evidence, sequenced by software, graded by
  reality.

Each layer exists to enable the one beneath it.

## The frozen roadmap

- **Phase 0 — Constitution.** This document, before code.
- **Phase 1 — Atomic protocol.** Prediction (hidden during the session),
  verified resolution, immediate receipt, no interpretation.
- **Phase 2 — Calibration.** Brier score, confidence, progress meter, provenance.
- **Phase 3 — Curriculum.** Evidence-diagnosed lessons for the weakest
  epistemic skill. Not AI advice.
- **Phase 4 — Research.** Replicate the planning fallacy with a better
  instrument; then test whether preregistration + feedback improves
  calibration. Publish regardless of outcome.
- **Phase 5 — AI.** Only after all of the above, and asking more than telling.

Anything not in service of the central hypothesis waits. See PREDICTIONS.md
for the preregistered evaluation of each phase.
