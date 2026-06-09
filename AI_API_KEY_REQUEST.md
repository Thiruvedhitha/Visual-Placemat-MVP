# AI API Key Request & Model Selection
**Project**: Visual Placemat MVP
**Scope**: 2–3 concurrent users
**Date**: May 2026

---

## Model Comparison Table

| Provider | Model | Speed | Input $/MTok | Output $/MTok | JSON Reliability | Hallucination | API Key |
|----------|-------|-------|-------------|--------------|-----------------|---------------|---------|
| **OpenAI** | gpt-4.1-mini ✅ | ⚡ ~0.8s | $0.40 | $1.60 | ✅ Native Structured Outputs | 🟢 Very low | OPENAI_API_KEY |
| **OpenAI** | gpt-4.1 | ⚡ ~1.5s | $2.00 | $8.00 | ✅ Native Structured Outputs | 🟢 Very low | OPENAI_API_KEY |
| **OpenAI** | gpt-4o-mini | ⚡ ~0.7s | $0.15 | $0.60 | ✅ Native Structured Outputs | 🟢 Low | OPENAI_API_KEY |
| **Microsoft Copilot** (Azure OpenAI) | gpt-4.1-mini | ⚡ ~1s | ~$0.40* | ~$1.60* | ✅ Native Structured Outputs | 🟢 Very low | Azure API Key |
| **Anthropic** | claude-haiku-3-5 | ⚡ ~1s | $0.80 | $4.00 | ⚠️ Prompt-based only | 🟡 Moderate | ANTHROPIC_API_KEY |
| **Anthropic** | claude-sonnet-4-5 ✅ | ✅ ~2s | $3.00 | $15.00 | ✅ Good | 🟢 Low | ANTHROPIC_API_KEY |
| **Anthropic** | claude-opus-4-5 *(old)* | ❌ ~6s | $15.00 | $75.00 | ✅ Excellent | 🟢 Very low | ANTHROPIC_API_KEY |
| **GitHub Copilot** | GPT-4.1 / Sonnet | IDE only | — | — | ❌ No API access | — | ❌ Not usable in app |
| **Google** | gemini-2.0-flash | ⚡ ~0.6s | $0.10 | $0.40 | ⚠️ Moderate | 🟡 Moderate | GOOGLE_API_KEY |

> **GitHub Copilot** is a VS Code IDE assistant only — it **cannot be called from application backend code**. Not applicable as an API.

> **Microsoft Copilot API = Azure OpenAI Service** — same GPT models (gpt-4.1-mini etc.) hosted on Microsoft Azure, billed via Azure subscription. Requires an Azure account and Azure OpenAI resource. *Pricing is ~same as OpenAI direct; small Azure overhead may apply.*

---

## Note on GitHub Copilot / Microsoft Copilot

> **To Whom It May Concern,**
>
> During the evaluation of AI providers for the Visual Placemat application, **GitHub Copilot and Microsoft Copilot were considered but are not applicable** for this use case.
>
> GitHub Copilot is a developer productivity tool embedded within IDEs such as VS Code. It assists individual developers with code suggestions during development and **does not expose a callable API endpoint** that application backend code can invoke at runtime.
>
> Microsoft Copilot (the consumer/enterprise assistant) similarly **does not provide a REST API** that can be integrated into custom web applications.
>
> The correct Microsoft-hosted AI service for application integration is **Azure OpenAI Service**, which is the enterprise deployment of OpenAI's models (GPT-4.1, GPT-4.1 mini, etc.) on Microsoft Azure infrastructure. This requires a separate Azure subscription and Azure OpenAI resource — it is a distinct product from Copilot and is billed through Azure.
>
> For the current project scope (2–3 users, MVP stage), provisioning an Azure OpenAI resource introduces unnecessary overhead compared to using the OpenAI API directly. Therefore, **Option 1 (OpenAI direct API)** is the recommended approach.
>
> If the organisation has an existing Azure agreement and prefers to route all AI spend through Azure billing, Azure OpenAI Service can be substituted for Option 1 with no code changes beyond updating the base URL and API key.

---

---

## Cost at Current Scope (2–3 Users)

**Assumptions**: 3 users × 30 edits/day × 30 days = **2,700 requests/month**
Tokens per request: ~3,500 input + ~700 output

| Model | Normal Monthly | **Worst Case (10× spike)** | Annual |
|-------|---------------|---------------------------|--------|
| gpt-4o-mini | $0.13 | $1.30 | $1.56 |
| **gpt-4.1-mini** *(in code now)* | **$0.37** | **$3.70** | **$4.44** |
| gemini-2.0-flash | $0.05 | $0.50 | $0.60 |
| claude-haiku-3-5 | $0.54 | $5.40 | $6.48 |
| claude-sonnet-4-5 | $2.30 | $23.00 | $27.60 |
| claude-opus-4-5 *(old)* | $57.75 | $577.50 | $693.00 |

---

## Option 1 — OpenAI

**Purpose**

