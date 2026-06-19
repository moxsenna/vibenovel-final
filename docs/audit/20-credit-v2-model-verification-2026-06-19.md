# Credit v2 OpenRouter Model Verification

- Verified at (UTC): `2026-06-19T10:32:39.680Z`
- Source: https://openrouter.ai/api/v1/models
- Mode: read-only catalog verification; no generation requests were sent.
- Authentication: anonymous catalog GET.
- Required runtime parameters: `max_tokens`, `temperature`.
- Catalog pricing is per token; values below are normalized to USD per 1M tokens.

| Requested model | Decision | Status | Canonical ID | Context | Input / 1M | Output / 1M | Snapshot drift |
|---|---|---|---|---:|---:|---:|---|
| `anthropic/claude-3-haiku` | ACTIVE | VERIFIED | `anthropic/claude-3-haiku` | 200,000 | $0.250000 | $1.250000 | none |
| `anthropic/claude-opus-4.6` | ACTIVE | VERIFIED | `anthropic/claude-4.6-opus-20260205` | 1,000,000 | $5.000000 | $25.000000 | none |
| `anthropic/claude-opus-4.8` | REJECTED | INCOMPATIBLE | `anthropic/claude-4.8-opus-20260528` | 1,000,000 | $5.000000 | $25.000000 | none |
| `deepseek/deepseek-v4-flash` | ACTIVE | VERIFIED | `deepseek/deepseek-v4-flash-20260423` | 1,048,576 | $0.090000 | $0.180000 | none |
| `google/gemini-2.5-flash` | ACTIVE | VERIFIED | `google/gemini-2.5-flash` | 1,048,576 | $0.300000 | $2.500000 | none |
| `google/gemini-3.1-flash-lite` | ACTIVE | VERIFIED | `google/gemini-3.1-flash-lite-20260507` | 1,048,576 | $0.250000 | $1.500000 | none |
| `google/gemini-3.1-pro-preview` | ACTIVE | VERIFIED | `google/gemini-3.1-pro-preview-20260219` | 1,048,576 | $2.000000 | $12.000000 | none |
| `google/gemma-4-31b-it:free` | ACTIVE | VERIFIED | `google/gemma-4-31b-it-20260402` | 262,144 | $0.000000 | $0.000000 | none |
| `minimax/minimax-m3` | ACTIVE | VERIFIED | `minimax/minimax-m3-20260531` | 1,048,576 | $0.300000 | $1.200000 | none |
| `mistralai/mistral-large-2512` | ACTIVE | VERIFIED | `mistralai/mistral-large-2512` | 262,144 | $0.500000 | $1.500000 | none |
| `openai/gpt-5.2` | REJECTED | INCOMPATIBLE | `openai/gpt-5.2-20251211` | 400,000 | $1.750000 | $14.000000 | none |
| `openrouter/free` | ACTIVE | VERIFIED | `openrouter/free` | 200,000 | $0.000000 | $0.000000 | none |
| `qwen/qwen3.7-plus` | ACTIVE | VERIFIED | `qwen/qwen3.7-plus-20260602` | 1,000,000 | $0.320000 | $1.280000 | none |

## Supported Parameters

### anthropic/claude-3-haiku

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `max_tokens`, `stop`, `temperature`, `tool_choice`, `tools`, `top_k`, `top_p`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

### anthropic/claude-opus-4.6

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `include_reasoning`, `max_completion_tokens`, `max_tokens`, `reasoning`, `response_format`, `stop`, `structured_outputs`, `temperature`, `tool_choice`, `tools`, `top_k`, `top_p`, `verbosity`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

### anthropic/claude-opus-4.8

- Routing decision: REJECTED
- Status: INCOMPATIBLE
- Parameters: `include_reasoning`, `max_tokens`, `reasoning`, `response_format`, `stop`, `structured_outputs`, `tool_choice`, `tools`, `verbosity`
- Missing required parameters: `temperature`
- Reason: Catalog record is missing required runtime capabilities or pricing

### deepseek/deepseek-v4-flash

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `frequency_penalty`, `include_reasoning`, `logit_bias`, `logprobs`, `max_tokens`, `min_p`, `presence_penalty`, `reasoning`, `repetition_penalty`, `response_format`, `seed`, `stop`, `structured_outputs`, `temperature`, `tool_choice`, `tools`, `top_k`, `top_logprobs`, `top_p`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

### google/gemini-2.5-flash

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `include_reasoning`, `max_tokens`, `reasoning`, `response_format`, `seed`, `stop`, `structured_outputs`, `temperature`, `tool_choice`, `tools`, `top_p`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

### google/gemini-3.1-flash-lite

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `include_reasoning`, `max_tokens`, `reasoning`, `response_format`, `seed`, `stop`, `structured_outputs`, `temperature`, `tool_choice`, `tools`, `top_p`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

### google/gemini-3.1-pro-preview

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `include_reasoning`, `max_tokens`, `reasoning`, `response_format`, `seed`, `stop`, `structured_outputs`, `temperature`, `tool_choice`, `tools`, `top_p`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

### google/gemma-4-31b-it:free

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `include_reasoning`, `max_tokens`, `min_p`, `reasoning`, `response_format`, `seed`, `stop`, `temperature`, `tool_choice`, `tools`, `top_a`, `top_k`, `top_p`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

### minimax/minimax-m3

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `frequency_penalty`, `include_reasoning`, `logit_bias`, `logprobs`, `max_tokens`, `min_p`, `presence_penalty`, `reasoning`, `repetition_penalty`, `response_format`, `seed`, `stop`, `structured_outputs`, `temperature`, `tool_choice`, `tools`, `top_k`, `top_logprobs`, `top_p`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

### mistralai/mistral-large-2512

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `frequency_penalty`, `max_tokens`, `presence_penalty`, `response_format`, `seed`, `stop`, `structured_outputs`, `temperature`, `tool_choice`, `tools`, `top_p`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

### openai/gpt-5.2

- Routing decision: REJECTED
- Status: INCOMPATIBLE
- Parameters: `include_reasoning`, `max_completion_tokens`, `max_tokens`, `reasoning`, `response_format`, `seed`, `structured_outputs`, `tool_choice`, `tools`
- Missing required parameters: `temperature`
- Reason: Catalog record is missing required runtime capabilities or pricing

### openrouter/free

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `frequency_penalty`, `include_reasoning`, `logprobs`, `max_tokens`, `min_p`, `presence_penalty`, `reasoning`, `repetition_penalty`, `response_format`, `seed`, `stop`, `structured_outputs`, `temperature`, `tool_choice`, `tools`, `top_a`, `top_k`, `top_p`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

### qwen/qwen3.7-plus

- Routing decision: ACTIVE
- Status: VERIFIED
- Parameters: `include_reasoning`, `logprobs`, `max_tokens`, `presence_penalty`, `reasoning`, `response_format`, `seed`, `structured_outputs`, `temperature`, `tool_choice`, `tools`, `top_logprobs`, `top_p`
- Missing required parameters: none
- Reason: Exact catalog match and compatible runtime parameters.

## Routing Decision

- All production routing IDs are constrained to the verified source records.
- `anthropic/claude-opus-4.8` and `openai/gpt-5.2` were not retained because the catalog did not advertise `temperature`, which the current client sends.
- Mode `terbaik` uses `anthropic/claude-opus-4.6` with `google/gemini-3.1-pro-preview` as fallback.
- User-facing credit prices are unchanged; this affects provider routing and internal cost telemetry only.
