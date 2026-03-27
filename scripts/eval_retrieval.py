"""
Retrieval evaluation script.

Mirrors the TypeScript getContext() pipeline exactly:
  - model: text-embedding-3-large, dimensions: 1024  (matches openai.ts)
  - namespaces: first-aid-2023, pathoma-2021
  - threshold: 0.30
  - topK per namespace: 10  → merged, sorted, top 7

Query battery covers:
  - Regression: HAE (was failing pre-fix)
  - Dilution neighbours (immunology section)
  - Strong-signal queries (should score ≥ 0.60 for model routing)
  - Chapter-level queries (expandChapterQuery smoke-test)
  - Cross-book queries
  - Edge cases: acronyms, symptoms, eponyms, mechanisms, negations,
    vague clinical, multi-step pathophysiology, drug mechanisms,
    rare conditions, single-word, abbreviations
"""

import os
import textwrap
from dotenv import load_dotenv
from openai import OpenAI
from pinecone import Pinecone

import argparse

load_dotenv(".env.local")

parser = argparse.ArgumentParser()
parser.add_argument("--hyde", action="store_true", help="Enable HyDE (Hypothetical Document Embeddings)")
parser.add_argument("--judge-only", action="store_true", help="Skip main eval, run only LLM-as-judge on gray zone")
args = parser.parse_args()

USE_HYDE = args.hyde

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
# Format: (query_string, scope, label, category)
# scope: "pathoma" | "first-aid" | "both"
# category used in summary grouping

