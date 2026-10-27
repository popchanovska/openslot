import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BookingCreated,
  BulkCreateResponse,
  Confirmation,
  CreateBooking,
  CreateSlot,
  GoogleStatus,
  InstructorCalendarResponse,
  Profile,
  PublicSlotsResponse,
  SlotPreviewResponse,
} from '@teamlift/shared';
import { api } from './client';

/* ---------- Public ---------- */

export const useProfile = () =>
  useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile'), staleTime: 5 * 60_000 });

export const useSlots = () =>
  useQuery({
    queryKey: ['slots'],
    queryFn: () => api<PublicSlotsResponse>('/slots'),
    // Keeps "unavailable" honest while the page sits open.
    refetchInterval: 60_000,
  });

export function useBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, input }: { slotId: string; input: CreateBooking }) =>
      api<BookingCreated>(`/slots/${slotId}/bookings`, { method: 'POST', body: input }),
    // Success or a 409, the list should show the latest state.
    onSettled: () => qc.invalidateQueries({ queryKey: ['slots'] }),
  });
}

export const useConfirmation = (bookingId: string) =>
  useQuery({
    queryKey: ['confirmation', bookingId],
    queryFn: () => api<Confirmation>(`/bookings/${bookingId}/confirmation`, { method: 'POST' }),
    staleTime: Infinity,
    retry: 1,
  });

/* ---------- Instructor ---------- */

export const useInstructorCalendar = (from: Date, to: Date) =>
  useQuery({
    queryKey: ['admin', 'calendar', from.toISOString(), to.toISOString()],
    queryFn: () =>
      api<InstructorCalendarResponse>(
        `/admin/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      ),
    placeholderData: (prev) => prev,
  });

export const useGoogleStatus = () =>
  useQuery({ queryKey: ['admin', 'google'], queryFn: () => api<GoogleStatus>('/admin/google/status') });

/** Every instructor change refreshes the dashboard and the public list. */
function useRefreshAll() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['admin'] }), qc.invalidateQueries({ queryKey: ['slots'] })]);
}

export function useCreateSlot() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: CreateSlot) =>
      api<{ id: string; startAt: string; endAt: string }>('/admin/slots', { method: 'POST', body: input }),
    onSuccess: refresh,
  });
}

export const useParseAvailability = () =>
  useMutation({
    mutationFn: (text: string) =>
      api<SlotPreviewResponse>('/admin/slots/parse', { method: 'POST', body: { text } }),
  });

export function useBulkCreate() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (slots: { startAt: string; endAt: string }[]) =>
      api<BulkCreateResponse>('/admin/slots/bulk', { method: 'POST', body: { slots } }),
    onSuccess: refresh,
  });
}

export function useDeleteSlot() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/slots/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}

export const useGoogleConnect = () =>
  useMutation({
    mutationFn: () => api<{ url: string }>('/admin/google/connect'),
    // A full-page redirect to Google's consent screen; Google sends the browser back to the API.
    onSuccess: ({ url }) => window.location.assign(url),
  });

export function useGoogleDisconnect() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: () => api<void>('/admin/google', { method: 'DELETE' }),
    onSuccess: refresh,
  });
}
