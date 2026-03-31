# HuitSchedule

**Native Scheduling Engine for Huit.AI**  
Replaces Cal.com across CRMEX · HyperLoanAI · APEX

## What This Replaces
- Cal.com event types → `schedule_event_types` table
- Cal.com availability → `schedule_availability` table  
- Cal.com webhooks → Supabase triggers (native)
- Cal.com embed iframes → `/book?category=mortgage`
- `webhook-calendar` edge function → eliminated
- `agent-booking` Cal.com URL gen → native booking link
- `CAL_API_KEY` + `CAL_WEBHOOK_SECRET` → eliminated

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/event-types` | GET/POST | List or create event types |
| `/api/availability` | GET/PUT | Read or update availability |
| `/api/slots?event_type=slug&date=YYYY-MM-DD` | GET | Get available time slots |
| `/api/bookings` | GET/POST/DELETE | List, create, or cancel bookings |
| `/api/migrate` | POST | Run schema migration |

## Embeddable Booking Widget
```html
<iframe src="https://schedule.huit.ai/?category=mortgage" width="100%" height="700" frameborder="0"></iframe>
```

Categories: `mortgage`, `recruiting`, `sales`, `consulting`

## Schema
5 tables, RLS enabled, auto-sync trigger to `leads` table:
- `schedule_event_types`
- `schedule_availability`
- `schedule_date_overrides`
- `schedule_bookings`
- `schedule_intake_fields`

## Deploy
Deployed to Vercel at `schedule.huit.ai`

Built from Alaska. Scaled for everywhere.
