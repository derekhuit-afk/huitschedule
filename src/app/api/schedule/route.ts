import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  const { action, data } = await req.json()

  // ── SMART_SLOTS: AI-optimized available slots ──
  if (action === 'smart_slots') {
    const { host_id, duration_mins, date_range_days = 7, meeting_type } = data
    const sb = db()
    const { data: bookings } = await sb.from('bookings')
      .select('start_at, end_at').eq('host_id', host_id)
      .gte('start_at', new Date().toISOString())
      .order('start_at')
    const { data: prefs } = await sb.from('scheduling_prefs')
      .select('*').eq('user_id', host_id).single()

    const completion = await ai.messages.create({
      model: process.env.AI_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 600,
      system: 'You are an AI scheduling optimizer for a mortgage professional. Generate optimal available time slots avoiding existing bookings. Respond as JSON only.',
      messages: [{
        role: 'user', content: `Generate available slots.
Host prefs: ${JSON.stringify(prefs || { work_hours_start: 9, work_hours_end: 17, timezone: 'America/Anchorage', buffer_mins: 15 })}
Existing bookings: ${JSON.stringify(bookings?.slice(0,20) || [])}
Duration: ${duration_mins} mins | Meeting type: ${meeting_type} | Days ahead: ${date_range_days}
Today: ${new Date().toISOString()}
Return JSON: { "slots": [{ "start": "ISO", "end": "ISO", "score": 1-100, "label": "string" }], "recommended": "ISO" }`
      }]
    })
    const raw = completion.content[0].type === 'text' ? completion.content[0].text : '{}'
    let result: any = {}
    try { result = JSON.parse(raw.replace(/```json|```/g, '').trim()) } catch {}
    return NextResponse.json({ success: true, ...result })
  }

  // ── BOOK: create a booking ──
  if (action === 'book') {
    const { host_id, attendee_name, attendee_email, start_at, end_at, meeting_type, notes, source_product } = data
    const sb = db()
    const { data: booking } = await sb.from('bookings').insert({
      host_id, attendee_name, attendee_email, start_at, end_at,
      meeting_type, notes, source_product,
      status: 'confirmed', confirmation_code: `HS-${Date.now().toString(36).toUpperCase()}`,
    }).select().single()

    // Queue reminders
    if (booking) {
      const reminders = [
        { booking_id: booking.id, send_at: new Date(new Date(start_at).getTime() - 24*60*60*1000).toISOString(), type: '24h' },
        { booking_id: booking.id, send_at: new Date(new Date(start_at).getTime() - 60*60*1000).toISOString(), type: '1h' },
        { booking_id: booking.id, send_at: new Date(new Date(start_at).getTime() - 15*60*1000).toISOString(), type: '15m' },
      ]
      await sb.from('booking_reminders').insert(reminders)
    }
    return NextResponse.json({ success: true, booking })
  }

  // ── RESCHEDULE: AI smart rescheduling ──
  if (action === 'reschedule') {
    const { booking_id, reason, preferred_window } = data
    const sb = db()
    const { data: booking } = await sb.from('bookings').select('*').eq('id', booking_id).single()
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const slotsRes = await fetch(req.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'smart_slots', data: { host_id: booking.host_id, duration_mins: 30, meeting_type: booking.meeting_type } })
    })
    const { slots } = await slotsRes.json()
    const best = slots?.[0]

    if (best) {
      await sb.from('bookings').update({ start_at: best.start, end_at: best.end, status: 'rescheduled', reschedule_reason: reason }).eq('id', booking_id)
    }
    return NextResponse.json({ success: true, new_slot: best, reason })
  }

  // ── EVENT_TYPES: manage meeting templates ──
  if (action === 'create_event_type') {
    const { host_id, name, duration_mins, description, color, buffer_mins, max_daily } = data
    const sb = db()
    const { data: et } = await sb.from('event_types').insert({
      host_id, name, duration_mins, description, color: color || '#2DD4BF',
      buffer_mins: buffer_mins || 15, max_daily: max_daily || 10,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
    }).select().single()
    return NextResponse.json({ success: true, event_type: et })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sb = db()
  const host_id = searchParams.get('host_id')
  const view = searchParams.get('view') || 'upcoming'

  if (view === 'upcoming' && host_id) {
    const { data } = await sb.from('bookings').select('*')
      .eq('host_id', host_id).gte('start_at', new Date().toISOString())
      .order('start_at').limit(20)
    return NextResponse.json({ bookings: data || [] })
  }
  if (view === 'event_types' && host_id) {
    const { data } = await sb.from('event_types').select('*').eq('host_id', host_id)
    return NextResponse.json({ event_types: data || [] })
  }
  return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
}
