import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/bookings — List bookings
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const email = searchParams.get('email');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('schedule_bookings')
    .select('*, schedule_event_types(name, slug, color, icon, category)')
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (email) query = query.eq('client_email', email);
  if (from) query = query.gte('scheduled_at', from);
  if (to) query = query.lte('scheduled_at', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data, count: data?.length || 0 });
}

// POST /api/bookings — Create booking
export async function POST(req: Request) {
  const body = await req.json();
  const {
    event_type_id, scheduled_at, client_name, client_email,
    client_phone, client_timezone, intake_data, client_notes,
    source, utm_source, utm_medium, utm_campaign
  } = body;

  // Validate required fields
  if (!event_type_id || !scheduled_at || !client_name || !client_email) {
    return NextResponse.json({ 
      error: 'Missing required fields: event_type_id, scheduled_at, client_name, client_email' 
    }, { status: 400 });
  }

  // Get event type for duration
  const { data: eventType, error: evtErr } = await supabase
    .from('schedule_event_types')
    .select('*')
    .eq('id', event_type_id)
    .single();

  if (evtErr || !eventType) {
    return NextResponse.json({ error: 'Event type not found' }, { status: 404 });
  }

  if (!eventType.is_active) {
    return NextResponse.json({ error: 'Event type is not active' }, { status: 400 });
  }

  // Check for time conflicts
  const bookingStart = new Date(scheduled_at);
  const bookingEnd = new Date(bookingStart.getTime() + eventType.duration_mins * 60000);
  const bufferStart = new Date(bookingStart.getTime() - (eventType.buffer_mins || 15) * 60000);
  const bufferEnd = new Date(bookingEnd.getTime() + (eventType.buffer_mins || 15) * 60000);

  const { data: conflicts } = await supabase
    .from('schedule_bookings')
    .select('id')
    .in('status', ['confirmed', 'rescheduled'])
    .gte('scheduled_at', bufferStart.toISOString())
    .lte('scheduled_at', bufferEnd.toISOString());

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: 'Time slot not available — conflict detected' }, { status: 409 });
  }

  // Create booking
  const { data: booking, error: bookErr } = await supabase
    .from('schedule_bookings')
    .insert({
      event_type_id,
      scheduled_at,
      duration_mins: eventType.duration_mins,
      client_name,
      client_email,
      client_phone: client_phone || null,
      client_timezone: client_timezone || 'America/Anchorage',
      intake_data: intake_data || {},
      client_notes: client_notes || null,
      source: source || 'api',
      utm_source, utm_medium, utm_campaign,
      status: 'confirmed',
      payment_amount: eventType.price_cents,
      payment_status: eventType.price_cents > 0 ? 'pending' : 'none',
    })
    .select('*')
    .single();

  if (bookErr) {
    return NextResponse.json({ error: bookErr.message }, { status: 500 });
  }

  return NextResponse.json({ 
    ok: true, 
    booking,
    event_type: eventType.name,
    message: `Booking confirmed for ${client_name} on ${new Date(scheduled_at).toLocaleString()}`
  }, { status: 201 });
}

// DELETE /api/bookings?id=xxx — Cancel booking
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const reason = searchParams.get('reason') || 'Canceled by admin';

  if (!id) return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });

  const { data, error } = await supabase
    .from('schedule_bookings')
    .update({ status: 'canceled', canceled_at: new Date().toISOString(), cancel_reason: reason })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, booking: data });
}
