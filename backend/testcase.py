"""
testcase.py - Batch-eval ang SupportIQ chat endpoint gamit ang isang labeled JSON.

JSON schema (per case):
  {
    "id": 1,
    "question": "...",
    "expected_answer": "...",      # ground truth (gamit ng LLM judge)
    "category": "direct|paraphrase|multi-fact|inference|out-of-scope",
    "source": "..."
  }

Mula sa "category" nahihinuha ang TAMANG behavior:
  - "out-of-scope"  -> dapat i-DECLINE ng bot (fallback)
  - lahat ng iba    -> dapat MASAGOT ng bot (answered)

Sinusukat:
  - Behavior accuracy : sumagot ba kung dapat, at nag-decline ba kung dapat.
  - Factual accuracy  : (--judge) tama ba ang sagot vs expected_answer (LLM-as-judge).
  - Latency           : median / mean / p95 / max (ms).
  - Per-category breakdown.

Paggamit (mula sa backend/, may activated na venv, tumatakbo ang server):
  python testcase.py
  python testcase.py --company-id company_466
  python testcase.py novatech_rag_test_30.json --judge
  python testcase.py --base-url http://localhost:8000 --delay 0.3 --judge
"""
import argparse
import json
import os
import statistics
import sys
import time

import requests
from dotenv import load_dotenv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv()  # cwd / parents
load_dotenv(os.path.join(SCRIPT_DIR, ".env"))  # at ang katabi ng script (backend/.env)

# DAPAT eksaktong tugma sa FALLBACK_MESSAGE sa backend (app/services/rag_retrieval.py).
FALLBACK_MESSAGE = "Sorry, I don't have exact info to your inquiries."
ERROR_PREFIXES = ("AI error:", "Provider rate limit")
OUT_OF_SCOPE = "out-of-scope"

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_JUDGE_MODEL = os.getenv("OPENROUTER_JUDGE_MODEL", "openai/gpt-4.1-mini")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME")


def classify(reply: str) -> str:
    """answered | fallback | error -- katulad ng logic sa routes_chat.py."""
    if reply.startswith(ERROR_PREFIXES):
        return "error"
    if reply.strip() == FALLBACK_MESSAGE:
        return "fallback"
    return "answered"


def expected_behavior(category: str) -> str:
    return "fallback" if category == OUT_OF_SCOPE else "answered"


def percentile(values, p):
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(s) - 1)
    if f == c:
        return float(s[f])
    return s[f] + (s[c] - s[f]) * (k - f)


def llm_judge(question: str, expected: str, reply: str) -> bool:
    """LLM-as-judge: tama ba ang sagot ng bot vs ground truth? Returns True/False."""
    prompt = (
        "You are grading a customer-support bot against a reference answer.\n\n"
        f"Question: {question}\n"
        f"Reference answer (ground truth): {expected}\n"
        f"Bot answer: {reply}\n\n"
        "Does the bot answer convey the same key facts as the reference? "
        "Minor wording differences are fine; it just must not contradict or miss the key fact. "
        "Reply with ONLY 'YES' or 'NO'."
    )
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
    if OPENROUTER_SITE_URL:
        headers["HTTP-Referer"] = OPENROUTER_SITE_URL
    if OPENROUTER_APP_NAME:
        headers["X-Title"] = OPENROUTER_APP_NAME
    payload = {
        "model": OPENROUTER_JUDGE_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0,
        "max_tokens": 16,
    }
    r = requests.post(
        "https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=30
    )
    if r.status_code != 200:
        raise RuntimeError(f"{r.status_code} {r.text[:200]}")
    text = r.json()["choices"][0]["message"]["content"].strip().upper()
    return text.startswith("Y")


def resolve_path(path):
    """Hanapin ang file: ayon sa cwd; kung wala, subukan katabi ng script."""
    if os.path.exists(path):
        return path
    candidate = os.path.join(SCRIPT_DIR, path)
    if os.path.exists(candidate):
        return candidate
    return path  # hayaang mag-fail gamit ang orihinal na path


def load_cases(path):
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if isinstance(data, dict):
        return data.get("company_id"), data.get("cases", [])
    return None, data


