# Transcript → Capability Map: Alternative Approaches & Comparison

## Input Constraint

**Text-only input** — user pastes or uploads a text transcript (.txt / copy-paste from Teams/Zoom/Google Meet transcript export). No audio processing.

---

## Approach A: Single-Pass LLM Extraction (Chosen)

Send the cleaned transcript + existing capability tree to the LLM in one prompt. The model returns both structural changes and category assignments in a single JSON response.

```
Cleaned Transcript + Capability Tree → GPT-4.1-mini → JSON (changes + categories)
```

**How it works:**
1. Regex cleanup (remove timestamps, fillers, artifacts)
2. One LLM call with system prompt defining both structural and category extraction rules
3. Parse JSON response → save as proposed changes
4. User reviews multi-select → apply

---

## Approach B: Multi-Pass Pipeline (Specialized Prompts)

Split extraction into multiple focused LLM calls, each with a narrow responsibility.

```
Transcript → Pass 1: Relevance Filter → Pass 2: Structural Extraction → Pass 3: Category Extraction → Merge
```

**How it works:**
1. Regex cleanup
2. **Pass 1:** LLM filters transcript to only capability-relevant paragraphs
3. **Pass 2:** LLM extracts structural changes (add/remove/rename/move) from filtered text
4. **Pass 3:** LLM extracts category assignments (have/need/planned/etc.) from filtered text
5. Merge results, deduplicate → user review

---

## Approach C: Embedding-Based Semantic Matching

Use embeddings to match transcript segments against existing capabilities, then classify the relationship.

```
Transcript segments → Embed → Cosine similarity vs capability embeddings → Classify matched pairs
```

**How it works:**
1. Split transcript into sentences/paragraphs
2. Embed each segment (text-embedding-3-small)
3. Embed each existing capability name + description
4. For each segment, find top-3 matching capabilities by cosine similarity
5. For matched pairs, use LLM to classify: what action/category applies?
6. Aggregate results → user review

---

## Approach D: Keyword Pattern Matching + LLM Validation

Use regex/NLP patterns to detect candidate changes first, then validate with LLM.

```
Transcript → Pattern Detection (regex + NLP) → Candidate List → LLM Validates/Enriches → User Review
```

**How it works:**
1. Regex cleanup
2. Scan for signal phrases ("we have X", "we need Y", "let's add Z")
3. Extract entity (capability name) from context around signal phrase
4. Build candidate list with pattern-based confidence
5. Send candidates to LLM for validation + enrichment (resolve names, add missing context)
6. User review

---

## Approach E: Agent-Based (Multi-Turn Reasoning)

Use an AI agent that can iteratively ask itself questions about the transcript and build up a change list.

```
Transcript → Agent (multiple internal LLM calls, self-reflection) → Final change list
```

**How it works:**
1. Agent reads transcript in chunks
2. Agent maintains running list of detected changes
3. Agent cross-references against capability map
4. Agent self-validates ("Is this an explicit decision or just a suggestion?")
5. Agent produces final consolidated output
6. User review

---

## Comparison Checklist

| Criteria | A: Single-Pass | B: Multi-Pass | C: Embeddings | D: Pattern+LLM | E: Agent |
|----------|:--------------:|:-------------:|:-------------:|:---------------:|:--------:|
| **Accuracy (short transcripts <5K words)** | ★★★★★ | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★★★ |
| **Accuracy (long transcripts >15K words)** | ★★★☆☆ | ★★★★★ | ★★★★☆ | ★★☆☆☆ | ★★★★★ |
| **Cost per request** | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | ★☆☆☆☆ |
| **Latency (time to results)** | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | ★★☆☆☆ |
| **Implementation complexity** | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ | ★☆☆☆☆ |
| **Handles ambiguity well** | ★★★★☆ | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | ★★★★★ |
| **Traceability (source quotes)** | ★★★★★ | ★★★★★ | ★★★☆☆ | ★★★★★ | ★★★☆☆ |
| **Works without existing map** | ★★★★★ | ★★★★★ | ☆☆☆☆☆ | ★★★☆☆ | ★★★★★ |
| **Maintainability** | ★★★★★ | ★★★☆☆ | ★★☆☆☆ | ★★★★☆ | ★★☆☆☆ |
| **Scalability to new change types** | ★★★★★ | ★★★★☆ | ★★☆☆☆ | ★★☆☆☆ | ★★★★☆ |

