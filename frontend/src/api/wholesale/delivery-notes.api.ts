import { api } from '@/api/client';

export type DeliveryNoteStatus = 'DRAFT' | 'SENT' | 'DELIVERED' | 'CANCELLED';

export type DeliveryNote = {
  id: string;
  deliveryNoteNumber: string;
  customerId: string;
  status: DeliveryNoteStatus;
  driverName: string | null;
  vehicleNumber: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  deliveredAt: string | null;
  createdAt: string;
  items: { id: string; productNameSnapshot: string; quantity: number }[];
};

export async function listDeliveryNotes(params?: { status?: DeliveryNoteStatus; page?: number; limit?: number }) {
  const { data } = await api.get<{ data: DeliveryNote[]; meta: { total: number } }>(
    '/wholesale/delivery-notes',
    { params },
  );
  return data;
}

export async function createDeliveryNote(body: {
  customerId: string;
  saleId?: string;
  proformaInvoiceId?: string;
  items: { productId: string; quantity: number; notes?: string }[];
  driverName?: string;
  vehicleNumber?: string;
  deliveryAddress?: string;
  notes?: string;
}) {
  const { data } = await api.post<DeliveryNote>('/wholesale/delivery-notes', body);
  return data;
}

export async function markDeliveryNoteDelivered(id: string) {
  const { data } = await api.post<DeliveryNote>(`/wholesale/delivery-notes/${id}/mark-delivered`, {});
  return data;
}

export async function cancelDeliveryNote(id: string) {
  const { data } = await api.post<DeliveryNote>(`/wholesale/delivery-notes/${id}/cancel`);
  return data;
}
