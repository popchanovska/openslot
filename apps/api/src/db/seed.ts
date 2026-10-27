import 'dotenv/config';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { count } from 'drizzle-orm';
import { expandRule } from '../common/time';
import { createDb, createPool } from './db';
import { bookings, hostProfile, slots } from './schema';

/**
 * Demo data so a fresh deploy doesn't look empty: the host profile, two weeks of
 * afternoon slots, and three clearly fake bookings (@example.com).
 * Safe to re-run: slots and bookings are only added when the table is empty.
 */
async function seed() {
  const tz = process.env.APP_TIMEZONE || 'Europe/Skopje';
  const pool = createPool(process.env.DATABASE_URL!);
  const db = createDb(pool);

  const profile = {
    id: 1,
    name: 'Evgenija Popchanovska',
    title: 'AI Automation Instructor',
    bio: "Stuck on a prompt, an agent or an automation? Bring a real task from your work and we'll solve it together.",
    sessionMinutes: 30,
    location: 'Online · video call',
  };
  await db.insert(hostProfile).values(profile).onConflictDoUpdate({ target: hostProfile.id, set: profile });
  console.log('✓ Host profile');

  const [{ n }] = await db.select({ n: count() }).from(slots);
  if (n > 0) {
    console.log(`• ${n} slots already exist, skipping demo slots`);
    await pool.end();
    return;
  }

  const day = (offset: number) => formatInTimeZone(addDays(new Date(), offset), tz, 'yyyy-MM-dd');
  const generated = [
    ...expandRule(
      { weekdays: ['MON', 'TUE', 'THU'], dateFrom: day(1), dateTo: day(14), startTime: '16:00', endTime: '18:00', sessionMinutes: 30 },
      tz,
    ),
    ...expandRule(
      { weekdays: ['FRI'], dateFrom: day(1), dateTo: day(14), startTime: '10:00', endTime: '11:30', sessionMinutes: 30 },
      tz,
    ),
  ];
  const inserted = await db.insert(slots).values(generated).onConflictDoNothing().returning();
  console.log(`✓ ${inserted.length} demo slots`);

  const sorted = [...inserted].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const demo = [
    { i: 0, guestName: 'Peter Demo' },
    { i: 4, guestName: 'Sara Example' },
    { i: 9, guestName: 'Andrej Sample' },
  ];
  for (const d of demo) {
    const slot = sorted[d.i];
    if (!slot) continue;
    await db.insert(bookings).values({
      slotId: slot.id,
      guestName: d.guestName,
      guestEmail: `${d.guestName.split(' ')[0].toLowerCase()}@example.com`,
    });
  }
  console.log('✓ 3 demo bookings');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
