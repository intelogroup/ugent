"""
Retrieval evaluation script.

Mirrors the TypeScript getContext() pipeline exactly:
  - model: text-embedding-3-large, dimensions: 1024  (matches openai.ts)
  - namespaces: first-aid-2023, pathoma-2021
  - threshold: 0.30
  - topK per namespace: 10  → merged, sorted, top 7

Tests a representative query battery covering:
  - The previously broken HAE query (root-cause regression)
  - Related immunology conditions (dilution neighbours)
  - Strong-signal queries (should still score ≥ 0.60 for model routing)
  - Chapter-level queries (expandChapterQuery smoke-test)
  - Cross-book queries
"""

import os
import textwrap
from dotenv import load_dotenv
from openai import OpenAI
from pinecone import Pinecone

load_dotenv(".env.local")

# ── Constants matching the TypeScript app ────────────────────────────────────
EMBEDDING_MODEL = "text-embedding-3-large"
DIMENSIONS = 1024          # must match openai.ts getEmbedding()
NAMESPACES = ["first-aid-2023", "pathoma-2021"]
MIN_SCORE = 0.30
TOP_K_PER_NS = 10
TOP_K_FINAL = 7
STRONG_CONTEXT_THRESHOLD = 0.60   # model routing threshold from route.ts

# ── Clients ───────────────────────────────────────────────────────────────────
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))

# ── Index stats (dimension sanity check) ─────────────────────────────────────
stats = index.describe_index_stats()
index_dim = stats.get("dimension", "?")
print(f"\nIndex dimension : {index_dim}  (app queries at: {DIMENSIONS})")
if index_dim != DIMENSIONS:
    print(f"  ⚠  DIMENSION MISMATCH — stored={index_dim} vs queried={DIMENSIONS}")
    print("     Scores will be meaningless. Fix embed_books.py DIMENSIONS before re-indexing.")
else:
    print("  ✓  Dimensions match")

ns_stats = stats.get("namespaces", {})
for ns in NAMESPACES:
    count = ns_stats.get(ns, {}).get("vector_count", 0)
    print(f"  {ns}: {count:,} vectors")

# ── Query battery ─────────────────────────────────────────────────────────────
QUERIES = [
    # --- Regression: HAE (was failing pre-fix) ---
    ("hereditary angioedema",          "pathoma",    "HAE regression — must now pass"),
    ("C1 inhibitor deficiency",        "pathoma",    "HAE via mechanism term"),
    ("angioedema of the skin swelling","pathoma",    "HAE via clinical presentation"),

    # --- Dilution neighbours (same immunology section as HAE) ---
    ("CVID common variable immunodeficiency", "pathoma", "CVID — dilution neighbour"),
    ("IgA deficiency",                 "pathoma",    "IgA deficiency"),
    ("Wiskott-Aldrich syndrome",       "pathoma",    "WAS — same section as HAE"),
    ("complement deficiency",          "pathoma",    "complement system"),

    # --- Strong-signal queries (should score ≥ 0.60) ---
    ("myocardial infarction pathology","pathoma",    "strong signal — cardiac"),
    ("nephrotic syndrome",             "pathoma",    "strong signal — kidney"),
    ("Reed-Sternberg cells",           "pathoma",    "strong signal — lymphoma"),

    # --- Cross-book ---
    ("Type I hypersensitivity IgE",    "both",       "cross-book immunology"),
    ("coagulation cascade hemophilia", "both",       "cross-book hematology"),

    # --- Chapter-level (expandChapterQuery) ---
    ("pathoma chapter 2",              "pathoma",    "chapter expansion smoke-test"),
]


def embed(text: str) -> list[float]:
    resp = openai_client.embeddings.create(
        input=text.replace("\n", " "),
        model=EMBEDDING_MODEL,
        dimensions=DIMENSIONS,
    )
    return resp.data[0].embedding


def query_context(query: str, namespaces=None) -> list[dict]:
    if namespaces is None:
        namespaces = NAMESPACES
    vec = embed(query)
    results = []
    for ns in namespaces:
        resp = index.query(vector=vec, top_k=TOP_K_PER_NS, include_metadata=True, namespace=ns)
        for m in resp.matches:
            results.append({
                "score": m.score or 0,
                "ns": ns,
                "book": (m.metadata or {}).get("book", ""),
                "chapter": (m.metadata or {}).get("chapter", ""),
                "section": (m.metadata or {}).get("section", ""),
                "subsection": (m.metadata or {}).get("subsection", ""),
                "text": (m.metadata or {}).get("text", "")[:200],
            })
    results.sort(key=lambda r: r["score"], reverse=True)
    results = [r for r in results if r["score"] >= MIN_SCORE]
    return results[:TOP_K_FINAL]


# ── Run ───────────────────────────────────────────────────────────────────────
PASS = "✓ PASS"
FAIL = "✗ FAIL"

summary = []

print("\n" + "═" * 80)
print("RETRIEVAL EVALUATION")
print("═" * 80)

for query, scope, label in QUERIES:
    ns = NAMESPACES if scope == "both" else (
        ["pathoma-2021"] if scope == "pathoma" else ["first-aid-2023"]
    )
    results = query_context(query, namespaces=ns)

    top_score = results[0]["score"] if results else 0
    hit = len(results) > 0
    strong = top_score >= STRONG_CONTEXT_THRESHOLD
    model_route = "gpt-5.4 (strong)" if strong else ("gpt-5.2 (weak)" if hit else "gpt-5.2 (no-ctx)")
    status = PASS if hit else FAIL

    print(f"\n{'─'*80}")
    print(f"Query   : {query}")
    print(f"Label   : {label}")
    print(f"Status  : {status}  top_score={top_score:.3f}  hits={len(results)}  model→{model_route}")

    if results:
        r = results[0]
        breadcrumb = " > ".join(filter(None, [r["book"], r["chapter"], r["section"], r["subsection"]]))
        preview = textwrap.shorten(r["text"], width=120, placeholder="…")
        print(f"  #1 [{r['score']:.3f}] {breadcrumb}")
        print(f"       {preview}")
        if len(results) > 1:
            r2 = results[1]
            bc2 = " > ".join(filter(None, [r2["book"], r2["chapter"], r2["section"], r2["subsection"]]))
            print(f"  #2 [{r2['score']:.3f}] {bc2}")
    else:
        print("  (no results above threshold)")

    summary.append((status, top_score, query, label))

# ── Summary table ─────────────────────────────────────────────────────────────
print("\n\n" + "═" * 80)
print("SUMMARY")
print("═" * 80)
passed = sum(1 for s, *_ in summary if s == PASS)
failed = sum(1 for s, *_ in summary if s == FAIL)
print(f"  {passed}/{len(summary)} queries returned results above threshold ({MIN_SCORE})\n")

for status, score, query, label in summary:
    bar = "█" * int(score * 20)
    print(f"  {status}  {score:.3f} {bar:<20}  {query[:45]:<45}  [{label}]")

print()
if failed > 0:
    print(f"  ⚠  {failed} queries returned no results — check chunking or re-index.")
else:
    print("  ✓  All queries returned results.")