QUERIES = [
    # ── REGRESSION ────────────────────────────────────────────────────────────
    ("hereditary angioedema",           "pathoma",    "HAE regression — must now pass",          "regression"),
    ("C1 inhibitor deficiency",         "pathoma",    "HAE via mechanism term",                  "regression"),
    ("angioedema of the skin swelling", "pathoma",    "HAE via clinical presentation",           "regression"),

    # ── DILUTION NEIGHBOURS ───────────────────────────────────────────────────
    ("CVID common variable immunodeficiency", "pathoma", "CVID — dilution neighbour",            "immunology"),
    ("IgA deficiency",                  "pathoma",    "IgA deficiency",                          "immunology"),
    ("Wiskott-Aldrich syndrome",        "pathoma",    "WAS — same section as HAE",               "immunology"),
    ("complement deficiency",           "pathoma",    "complement system",                       "immunology"),

    # ── STRONG SIGNAL (should score ≥ 0.60) ──────────────────────────────────
    ("myocardial infarction pathology", "pathoma",    "strong signal — cardiac",                 "strong"),
    ("nephrotic syndrome",              "pathoma",    "strong signal — kidney",                  "strong"),
    ("Reed-Sternberg cells",            "pathoma",    "strong signal — lymphoma",                "strong"),
    ("acute tubular necrosis",          "pathoma",    "strong signal — renal injury",            "strong"),
    ("Mallory bodies alcoholic hepatitis", "pathoma", "strong signal — liver",                   "strong"),
    ("Lewy bodies Parkinson disease",   "pathoma",    "strong signal — neuro",                   "strong"),

    # ── CROSS-BOOK ────────────────────────────────────────────────────────────
    ("Type I hypersensitivity IgE",     "both",       "cross-book immunology",                   "cross-book"),
    ("coagulation cascade hemophilia",  "both",       "cross-book hematology",                   "cross-book"),
    ("diabetes mellitus type 2 insulin resistance", "both", "cross-book endocrine",              "cross-book"),
    ("pneumonia consolidation lobar",   "both",       "cross-book respiratory",                  "cross-book"),

    # ── CHAPTER-LEVEL (expandChapterQuery smoke-test) ─────────────────────────
    ("pathoma chapter 2",               "pathoma",    "chapter expansion — inflammation",        "chapter"),
    ("pathoma chapter 4",               "pathoma",    "chapter expansion — hemostasis",          "chapter"),
    ("first aid chapter 8",             "first-aid",  "chapter expansion — cardiovascular",      "chapter"),
    ("second chapter pathoma",          "pathoma",    "ordinal chapter reference",               "chapter"),

    # ── ACRONYMS / ABBREVIATIONS ──────────────────────────────────────────────
    ("DIC",                             "both",       "acronym — disseminated intravascular coag","acronym"),
    ("SLE",                             "both",       "acronym — systemic lupus",                "acronym"),
    ("ARDS",                            "pathoma",    "acronym — acute respiratory distress",    "acronym"),
    ("DVT PE pulmonary embolism",       "both",       "acronym — thromboembolic disease",        "acronym"),
    ("AML blast crisis",                "pathoma",    "acronym — acute myeloid leukemia",        "acronym"),
    ("HUS TTP thrombocytopenia",        "pathoma",    "acronym — HUS/TTP",                      "acronym"),

    # ── EPONYMS ───────────────────────────────────────────────────────────────
    ("Virchow triad",                   "both",       "eponym — thrombosis triad",               "eponym"),
    ("Cushing syndrome hypercortisolism", "pathoma",  "eponym — adrenal",                        "eponym"),
    ("Horner syndrome",                 "pathoma",    "eponym — sympathetic chain",              "eponym"),
    ("Waterhouse-Friderichsen syndrome","pathoma",    "eponym — adrenal hemorrhage sepsis",      "eponym"),
    ("Trousseau sign hypocalcemia",     "both",       "eponym — hypocalcemia",                   "eponym"),

    # ── MECHANISM-ONLY QUERIES (no disease name) ──────────────────────────────
    ("podocyte foot process fusion",    "pathoma",    "mechanism → minimal change disease",      "mechanism"),
    ("anti-GBM antibody lung kidney",   "pathoma",    "mechanism → Goodpasture",                 "mechanism"),
    ("bradykinin edema swelling",       "pathoma",    "mechanism → HAE",                         "mechanism"),
    ("IgM cold agglutinin hemolysis",   "pathoma",    "mechanism → cold AIHA",                   "mechanism"),
    ("foam cells atherosclerosis lipid","pathoma",    "mechanism → atherosclerosis",             "mechanism"),

    # ── SYMPTOM CLUSTERS (clinical presentation) ──────────────────────────────
    ("leg swelling pitting edema",      "both",       "symptom — edema DDx",                     "symptom"),
    ("chest pain on exertion relieved rest", "pathoma","symptom — angina",                       "symptom"),
    ("bloody diarrhea abdominal cramps","pathoma",    "symptom — IBD / infectious colitis",      "symptom"),
    ("jaundice dark urine pale stool",  "pathoma",    "symptom — obstructive jaundice",          "symptom"),
    ("confusion asterixis elevated ammonia", "pathoma","symptom — hepatic encephalopathy",       "symptom"),

    # ── SINGLE-WORD QUERIES ───────────────────────────────────────────────────
    ("proteinuria",                     "pathoma",    "single-word — renal filtration",          "single-word"),
    ("hematuria",                       "pathoma",    "single-word — renal bleeding",            "single-word"),
    ("hemoptysis",                      "pathoma",    "single-word — pulmonary hemorrhage",      "single-word"),
    ("splenomegaly",                    "pathoma",    "single-word — spleen enlargement",        "single-word"),

    # ── DRUG MECHANISMS ───────────────────────────────────────────────────────
    ("ACE inhibitor bradykinin cough mechanism", "first-aid", "drug — ACE inhibitor side effect","drug"),
    ("warfarin vitamin K clotting factors", "both",  "drug — anticoagulation mechanism",        "drug"),
    ("methotrexate folate DHFR inhibition", "first-aid", "drug — MTX mechanism",               "drug"),
    ("heparin antithrombin mechanism",  "both",       "drug — heparin MOA",                      "drug"),

    # ── MULTI-STEP PATHOPHYSIOLOGY ────────────────────────────────────────────
    ("why does cirrhosis cause ascites","pathoma",    "pathophys — cirrhosis → ascites",         "pathophys"),
    ("portal hypertension esophageal varices caput medusae", "pathoma", "pathophys — portal HTN sequelae", "pathophys"),
    ("left heart failure pulmonary edema", "pathoma", "pathophys — CHF → pulmonary",            "pathophys"),

    # ── NEGATION / CONTRAST QUERIES ───────────────────────────────────────────
    ("difference between nephrotic and nephritic syndrome", "pathoma", "contrast — nephrotic vs nephritic", "contrast"),
    ("Crohn disease versus ulcerative colitis", "pathoma", "contrast — IBD comparison",          "contrast"),
    ("type 1 vs type 2 diabetes",       "both",       "contrast — DM types",                     "contrast"),

    # ── RARE / NICHE CONDITIONS ───────────────────────────────────────────────
    ("DiGeorge syndrome thymic aplasia T cell", "pathoma", "rare — DiGeorge",                   "rare"),
    ("Churg-Strauss eosinophilic granulomatosis", "pathoma", "rare — Churg-Strauss",            "rare"),
    ("Buerger disease thromboangiitis obliterans smoking", "pathoma", "rare — Buerger",         "rare"),
    ("Paget disease bone alkaline phosphatase", "pathoma", "rare — Paget bone",                 "rare"),

    # ── VAGUE / LAYPERSON QUERIES ─────────────────────────────────────────────
    ("kidney failure",                  "pathoma",    "vague — renal failure",                   "vague"),
    ("heart attack",                    "pathoma",    "vague — MI",                              "vague"),
    ("blood cancer",                    "pathoma",    "vague — hematologic malignancy",          "vague"),
    ("liver disease alcohol",           "pathoma",    "vague — alcoholic liver",                 "vague"),
]

