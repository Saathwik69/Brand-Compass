# Synthetic claim-check evaluation

Team-authored synthetic examples, including deliberate edge cases. NOT an independent benchmark or real-world accuracy estimate.

Task: Detect whether a text contains a factual/promotional statement requiring additional verification against the seeded facts.

| Measure | Result |
|---|---:|
| Cases | 30 |
| True positives | 14 |
| True negatives | 10 |
| False positives | 2 |
| False negatives | 4 |
| Precision | 87.5% |
| Recall | 77.8% |
| F1 | 82.4% |

Run `npm run evaluate` to reproduce. Fixed review date: 2026-11-07. No generative model is used. This small dataset tests claim-warning behaviour only, not the entire application. It was authored for this prototype, not collected independently.

## Errors to discuss with judges

- **FN:** Our bottle lasts twice as long. — Implicit numeric comparison is a known blind spot.
- **FN:** Buy it for half the price. — Implicit numerical pricing claim is a known blind spot.
- **FN:** This bottle is unbreakable. — Absolute claim outside the trigger vocabulary.
- **FN:** Our insulation outperforms every competitor. — Comparative wording outside the trigger vocabulary.
- **FP:** Best wishes from the Verdant team. — Best is used as a greeting, not a superiority claim.
- **FP:** Here are 3 ways to enjoy your walk. — A list heading uses a number without a factual product claim.

The detector deliberately misses some implicit claims and can overflag benign words or numbers. Human review remains required. Do not present the check score or these synthetic measurements as proof that a claim is true.
