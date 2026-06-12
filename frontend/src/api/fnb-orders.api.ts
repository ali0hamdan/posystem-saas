import { api } from '@/api/client';

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
export type OrderStatus = 'OPEN' | 'SENT' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
export type OrderItemStatus = 'PENDING' | 'SENT' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export type OrderItemModifier = { id: string; name: string; priceDelta: number | string };
export type OrderItem = {
  id: string; menuItemId: string | null; name: string; quantity: number;
  unitPrice: number | string; modifiersTotal: number | string; lineTotal: number | string;
  status: OrderItemStatus; notes: string | null; modifiers: OrderItemModifier[];
};
export type Order = {
  id: string; orderNumber: string; type: OrderType; status: OrderStatus;
  tableId: string | null; guestCount: number; subtotal: number | string;
  discountTotal: number | string; taxTotal: number | string; total: number | string;
  notes: string | null; deliveryAddress: string | null; deliveryPhone: string | null; driverName: string | null;
  items: OrderItem[]; table?: { id: string; label: string } | null;
};

export async function fetchOrders(params?: { status?: OrderStatus; tableId?: string }): Promise<Order[]> {
  const { data } = await api.get<Order[]>('/fnb/orders', { params });
  return data;
}
export async function getOrder(id: string): Promise<Order> {
  const { data } = await api.get<Order>(`/fnb/orders/${id}`);
  return data;
}
export async function openOrder(body: { type: OrderType; tableId?: string; guestCount?: number; notes?: string; deliveryAddress?: string; deliveryPhone?: string }): Promise<Order> {
  const { data } = await api.post<Order>('/fnb/orders', body);
  return data;
}
export async function addOrderItem(orderId: string, body: { menuItemId: string; quantity?: number; notes?: string; modifierIds?: string[] }): Promise<Order> {
  const { data } = await api.post<Order>(`/fnb/orders/${orderId}/items`, body);
  return data;
}
export async function updateOrderItem(orderId: string, itemId: string, quantity: number): Promise<Order> {
  const { data } = await api.patch<Order>(`/fnb/orders/${orderId}/items/${itemId}`, { quantity });
  return data;
}
export async function removeOrderItem(orderId: string, itemId: string): Promise<Order> {
  const { data } = await api.delete<Order>(`/fnb/orders/${orderId}/items/${itemId}`);
  return data;
}
export async function updateOrderDelivery(orderId: string, body: { driverName?: string; deliveryAddress?: string; deliveryPhone?: string }): Promise<Order> {
  const { data } = await api.patch<Order>(`/fnb/orders/${orderId}/delivery`, body);
  return data;
}
export async function sendOrder(orderId: string): Promise<Order> {
  const { data } = await api.post<Order>(`/fnb/orders/${orderId}/send`, {});
  return data;
}
export async function settleOrder(orderId: string, body: { paymentMethod?: string; discount?: number }): Promise<Order> {
  const { data } = await api.post<Order>(`/fnb/orders/${orderId}/settle`, body);
  return data;
}
export async function cancelOrder(orderId: string): Promise<Order> {
  const { data } = await api.post<Order>(`/fnb/orders/${orderId}/cancel`, {});
  return data;
}

export type KitchenStatus = 'QUEUED' | 'PREPARING' | 'READY' | 'BUMPED' | 'RECALLED';
export type KitchenTicketItem = { id: string; name: string; quantity: number; status: OrderItemStatus };
export type KitchenTicket = {
  id: string; ticketNumber: string; status: KitchenStatus; station: string | null; createdAt: string;
  items: KitchenTicketItem[];
  order?: { orderNumber: string; type: OrderType; table?: { label: string } | null } | null;
};

export async function fetchKitchen(status: 'ACTIVE' | KitchenStatus = 'ACTIVE'): Promise<KitchenTicket[]> {
  const { data } = await api.get<KitchenTicket[]>('/fnb/kitchen', { params: { status } });
  return data;
}
export async function setKitchenStatus(id: string, status: KitchenStatus): Promise<KitchenTicket> {
  const { data } = await api.patch<KitchenTicket>(`/fnb/kitchen/${id}/status`, { status });
  return data;
}
