# Anthropic Claude API Key Request — MVP Phase
**Project:** Visual Placemat — AI-Powered Capability Map Diagram Editor
**Phase:** MVP (No authentication, browser-session based, internal use only)
**Requested By:** [Your Name / Team]
**Date:** May 2026

---

## 1. What the MVP Is

Visual Placemat MVP is a no-login internal tool. Any user who opens the URL can
immediately upload an Excel capability map and start editing it visually.

- No sign-in, no user accounts
- Data is scoped to the browser session
- Small team / pilot testers only during MVP

The AI feature lets users edit the diagram by typing plain English:

- *"Make all top-level nodes dark blue"*
- *"Rename Finance to Financial Services"*
- *"Add Risk Management under Compliance"*
- *"Delete the Legacy Systems branch"*

The AI reads the current diagram, returns a list of changes (JSON), and the app
applies them locally for the user to review. **The user must click "Apply" to save
anything to the database — the AI never writes to the DB directly.**

---

## 2. Model Being Used

| Field | Value |
|---|---|
| **Model** | `claude-opus-4-5` |
| **Vendor** | Anthropic |
| **API endpoint** | `https://api.anthropic.com/v1/messages` |
| **Call type** | Single-turn (one prompt in → one response out) |
| **Max output tokens** | 2,048 per call |

---

## 3. Tokens Per API Call

Every call sends the full diagram tree as context so Claude knows what nodes exist.

| What is sent | Tokens (approx.) |
|---|---|
| Fixed system instructions | ~400 |
| Diagram tree — small (20–50 nodes) | ~800–1,200 |
| Diagram tree — medium (50–100 nodes) | ~1,500–2,500 |
| User's typed prompt | ~20–50 |
| **Total input per call (typical MVP diagram)** | **~1,000–2,000 tokens** |

| What is returned | Tokens (approx.) |
|---|---|
| JSON commands + summary sentence | ~200–600 tokens |
| **Total output per call** | **~200–600 tokens** |

**Realistic average per call (MVP): ~2,000 tokens total**

---

## 4. Pricing

| Token type | Rate (claude-opus-4-5) |
|---|---|
| Input | $3.00 per 1 million tokens |
| Output | $15.00 per 1 million tokens |

> Source: https://www.anthropic.com/pricing

### Cost per single AI prompt (typical MVP diagram, ~60 nodes)

| | Tokens | Cost |
|---|---|---|
| Input | ~1,500 | ~$0.0045 |
| Output | ~400 | ~$0.006 |
| **Total per call** | **~1,900** | **~$0.01 (1 cent)** |

---

## 5. MVP Monthly Cost Estimate

**MVP assumption:** Small internal team of 2–5 people testing the tool.

| Parameter | Value |
|---|---|
| Active testers | 2–5 people |
| Sessions per person per day | 1–2 |
| AI prompts per session | 5–10 |
| Working days per month | 22 |
| **Total AI calls / month** | **~440–2,200 calls** |
| **Total tokens / month** | **~880K–4.4M tokens** |
| **Estimated monthly cost** | **$5–$20 / month** |

### Worst-case MVP scenario (heavy testing, large diagrams)

| Parameter | Value |
|---|---|
| Testers | 5 |
| Prompts per day per tester | 20 |
| Large diagrams (~150 nodes, ~3,000 tokens/call) | — |
| **Total AI calls / month** | **~2,200 calls** |
| **Total tokens / month** | **~6.6M tokens** |
| **Worst-case monthly cost** | **~$30 / month** |

---

## 6. Recommended MVP Budget

| Item | Amount |
|---|---|
| **Requested monthly cap** | **$50 / month** |
| Expected actual spend | $5–$30 / month |
| Buffer for unexpected load | Covered by cap |

Set a **hard spending limit of $50/month** in the Anthropic console
(Settings → Billing → Usage limits). The API will reject calls once the cap is
hit — no surprise bills.

---

## 7. Rate Limits (MVP Tier 1 is sufficient)

Anthropic's **Tier 1** is available immediately after any first payment and is
more than enough for the MVP.

| Limit | Tier 1 (default) | MVP need |
|---|---|---|
| Requests per minute | 50 RPM | ~1–2 RPM |
| Tokens per minute | 40,000 TPM | ~2,000–4,000 TPM |
| Tokens per day | 1,000,000 | ~50,000–200,000 |

**No upgrade needed for MVP.** Tier 1 has 25× more headroom than we will use.

---

## 8. What IT Needs to Provide

| Requirement | Detail |
|---|---|
| **1 API key** | Created at console.anthropic.com |
| **Key name** | `visual-placemat-mvp` |
| **Stored as** | Environment variable: `ANTHROPIC_API_KEY` |
| **Used by** | Server-side only (Next.js API route — never the browser) |
| **Network rule** | Allow outbound HTTPS from app server to `api.anthropic.com:443` |
| **Key never logged** | Confirmed — key is only read from env, not printed or stored |

---

## 9. Steps to Create the Key

1. Go to **https://console.anthropic.com** → sign in / create account
2. **API Keys** → **Create Key** → name it `visual-placemat-mvp`
3. Copy the key (shown only once) and hand it to the developer
4. **Settings → Billing → Usage limits** → set monthly cap to **$50**
5. Optionally: set an email alert at **$20 spend** for early warning

---

## 10. After MVP — Next Phase Estimates

For reference when planning ahead:

| Phase | Users | Est. Monthly Cost |
|---|---|---|
| MVP (now) | 2–5 testers | **$5–$30** |
| Internal rollout | 10–20 users | **$50–$150** |
| Full production | 50+ users | **$300–$600** |

---

*Estimates are based on actual token measurements from the application's prompt
builder code. The diagram tree is the dominant cost factor — larger diagrams cost
more per call. Actual MVP spend is expected to be well under $30/month.*