Requesting an OpenAI API key to power AI canvas editing in Visual Placemat. The model interprets natural language instructions and returns structured JSON commands to manipulate a capability map diagram.

**Usage Details**

| Parameter | Value |
|-----------|-------|
| API Provider | OpenAI |
| LLM Model | `gpt-4.1-mini` |
| Embeddings Model | `text-embedding-3-small` |
| Use Case (LLM) | Structured JSON command generation for canvas diagram editing |
| Use Case (Embeddings) | Semantic similarity search / RAG on uploaded capability documents |
| Avg tokens per transform request | ~3,500 input / ~700 output |
| Avg tokens per embedding request | ~5,000 tokens per document upload |
| Expected tokens per month | ~500K–1M tokens |
| **Monthly spend cap** | **$5** |
| Worst-case monthly | ~$3.70 |
| Integration files | `src/app/api/transform/route.ts`, `src/app/api/embeddings/route.ts` |

**What Is Needed**

- API key provisioned at `platform.openai.com` with a **$5/month** spend cap
- Environment variable `OPENAI_API_KEY` added to the app server config
- Outbound firewall rule: allow HTTPS (port 443) from app server to `api.openai.com`

**Security Notes**

- Key stored as a server-side environment variable only
- Never logged or exposed to the client/browser
- No inbound ports or webhooks required
- Embeddings stored in PostgreSQL (`pgvector`) — no data leaves the database after generation

---

## Option 2 — Anthropic

**Purpose**

Requesting an Anthropic API key to integrate Claude into Visual Placemat as an alternative AI provider. The model interprets natural language instructions and returns structured JSON commands to manipulate a capability map diagram.

> **Why Sonnet, not Haiku?** Haiku has *moderate* hallucination risk and *prompt-based* JSON only — meaning it can return malformed JSON. Claude Sonnet 4.5 has native tool-use enforcement (equivalent to Structured Outputs) and low hallucination, making it the reliable choice.

**Usage Details**

| Parameter | Value |
|-----------|-------|
| API Provider | Anthropic |
| Model | `claude-sonnet-4-5` |
| Use Case | Structured JSON command generation for canvas diagram editing |
| Avg tokens per request | ~3,500 input / ~700 output |
| Expected tokens per month | ~500K–1M tokens |
| **Monthly spend cap** | **$15** |
| Worst-case monthly | ~$6.90 |
| Integration file | `src/app/api/transform/route.ts` |

**What Is Needed**

- API key provisioned at `console.anthropic.com` with a **$15/month** spend cap
- Environment variable `ANTHROPIC_API_KEY` added to the app server config
- Outbound firewall rule: allow HTTPS (port 443) from app server to `api.anthropic.com`

**Security Notes**

- Key stored as a server-side environment variable only
- Never logged or exposed to the client/browser
- No inbound ports or webhooks required

---

## Option 1 vs Option 2 — Side-by-Side

| Criteria | Option 1 — OpenAI | Option 2 — Anthropic |
|----------|-------------------|----------------------|
| Provider | OpenAI | Anthropic |
| Model | `gpt-4.1-mini` | `claude-sonnet-4-5` |
| Speed | ⚡ ~0.8s | ✅ ~2s |
| JSON enforcement | ✅ Native Structured Outputs | ✅ Tool-use enforcement |
| Hallucination risk | 🟢 Very low | 🟢 Low |
| Input cost | $0.40/MTok | $3.00/MTok |
| Output cost | $1.60/MTok | $15.00/MTok |
| Normal monthly (2–3 users) | $0.37 | $2.30 |
| Worst-case monthly (10× spike) | $3.70 | $23.00 |
| Spend cap to set | **$5/month** | **$15/month** |
| Covers embeddings? | ✅ Yes (text-embedding-3-small) | ❌ No (OpenAI still needed for embeddings) |
| Status in code | ✅ Already integrated | ⏳ Needs integration |
| API key source | platform.openai.com | console.anthropic.com |
| Env variable | `OPENAI_API_KEY` | `ANTHROPIC_API_KEY` |

## Why Sonnet, Not Haiku (for Option 2)?

| | claude-haiku-3-5 ❌ | claude-sonnet-4-5 ✅ |
|--|--------------------|-----------------------|
| JSON output | ⚠️ Prompt-based — can return malformed structure | ✅ Tool-use enforced — reliable schema |
| Hallucination | 🟡 Moderate | 🟢 Low |
| Reliability for production use | ❌ Below acceptable threshold | ✅ Meets the bar |
| Cost saving vs Sonnet | ~$1.50/month at this scope | Not worth the reliability trade-off |

---

## Summary

| | Option 1 — OpenAI | Option 2 — Anthropic |
|--|-------------------|----------------------|
| Model | `gpt-4.1-mini` | `claude-sonnet-4-5` |
| Worst-case monthly | $3.70 | $23.00 |
| Spend cap | **$5/month** | **$15/month** |

**Total worst-case if both active: ~$26.70/month**
**Total annual worst-case: ~$320**

---

*Prices based on publicly available API pricing as of May 2026.*
