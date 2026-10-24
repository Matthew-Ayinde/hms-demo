# Hotel management system — clickable prototype

A front-end prototype of the proposed hotel management system (proposal HMS-2026-014), built for the client demo. All data is fake and lives in the browser. There is no backend, and no payments or messages are actually sent.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

For the demo itself, use the production build. It is faster and closer to the real thing:

```bash
npm run build && npm start
```

Use **Reset demo data** (bottom of the sidebar) between rehearsals. The data also reseeds automatically on a new calendar day, so "today" always has arrivals and departures.

## Make it the client's hotel

| What | Where |
|---|---|
| Hotel name, address, phone, TIN, bank details, taxes, check-in/out times, manager PIN | `lib/config.ts` → `HOTEL` |
| Room types | `lib/config.ts` → `ROOM_TYPES` |
| Starting rates, seasons, promo codes | `lib/seed.ts` (end of `buildSeed`). They can also be changed in the app under **Rooms & rates**. |
| Menu and prices | `lib/config.ts` → `MENU` |
| Staff names | `lib/config.ts` → `USERS`, `ATTENDANTS` |
| Rooms, guests and bookings | `lib/seed.ts` |
| Room photos | Add `public/rooms/std.jpg`, `dlx.jpg` and `exs.jpg`. Until then, an illustration is shown. |
| Brand colours | `app/globals.css` → `--color-brand`, `--color-brass` |

## Demo script (30–40 minutes)

Sign-in is a role picker with no passwords. The manager PIN for approvals is **2580**.

1. **Login (1 min).** Show the four roles and explain that each sees only its own screens.
2. **Dashboard, as Adaeze, the GM (2 min).** Occupancy, arrivals and departures, the 30-day revenue chart, the "Needs attention" list, and the live activity feed.
3. **Booking website (5 min).** Open *Booking website* in a new tab. Book tonight, add airport pickup, and pay in test mode. Show the confirmation and the WhatsApp preview.
4. **Reservations calendar (5 min).** The new booking appears in the *Unassigned* lane. Drag it onto a free room. Then drag a booking onto an occupied room: it is blocked with a red flash and a message. Click an empty cell to start a phone booking, pick a booked room, and show the **Double booking prevented** panel.
5. **Check-in, as Tunde at the front desk (5 min).** Check in Folake Adebayo (VIP, Room 307). Show the ID details, the room choice listing inspected rooms first, the deposit, and the signature pad.
6. **Housekeeping on a phone (5 min).** Open `/housekeeping` in a second window at phone size, signed in as Grace. Room 104 is dirty and Tobi Akinola is arriving. Tap *Start cleaning*, then *Mark clean*. The front desk's *Not ready* label changes to *Ready* without a refresh.
7. **Restaurant (4 min), as Adaeze or Musa.** Ring up jollof rice and a Chapman, then *Send order* and *Post to room* (307, surname "Adebayo"). Open Folake's folio: the charge is there.
8. **Check-out (5 min).** Departures → Daniel Mensah. Check-out is blocked by the outstanding balance. Take a split payment (card + cash). Try to void the laundry charge as Tunde: a wrong PIN is refused and 2580 works. Then check out: the invoice is issued and Room 203 goes to housekeeping.
9. **Reports and audit log (3 min), as Adaeze.** Occupancy, ADR, RevPAR, revenue by department and source, and a real **CSV export**. The audit log shows everything you just did, with names and times. Run **night audit** from the dashboard.
10. **Roles (1 min).** Sign in as Tunde and open `/reports`: *Not available for your role*.
11. **Guests (3 min), as Adaeze.** Open *Guests* and filter by *Possible duplicates*. Open Chiamaka Nwosu (VIP) and merge the duplicate profile: the phone booking moves across. Show stay history, preferences, consent, and **Export guest data** (NDPA). Peter Adamu is blacklisted. Try booking him as Tunde, and the booking is blocked.
12. **Rooms & rates (3 min).** The rate calendar shows weekend uplift, the *Trade fair week* season, closed dates for Standard rooms, and minimum stays. Change a price or base rate, then refresh the booking website: the new price is there. Try promo code **DIRECT10** on the booking website.
13. **Settings (2 min).** Tick *Reports* for Front office, then sign in as Tunde: Reports now appears. Switch off void approval and show that the PIN prompt disappears. Change the hotel name, and the invoice and booking website follow.
14. **Later phases (2 min).** Inventory, Channel manager (its rate-parity alerts use your live prices) and Events are labelled **Preview**. Use them to show where Phases 2 and 3 are heading.

End on the timeline in the proposal. Steps 2–5 and 8–9 are Phase 1, and housekeeping and POS are Phase 2.

### Be honest about what's simulated

Payments (Paystack test screen), email, WhatsApp, key-card encoding, kitchen printers and PDF generation are shown as messages only. Inventory, Channel manager and Events are design previews with sample data. The availability checks, pricing (10% service charge, then 7.5% VAT), folio balances, check-out rules, room-status changes, void approvals and the audit trail are real logic.

### Live-update tip

The sync between windows uses the browser's storage, so both windows must be **in the same browser on the same computer**. A real phone won't sync with the laptop until there is a backend. For the phone moment, use a second window, or Chrome DevTools device mode in a second window.

## Structure

```
app/
  login/                 role picker
  book/                  guest-facing booking engine
  (staff)/               sidebar layout with role guard
    dashboard/ front-desk/ reservations/ folio/[id]/ guests/ guests/[id]/
    housekeeping/ pos/ reports/ rates/ audit/ settings/
    inventory/ channels/ events/     Phase 2/3 previews (sample data)
components/              UI primitives, modals, check-in flow, folio, charts
lib/
  config.ts              hotel settings, rates, menu, users, permissions
  seed.ts                demo data, generated relative to today
  store.ts               zustand store; every action writes an audit entry
  availability.ts        overlap check and inventory per room type
  pricing.ts             service charge, VAT and folio totals
  rates.ts               nightly prices: base rate, weekend uplift, seasons, day rules, promos
  guests.ts              duplicate detection and lifetime guest stats
```
