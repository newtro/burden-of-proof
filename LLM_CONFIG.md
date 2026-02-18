# LLM Configuration — Burden of Proof

## Models
- **Default (all NPCs):** `gpt-5-nano` — juror reactions, witness responses, opposing counsel plays, judge routine rulings
- **Elevated (key moments):** `gpt-5-mini` — jury deliberation, complex judge rulings, witness breaking points, opposing counsel strategy
- **Never use:** gpt-4o, gpt-4, or any pre-5 family models

## API Key
Stored in environment: `OPENAI_API_KEY`

## Cost Strategy
- gpt-5-nano for high-frequency, low-stakes calls (juror micro-reactions, witness small talk)
- gpt-5-mini only when the output materially affects gameplay outcome
- Batch juror reactions where possible (one call for all 12 jurors per turn, not 12 separate calls)
- Cache judge personality and rulings patterns to reduce redundant calls
