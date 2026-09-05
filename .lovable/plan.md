# Fix ticket navigation and add selection-based event applications

## 1. Make My Passes open the ticket
- Replace the broken pass-card destination with the dedicated ticket route:
  ```tsx
  <Link
    key={o.id}
    to="/passes/$orderId"
    params={{ orderId: o.id }}
  >
  ```
- Keep pending and rejected cards opening the same detail page, where they show status only; show the QR and download action only for `APPROVED` + `ACTIVE` tickets.
- Verify the generated route tree contains `/passes/$orderId`, then test the real confirmed PIPECLEANER WORKSHOP card in an authenticated browser session and inspect console/runtime errors.

## 2. Store booking modes, questions, and applications
- Add `booking_type` to user-created events with default `instant`, preserving every existing event and the current join flow.
- Add event application questions with ordered text, type (`text`, `short_answer`, or `multiple_choice`), required flag, and choices for multiple-choice questions.
- Add one application per user/event with answers and statuses: Pending, Accepted, Rejected, Payment Pending, Confirmed.
- Protect all records so attendees manage only their own application, event hosts can read and update applications for events they own, and questions are visible wherever the event itself is visible.
- Keep Pride isolation intact by inheriting access through the parent event and never exposing real identities through the new tables.

## 3. Create and edit selection-based events
- Add a Booking Type choice to event creation and editing.
- Show a question builder only for Selection Based events, supporting add/remove/reorder, question type, choices, and required/optional settings.
- Save the event and its questions together from the user’s perspective; Instant Book remains the default and retains its current fields and behavior.

## 4. Apply and review
- On Selection Based event details, replace the normal join action with Apply.
- Present the host’s questions, validate required answers, and submit a Pending application without collecting payment.
- Show the applicant’s current status on the event page.
- Give hosts an application review area with applicant answers and Accept/Reject actions. Acceptance creates/updates the approved attendee record so existing attendee counts, chat unlocks, and event confirmation behavior continue to work.

## 5. Applications status screen
- Extend the existing Your events screen with an Applications tab.
- List each application with event details and status: Pending, Accepted, Rejected, Payment Pending, or Confirmed.
- Link each item back to its event.

## 6. Verification
- Confirm the build is clean and the generated routes are current.
- Browser-test the ticket click, direct ticket URL, QR visibility rules, event creation/editing in both modes, application submission, host decision, and applicant status display.
- Report authenticated and guest paths separately where applicable.
