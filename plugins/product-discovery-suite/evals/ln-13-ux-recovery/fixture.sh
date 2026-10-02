#!/usr/bin/env bash
set -euo pipefail
git init -q -b main .
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
mkdir -p docs/product docs/design web/src
cat > docs/product/requirements.md <<'MD'
# Payouts - product requirements

- **PAY-1 (ACCEPTED):** A seller must add a payout bank account before the first payout. Required fields: account holder name, country, IBAN. BIC is required only when the country is outside the SEPA area.
- **PAY-2 (ACCEPTED):** The IBAN is validated (format and checksum) before submit; the server repeats the validation and may also reject an account the bank cannot verify.
- **PAY-3 (ACCEPTED):** If submitting takes longer than 15 seconds the client stops waiting. The server is idempotent per submission key, so a repeated submit never creates a second account.
- **PAY-4 (ACCEPTED):** After success the seller returns to Payouts settings and sees the account masked to its last four characters.
- **PAY-5 (ACCEPTED):** The form must meet WCAG 2.2 AA and work on mobile widths from 320 px.
MD
cat > docs/design/components.md <<'MD'
# Design system components

- **TextField**: label above input, optional hint, inline error below the input (error icon plus text, `aria-describedby` link), never color-only.
- **Select**: same anatomy as TextField.
- **Banner**: page-level message (info, warning, error) placed above the form; can contain one action button; announced with `role="alert"` for errors.
- **Button**: primary and secondary; primary shows an inline spinner and is disabled while busy.
- **ErrorSummary**: list of links to invalid fields, shown above the form after a failed submit; receives focus when shown.
- Focus ring token: `focus.ring` (2 px, contrast 3:1 or better).
MD
cat > docs/support-tickets-2026-09.md <<'MD'
# Support ticket excerpts - payout account form (September 2026)

- "Got 'Error 500: IBAN_CHECKSUM_FAILED' and everything I typed was gone."
- "It spun for ages, then a blank form. Did it save my account or not?"
- "I typed my IBAN with spaces like on my bank card and it said error, no idea which field."
MD
cat > web/src/PayoutForm.tsx <<'TSX'
import { useState } from "react";

const EMPTY_FORM = { holder: "", country: "", iban: "", bic: "" };

export function PayoutForm({ submit }: { submit: (f: typeof EMPTY_FORM) => Promise<void> }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    try {
      await submit(form);
    } catch (e: any) {
      setError(`Error ${e.status}: ${e.code}`);
      setForm(EMPTY_FORM);
    }
  }

  return (
    <form onSubmit={(ev) => { ev.preventDefault(); onSubmit(); }}>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {/* fields omitted */}
      <button type="submit">Save</button>
    </form>
  );
}
TSX
git add -A
git commit -q -m "Payout requirements, design system notes and current form"