# ── Helpers ───────────────────────────────────────────────────────────────────

HYDE_SYSTEM = (
    "You are a medical textbook author writing in the style of Pathoma and First Aid for the USMLE Step 1. "
    "Given a medical question or topic, write a focused 80-120 word textbook passage that directly covers "
    "the key facts, mechanisms, and clinical features. Use precise medical terminology. "
    "Do not include headers. Output only the passage text."
)


def generate_hypothetical_document(query: str) -> str:
    """Generate a hypothetical textbook passage for HyDE retrieval."""
    try:
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": HYDE_SYSTEM},
                {"role": "user", "content": query},
            ],
            temperature=0,
            max_tokens=160,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"  [HyDE fallback] {e}")
        return query


def embed(text: str) -> list[float]:
    resp = openai_client.embeddings.create(
        input=text.replace("\n", " "),
        model=EMBEDDING_MODEL,
        dimensions=DIMENSIONS,
    )
    return resp.data[0].embedding


def query_context(query: str, namespaces=None, use_hyde: bool = False) -> list[dict]:
    if namespaces is None:
        namespaces = NAMESPACES
    query_to_embed = generate_hypothetical_document(query) if use_hyde else query
    if use_hyde:
        print(f"  [HyDE] {textwrap.shorten(query_to_embed, width=100, placeholder='…')}")
    vec = embed(query_to_embed)
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
category_results: dict[str, list] = {}

print("\n" + "═" * 80)
print(f"RETRIEVAL EVALUATION  {'[HyDE ENABLED]' if USE_HYDE else '[standard]'}")
print("═" * 80)

for query, scope, label, category in QUERIES:
    ns = NAMESPACES if scope == "both" else (
        ["pathoma-2021"] if scope == "pathoma" else ["first-aid-2023"]
    )
    results = query_context(query, namespaces=ns, use_hyde=USE_HYDE)

    top_score = results[0]["score"] if results else 0
    hit = len(results) > 0
    strong = top_score >= STRONG_CONTEXT_THRESHOLD
    model_route = "gpt-5.4 (strong)" if strong else ("gpt-5.2 (weak)" if hit else "gpt-5.2 (no-ctx)")
    status = PASS if hit else FAIL

    print(f"\n{'─'*80}")
    print(f"[{category.upper()}] {query}")
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

    summary.append((status, top_score, query, label, category))
    category_results.setdefault(category, []).append((status, top_score))

# ── Summary by category ───────────────────────────────────────────────────────
print("\n\n" + "═" * 80)
print("SUMMARY BY CATEGORY")
print("═" * 80)

total_passed = 0
total_failed = 0
for cat, entries in sorted(category_results.items()):
    passed = sum(1 for s, _ in entries if s == PASS)
    failed = len(entries) - passed
    avg_score = sum(sc for _, sc in entries) / len(entries)
    strong_count = sum(1 for _, sc in entries if sc >= STRONG_CONTEXT_THRESHOLD)
    bar = "█" * int(avg_score * 20)
    print(f"  {cat:<12}  {passed}/{len(entries)} pass  {strong_count}/{len(entries)} strong  avg={avg_score:.3f} {bar}")
    total_passed += passed
    total_failed += failed