def main():
    ap = argparse.ArgumentParser(description="Batch-eval ang SupportIQ chat endpoint.")
    ap.add_argument("json_file", nargs="?", default="novatech_rag_test_30.json",
                    help="Path sa JSON ng test cases")
    ap.add_argument("--base-url", default="http://localhost:8000")
    ap.add_argument("--company-id", default="company_466",
                    help="Company na may na-upload na docs (default: company_466)")
    ap.add_argument("--judge", action="store_true",
                    help="I-grade ang factual accuracy gamit ang LLM judge (nangangailangan ng OPENROUTER_API_KEY)")
    ap.add_argument("--delay", type=float, default=0.0,
                    help="Segundong hintay bawat request (gamitin kung may provider rate limit)")
    args = ap.parse_args()

    if args.judge and not OPENROUTER_API_KEY:
        print("Walang OPENROUTER_API_KEY -- hindi pwede ang --judge. Tanggalin ang --judge o ilagay ang key.")
        sys.exit(1)

    path = resolve_path(args.json_file)
    try:
        json_company, cases = load_cases(path)
    except FileNotFoundError:
        print(f"Hindi mahanap ang file: {args.json_file}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Sirang JSON: {e}")
        sys.exit(1)

    if not cases:
        print("Walang test cases sa JSON.")
        sys.exit(1)

    company_id = json_company or args.company_id
    url = f"{args.base_url}/api/chat"
    print("=== SupportIQ RAG eval ===")
    print(f"file: {args.json_file} | cases: {len(cases)} | company: {company_id} | judge: {'ON' if args.judge else 'off'}\n")

    behavior_ok = 0          # tamang behavior (sumagot/nag-decline ayon sa dapat)
    behavior_total = 0       # non-error cases
    inscope_answered = 0
    inscope_total = 0
    oos_declined = 0
    oos_total = 0
    judged = 0
    factual_ok = 0
    errors = 0
    latencies = []
    wrong_behavior = []      # (id, question, expected_behavior, got)
    factual_wrong = []       # (id, question, expected_answer, reply)

    # per-category: {cat: {"n":, "behavior_ok":, "judged":, "factual_ok":}}
    by_cat = {}

    for case in cases:
        cid = case.get("id", "?")
        question = case.get("question")
        expected_answer = case.get("expected_answer", "")
        category = case.get("category", "uncategorized")
        if not question:
            continue

        cat = by_cat.setdefault(category, {"n": 0, "behavior_ok": 0, "judged": 0, "factual_ok": 0})
        cat["n"] += 1
        want = expected_behavior(category)

        start = time.perf_counter()
        try:
            resp = requests.post(
                url,
                json={"company_id": company_id, "user_message": question},
                headers={"x-device-id": f"testcase-{cid}"},  # sariwang history + iwas rate-limit
                timeout=60,
            )
            elapsed_ms = (time.perf_counter() - start) * 1000
        except requests.exceptions.RequestException as e:
            print(f"[{cid:>2}] ERROR - hindi maabot ang backend: {e}")
            errors += 1
            continue

        if resp.status_code != 200:
            print(f"[{cid:>2}] ERROR - HTTP {resp.status_code}: {resp.text[:80]}")
            errors += 1
            continue

        reply = resp.json().get("reply", "")
        got = classify(reply)
        if got == "error":
            errors += 1
            print(f"[{cid:>2}] ERROR - provider/AI error")
            continue

        latencies.append(elapsed_ms)
        behavior_total += 1

        # --- Behavior check ---
        good_behavior = (got == want)
        if good_behavior:
            behavior_ok += 1
            cat["behavior_ok"] += 1
        else:
            wrong_behavior.append((cid, question, want, got, reply))

        if want == "answered":
            inscope_total += 1
            if got == "answered":
                inscope_answered += 1
        else:
            oos_total += 1
            if got == "fallback":
                oos_declined += 1

        # --- Factual check (judge) ---
        verdict = ""
        if args.judge and want == "answered" and got == "answered":
            try:
                ok = llm_judge(question, expected_answer, reply)
            except Exception as e:
                ok = None
                verdict = f"  judge-error: {e}"
            if ok is not None:
                judged += 1
                cat["judged"] += 1
                if ok:
                    factual_ok += 1
                    cat["factual_ok"] += 1
                    verdict = "  factual:OK"
                else:
                    verdict = "  factual:WRONG"
                    factual_wrong.append((cid, question, expected_answer, reply))

        mark = "ok" if good_behavior else f"WRONG (want {want})"
        print(f"[{cid:>2}] {category:12} {got:8} {elapsed_ms:6.0f}ms  {mark}{verdict}")

        if args.delay:
            time.sleep(args.delay)

    # ---------------- Summary ----------------
    print("\n--- Summary ---")
    print(f"Cases run:          {behavior_total}  (errors: {errors})")
    if behavior_total:
        print(f"Behavior accuracy:  {behavior_ok}/{behavior_total} ({behavior_ok / behavior_total * 100:.0f}%)")
    if inscope_total:
        print(f"  In-scope answered:    {inscope_answered}/{inscope_total} ({inscope_answered / inscope_total * 100:.0f}%)")
    if oos_total:
        print(f"  Out-of-scope declined: {oos_declined}/{oos_total} ({oos_declined / oos_total * 100:.0f}%)")
    if args.judge and judged:
        print(f"Factual accuracy:   {factual_ok}/{judged} ({factual_ok / judged * 100:.0f}%)  [LLM-judged, in-scope answered]")
    if latencies:
        print(
            "Latency ms:         "
            f"median {statistics.median(latencies):.0f} | "
            f"mean {statistics.mean(latencies):.0f} | "
            f"p95 {percentile(latencies, 95):.0f} | "
            f"max {max(latencies):.0f}"
        )

    print("\nPer-category:")
    for cat_name, c in by_cat.items():
        line = f"  {cat_name:13} behavior {c['behavior_ok']}/{c['n']}"
        if c["judged"]:
            line += f" | factual {c['factual_ok']}/{c['judged']}"
        print(line)

    if wrong_behavior:
        print("\nWrong behavior:")
        for cid, q, want, got, reply in wrong_behavior:
            print(f"  [{cid}] want={want} got={got}: {q}")
            print(f"        bot said: {reply}")
    if factual_wrong:
        print("\nFactually wrong (answered but mismatched ground truth):")
        for cid, q, exp, reply in factual_wrong:
            print(f"  [{cid}] {q}\n        expected: {exp}\n        got:      {reply}")


if __name__ == "__main__":
    main()
