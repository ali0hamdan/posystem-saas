import { api } from '@/api/client';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type Reservation = {
  id: string; customerName: string; customerPhone: string | null; partySize: number;
  reservedAt: string; durationMin: number; status: ReservationStatus; tableId: string | null;
  notes: string | null; table?: { id: string; label: string } | null;
};
export type ReservationBody = {
  customerName: string; customerPhone?: string; partySize: number; reservedAt: string;
  durationMin?: number; tableId?: string | null; notes?: string;
};

export async function fetchReservations(params?: { date?: string; status?: ReservationStatus }): Promise<Reservation[]> {
  const { data } = await api.get<Reservation[]>('/fnb/reservations', { params });
  return data;
}
export async function createReservation(body: ReservationBody): Promise<Reservation> {
  const { data } = await api.post<Reservation>('/fnb/reservations', body);
  return data;
}
export async function updateReservation(id: string, body: Partial<ReservationBody>): Promise<Reservation> {
  const { data } = await api.patch<Reservation>(`/fnb/reservations/${id}`, body);
  return data;
}
export async function setReservationStatus(id: string, status: ReservationStatus): Promise<Reservation> {
  const { data } = await api.patch<Reservation>(`/fnb/reservations/${id}/status`, { status });
  return data;
}
export async function deleteReservation(id: string): Promise<Reservation> {
  const { data } = await api.delete<Reservation>(`/fnb/reservations/${id}`);
  return data;
}