# ── Full summary table ────────────────────────────────────────────────────────
print("\n\n" + "═" * 80)
print("FULL RESULTS")
print("═" * 80)
print(f"  {total_passed}/{total_passed + total_failed} queries returned results above threshold ({MIN_SCORE})\n")

for status, score, query, label, category in summary:
    bar = "█" * int(score * 20)
    flag = " ← STRONG" if score >= STRONG_CONTEXT_THRESHOLD else (" ← FAIL" if status == FAIL else "")
    print(f"  {status}  {score:.3f} {bar:<20}  [{category:<11}]  {query[:45]:<45}{flag}")

print()
failed_count = sum(1 for s, *_ in summary if s == FAIL)
strong_count = sum(1 for _, sc, *_ in summary if sc >= STRONG_CONTEXT_THRESHOLD)
if failed_count > 0:
    print(f"  ⚠  {failed_count} queries returned no results — check chunking or re-index.")
else:
    print(f"  ✓  All {total_passed} queries returned results.")
print(f"  ✓  {strong_count}/{total_passed + total_failed} route to strong model (gpt-5.4) at ≥{STRONG_CONTEXT_THRESHOLD}")

# ── LLM-as-Judge: gray-zone audit ─────────────────────────────────────────────
# For chunks that pass the 0.30 threshold but score below 0.55 ("gray zone"),
# ask GPT-4o whether the top retrieved chunk is actually relevant to the query.
# This catches false positives — chunks that score OK but are off-topic.

GRAY_ZONE_MAX = 0.55
JUDGE_MODEL = "gpt-4o"

JUDGE_SYSTEM = """\
You are a medical retrieval evaluator. Given a user query and a retrieved text chunk,
determine whether the chunk is genuinely relevant and would help answer the query.
Reply with a single JSON object: {"relevant": true/false, "reason": "one sentence"}.
Do NOT add any other text."""

gray_zone = [
    (score, query, label, category)
    for status, score, query, label, category in summary
    if status == PASS and score < GRAY_ZONE_MAX
]

if not gray_zone:
    print(f"\n  ✓  No gray-zone results (all passes scored ≥ {GRAY_ZONE_MAX})")
else:
    import json as _json
    print(f"\n\n{'═' * 80}")
    print(f"LLM-AS-JUDGE  (gray zone: {MIN_SCORE} ≤ score < {GRAY_ZONE_MAX})  [{len(gray_zone)} queries]")
    print(f"{'═' * 80}")

    judge_passed = 0
    judge_failed = 0

    for score, query, label, category in gray_zone:
        ns = NAMESPACES if "both" in label else (
            ["pathoma-2021"] if "pathoma" in label.lower() or category != "cross-book" else ["first-aid-2023"]
        )
        results = query_context(query, namespaces=ns, use_hyde=USE_HYDE)
        if not results:
            continue
        top_chunk = results[0]["text"]
        breadcrumb = " > ".join(filter(None, [
            results[0]["book"], results[0]["chapter"],
            results[0]["section"], results[0]["subsection"]
        ]))

        user_msg = f"Query: {query}\n\nRetrieved chunk ({breadcrumb}):\n{top_chunk}"
        try:
            resp = openai_client.chat.completions.create(
                model=JUDGE_MODEL,
                messages=[
                    {"role": "system", "content": JUDGE_SYSTEM},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0,
                max_tokens=80,
            )
            verdict = _json.loads(resp.choices[0].message.content)
            relevant = verdict.get("relevant", False)
            reason = verdict.get("reason", "")
        except Exception as e:
            relevant = None
            reason = f"judge error: {e}"

        if relevant is True:
            icon = "✓ RELEVANT"
            judge_passed += 1
        elif relevant is False:
            icon = "✗ IRRELEVANT"
            judge_failed += 1
        else:
            icon = "? ERROR"

        print(f"\n  [{score:.3f}] {query[:55]:<55}  {icon}")
        print(f"           {breadcrumb}")
        print(f"           → {reason}")

    print(f"\n  Judge summary: {judge_passed} relevant / {judge_failed} irrelevant"
          f" / {len(gray_zone) - judge_passed - judge_failed} errors"
          f"  out of {len(gray_zone)} gray-zone chunks")
    if judge_failed > 0:
        print("  ⚠  Irrelevant chunks above — consider adding query expansions or re-chunking.")