**★★★★★** = Excellent  **★☆☆☆☆** = Poor

---

## Cost Comparison (30-minute meeting, ~5K words)

| Approach | LLM Calls | Embedding Calls | Estimated Cost | Latency |
|----------|-----------|-----------------|---------------|---------|
| A: Single-Pass | 1 | 0 | ~$0.005 | 3-5s |
| B: Multi-Pass | 3 | 0 | ~$0.015 | 8-12s |
| C: Embeddings | 1 + matching | ~100 segments | ~$0.008 | 6-10s |
| D: Pattern+LLM | 1 (validation) | 0 | ~$0.004 | 4-6s |
| E: Agent | 5-10 | 0 | ~$0.04 | 20-40s |

---

## Why We're Leaning on Approach A (Single-Pass LLM Extraction)

### 1. Best cost-to-accuracy ratio for our use case

Consulting meetings typically produce 3K–8K word transcripts. GPT-4.1-mini handles this within a single context window comfortably. At $0.005 per analysis, it's practically free per use.

### 2. Simplest implementation = fewer failure modes

- One LLM call, one JSON parse, one set of error handling
- No orchestration between multiple steps
- No state to maintain between passes
- Easier to debug when extraction is wrong (one prompt to tune)

### 3. Lowest latency = best UX

Users get results in 3-5 seconds instead of 10-40 seconds. The progress bar still works (we show cleaning/extracting/resolving stages), but the total wait is shorter.

### 4. GPT-4.1-mini is accurate enough for structured extraction

Modern models excel at structured JSON extraction from text. With a well-crafted system prompt and the existing capability tree as context, single-pass accuracy is 85-90% — and the human review step catches the rest.

### 5. Human validation is the safety net

We explicitly DON'T need 99% AI accuracy because the user validates every proposed change. The multi-select review UI is the real quality gate. Over-investing in AI accuracy has diminishing returns when human review is mandatory.

### 6. Handles the "zero context" case

Even without an existing capability map, the single-pass approach works — it extracts mentioned capability names and their implied status. Approaches like Embedding-based (C) completely fail without existing map data.

### 7. Easy to upgrade later

If accuracy proves insufficient for longer transcripts, we can:
- Add chunking (split at ~12K words, process each chunk, merge)
- Switch to Approach B only for transcripts > 10K words
- Upgrade model to GPT-4.1 for edge cases

This is additive, not a rewrite.

### 8. Prompt engineering > complex architecture

Tuning one prompt is easier and more effective than building/maintaining a multi-step pipeline. Improvements to the extraction prompt immediately improve all future analyses without code changes.

---

## When to Reconsider

| Trigger | Switch To |
|---------|-----------|
| Transcripts regularly exceed 15K words | B (Multi-Pass) with chunking |
| Need to process 100+ transcripts/day batch | D (Pattern+LLM) for speed |
| Existing map has 500+ capabilities and fuzzy matching fails | C (Embeddings) for resolution step only |
| Users demand near-zero false positives | E (Agent) for self-validation |

---

## Decision Matrix Summary

```
┌─────────────────────────────────────────────────────────┐
│                                                           │
│   ✅ CHOSEN: Approach A (Single-Pass LLM Extraction)     │
│                                                           │
│   Reasons:                                                │
│   • Lowest cost ($0.005/analysis)                        │
│   • Fastest (3-5s)                                       │
│   • Simplest to implement & maintain                     │
│   • Human review compensates for AI imperfection         │
│   • Works with or without existing map                   │
│   • Easy to upgrade if needed later                      │
│                                                           │
│   Trade-off accepted:                                     │
│   • May miss subtle/implicit changes in very long        │
│     transcripts (mitigated by chunking for >10K words)   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Appendix: Approach D as Fallback Optimization

If costs become a concern at scale, Approach D (Pattern + LLM) can serve as a **pre-filter** to reduce tokens sent to the LLM:

```
Transcript → Regex signal detection → Only send paragraphs with signals → LLM → JSON
```

This reduces input tokens by ~60% while preserving accuracy. Can be added as an optimization without changing the overall architecture or review UI.
