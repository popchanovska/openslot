import { useEffect, useMemo, useState } from 'react';
import type { BookingCreated, PublicSlot } from '@teamlift/shared';
import { useProfile, useSlots } from '../api/hooks';
import { errorMessage } from '../api/client';
import { BookingDialog } from '../components/booking/BookingDialog';
import { DayTimes } from '../components/booking/DayTimes';
import { GuestCalendar } from '../components/booking/GuestCalendar';
import { ProfilePanel } from '../components/booking/ProfilePanel';
import { SuccessModal } from '../components/booking/SuccessModal';
import { Notice, useSlowFlag, WakingNotice } from '../components/ui';
import { DayKey, groupByDay, Month, monthKey, monthOf, todayKey } from '../lib/time';

export function BookPage() {
  const profile = useProfile();
  const slots = useSlots();
  const tz = profile.data?.timezone ?? 'Europe/Skopje';
  const today = todayKey(tz);

  const list = useMemo(() => slots.data?.slots ?? [], [slots.data]);
  const byDay = useMemo(() => groupByDay(list, tz), [list, tz]);
  const openCount = slots.data ? list.filter((s) => s.status === 'available').length : undefined;

  const [month, setMonth] = useState<Month>(() => monthOf(today));
  const [selected, setSelected] = useState<DayKey | null>(null);
  const [picked, setPicked] = useState<PublicSlot | null>(null);
  const [booked, setBooked] = useState<BookingCreated | null>(null);

  // Open on the first day that has something bookable, once data arrives.
  useEffect(() => {
    if (selected || !slots.data) return;
    const first = list.find((s) => s.status === 'available') ?? list[0];
    if (!first) return;
    const key = [...byDay.keys()].find((k) => byDay.get(k)!.includes(first))!;
    setSelected(key);
    setMonth(monthOf(key));
  }, [slots.data, selected, list, byDay]);

  const waking = useSlowFlag(profile.isPending || slots.isPending);

  return (
    <div className="flex min-h-full flex-col">
      <WakingNotice show={waking} />

      {/* On desktop the card fills the screen below the tab bar; on phones it stacks and scrolls. */}
      <div className="mx-auto flex w-full max-w-[1140px] flex-1 flex-col p-4 sm:p-6 lg:min-h-0">
        {slots.error && (
          <div className="mb-4">
            <Notice tone="error">{errorMessage(slots.error)}</Notice>
          </div>
        )}
        <div className="grid flex-1 border border-line bg-surface lg:min-h-0 lg:grid-cols-[280px_1fr_240px]">
          <aside className="border-b border-line p-6 lg:overflow-y-auto lg:border-r lg:border-b-0">
            <ProfilePanel profile={profile.data} openCount={openCount} />
          </aside>

          <div className="flex min-h-0 flex-col p-5 sm:p-6">
            <GuestCalendar
              month={month}
              onMonthChange={setMonth}
              canGoBack={monthKey(month) > monthKey(monthOf(today))}
              byDay={byDay}
              selected={selected}
              onSelect={setSelected}
              today={today}
            />
          </div>

          <div className="flex min-h-0 flex-col border-t border-line p-5 lg:border-t-0 lg:border-l">
            {slots.isPending ? (
              <div className="space-y-2.5" aria-hidden>
                <div className="h-5 w-2/3 animate-pulse bg-cell" />
                <div className="h-11 animate-pulse bg-cell" />
                <div className="h-11 animate-pulse bg-cell" />
              </div>
            ) : (
              <DayTimes
                day={selected}
                slots={selected ? (byDay.get(selected) ?? []) : []}
                tz={tz}
                onPick={setPicked}
                anyOpen={(openCount ?? 0) > 0}
              />
            )}
          </div>
        </div>
      </div>

      <BookingDialog
        slot={picked}
        tz={tz}
        onClose={() => setPicked(null)}
        onBooked={(b) => {
          setPicked(null);
          setBooked(b);
        }}
      />
      <SuccessModal booking={booked} tz={tz} onClose={() => setBooked(null)} />
    </div>
  );
}
