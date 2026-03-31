import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/slots?event_type=slug&date=2026-04-01
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventSlug = searchParams.get('event_type');
  const dateStr = searchParams.get('date');

  if (!eventSlug || !dateStr) {
    return NextResponse.json({ error: 'Required: event_type (slug) and date (YYYY-MM-DD)' }, { status: 400 });
  }

  // Get event type
  const { data: eventType } = await supabase
    .from('schedule_event_types')
    .select('*')
    .eq('slug', eventSlug)
    .eq('is_active', true)
    .single();

  if (!eventType) {
    return NextResponse.json({ error: 'Event type not found or inactive' }, { status: 404 });
  }

  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay();

  // Get availability for this day
  const { data: avail } = await supabase
    .from('schedule_availability')
    .select('*')
    .eq('day_of_week', dow)
    .is('user_id', null)
    .single();

  if (!avail || !avail.is_active) {
    return NextResponse.json({ slots: [], message: 'No availability on this day' });
  }

  // Check date overrides
  const { data: override } = await supabase
    .from('schedule_date_overrides')
    .select('*')
    .eq('override_date', dateStr)
    .is('user_id', null)
    .single();

  if (override && !override.is_active) {
    return NextResponse.json({ slots: [], message: 'Date blocked: ' + (override.reason || 'unavailable') });
  }

  const windows = override?.windows || avail.windows || [];
  const duration = eventType.duration_mins;
  const buffer = eventType.buffer_mins || 15;
  const minNotice = (eventType.min_notice_hrs || 2) * 3600000;

  // Get existing bookings for this date
  const dayStart = new Date(dateStr + 'T00:00:00');
  const dayEnd = new Date(dateStr + 'T23:59:59');

  const { data: existingBookings } = await supabase
    .from('schedule_bookings')
    .select('scheduled_at, duration_mins')
    .in('status', ['confirmed', 'rescheduled'])
    .gte('scheduled_at', dayStart.toISOString())
    .lte('scheduled_at', dayEnd.toISOString());

  const now = new Date();
  const minBookTime = new Date(now.getTime() + minNotice);

  // Generate slots
  const slots: any[] = [];
  for (const w of windows as any[]) {
    const [startH, startM] = w.start.split(':').map(Number);
    const [endH, endM] = w.end.split(':').map(Number);
    let cursor = startH * 60 + startM;
    const endMinute = endH * 60 + endM;

    while (cursor + duration <= endMinute) {
      const slotDate = new Date(date);
      slotDate.setHours(Math.floor(cursor / 60), cursor % 60, 0, 0);

      if (slotDate > minBookTime) {
        const slotEnd = new Date(slotDate.getTime() + duration * 60000);

        // Check conflicts
        const hasConflict = (existingBookings || []).some((b: any) => {
          const bStart = new Date(b.scheduled_at);
          const bEnd = new Date(bStart.getTime() + b.duration_mins * 60000);
          const bBufferStart = new Date(bStart.getTime() - buffer * 60000);
          const bBufferEnd = new Date(bEnd.getTime() + buffer * 60000);
          return slotDate < bBufferEnd && slotEnd > bBufferStart;
        });

        if (!hasConflict) {
          const h = Math.floor(cursor / 60);
          const m = cursor % 60;
          slots.push({
            time: `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`,
            iso: slotDate.toISOString(),
            hour: h,
            minute: m,
          });
        }
      }
      cursor += 15;
    }
  }

  return NextResponse.json({
    date: dateStr,
    event_type: eventType.name,
    duration: duration,
    slots,
    count: slots.length,
  });
}
