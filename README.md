\# Production-Grade AI CRM \& WhatsApp Follow-Up Orchestrator (n8n + Node.js + LLM Guardrails)



An end-to-end, fault-tolerant CRM \& WhatsApp automation engine built with \*\*n8n\*\*, \*\*Node.js (Baileys Multi-Tenant Gateway)\*\*, \*\*LLM APIs (OpenAI/Qwen)\*\*, and \*\*Google Sheets CRM\*\*. 



Designed specifically for high-compliance B2B/B2C environments where \*\*AI hallucinations (inventing prices, discounts, or financial terms) are strictly unacceptable\*\* and human-in-the-loop (CS/Broker) handoffs must be seamless.



\---



\## 🏗️ System Architecture \& Key Engineering Highlights



Unlike basic "Webhook-to-ChatGPT" workflows, this system implements strict state management, concurrency locks, and deterministic output validation:



\### 1. Deterministic AI Policy \& Anti-Hallucination Guardrails (`draft-policy.js`)

LLMs cannot be trusted to invent commercial figures. The `validateDraft()` engine enforces:

\- \*\*Strict JSON Schema Validation:\*\* Rejects malformed LLM outputs or unapproved offer keys.

\- \*\*Commercial Fact \& Number Filtering:\*\* Uses regex to block the AI from fabricating prices, currency symbols, discounts, quotas, or false guarantees.

\- \*\*Deterministic Fallbacks:\*\* Automatically degrades gracefully to human-approved stage-based templates if the AI output violates any policy rule.



\### 2. Distributed Batch Locking \& Rate-Limiting (`Follow\_Up\_World\_English\_v4\_2.json`)

\- \*\*Mutex Batch Acquisition (`/automation/batch/acquire`):\*\* Prevents overlapping cron executions from double-messaging leads. Batch tokens automatically expire after a 20-minute TTL if a worker crashes.

\- \*\*Operational Quota Enforcement:\*\* Enforces strict sliding-window limits and randomized human-like jitter delays (`45–120 seconds`) between prospects to prevent API bans.



\### 3. Pre-Send Stale-Intent Verification (Zero "Dumb Bot" Moments)

\- Right before dispatching an AI-generated follow-up, the workflow re-queries the live gateway and CRM.

\- If the prospect replied while the batch was waiting, or if a human agent changed the lead status to `Closing`, the revision check immediately aborts the send for that lead.



\### 4. Real-Time Bi-Directional Sensor (`Auto\_Capture\_World\_English\_v4\_2.json`)

\- Listens to incoming webhook events secured via Header Auth.

\- Tracks exact timestamps and state transitions across \*\*Customer\*\*, \*\*Human Agent\*\*, and \*\*AI\*\*, ensuring automated follow-ups immediately halt the moment a prospect engages.



\---



\## 📂 Repository Contents



\* \*\*`Follow\_Up\_World\_English\_v4\_2.json`\*\* — Main n8n scheduled orchestration workflow (batch lock acquisition, LLM context generation, pre-send revision check, randomized wait loop).

\* \*\*`Auto\_Capture\_World\_English\_v4\_2.json`\*\* — Real-time n8n webhook listener for capturing inbound/outbound WhatsApp events.

\* \*\*`draft-policy.js`\*\* — Node.js Code module enforcing multi-tenant catalog rules, regex guardrails, and LLM validation.

\* \*\*`Panduan\_Update\_v4\_2.md`\*\* — Full production deployment and rollback runbook.

