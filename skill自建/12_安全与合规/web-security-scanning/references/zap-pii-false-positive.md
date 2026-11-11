# PII Alert False Positive Review

## Pattern: ZAP PII (plugin 10062) false positive on e-commerce filter pages

### Symptom

ZAP reports "PII 泄漏" / "PII Disclosure" at High risk, evidence showing apparent Visa card numbers like `45322 232 45323` or `15849 880 17434`. The "Other" field says "Credit Card Type detected: Visa".

### Root cause

ZAP's PII scanner (plugin `10062`) concatenates adjacent HTML token values into a candidate PAN:

- `<input name="DIN Standard" value="45322" />` (filter parameter ID)
- `<span class="count">232</span>` (adjacent product count)
- → ZAP reads `45322 232 45323` as "Visa starting with 453223"

### Verification method

1. Get the alert's `messageId`
2. Fetch the raw response body: `GET /JSON/core/view/message/?id={messageId}`
3. Locate the evidence numbers in the body with 200-300 chars of context
4. Check if the numbers are:
   - **Filter facet values** (class="checkbox", name="DIN Standard" / "Number of CLBs" etc.)
   - **Adjacent product counts** (class="count", e.g. "232" / "880")
   - **Actual continuous PAN** (13-19 digits, no spaces in the middle of the number)

### Marking as false positive in ZAP 2.17

```python
# confidenceId=0 = False Positive; 1=Low, 2=Medium, 3=High
# Can batch mark multiple IDs at once
gj("/JSON/alert/action/updateAlertsConfidence/", {"ids": "4336,4337,4662", "confidenceId": "0"})
```

### Evidence preservation

Save a JSON record with for each alert:
- `alert_id`, `name`, `url`, `messageId`
- `evidence`, `other` (from ZAP alert)
- `verdict` (`FALSE_POSITIVE` or `TRUE_POSITIVE`)
- `reason` (explanation in Chinese)
- `contexts` (array of `{number, context}` showing the number in surrounding HTML)

### Scoring

| Risk level | Confidence | Action |
|---|---|---|
| High | Medium | **Always verify** — fetch raw message body, check context |
| High | Low | Low confidence FP — still verify, but quicker |
| Medium | High | Usually real (e.g. CSP missing, X-Frame-Options missing) |
| Low | any | Template issues, check once per type, batch all instances |

### Known false positive patterns on xplorechips.com

| Path | Apparent PAN | Real meaning |
|---|---|---|
| `/connectors/` | `45322 232 45323` | DIN Standard filter IDs + adjacent product counts |
| `/connectors/din-connectors/` | `45329 223 47297` | DIN standard references + adjacent counts |
| `/programmable-logic/` | `15849 880 17434` | Number of CLBs filter values + adjacent counts |
| `/programmable-logic/field-programmable-gate-arrays/` | `15849 880 17434` | Number of CLBs filter values + adjacent counts |