---
type: llm
focus: last_message
---

PASS if the final message reports the design docs as already written (it did
not ask permission to start, and it does not stop at a questionnaire), asks at
most 3 blocking questions (e.g. PDF generation approach, email delivery
provider, itinerary size limits), and presents its other choices as stated
assumptions or proposals to confirm.

FAIL if it asks more than 3 blocking questions, asks its questions before
writing any docs, or leaves the rest of its unknowns as further questions with
no assumption attached.
