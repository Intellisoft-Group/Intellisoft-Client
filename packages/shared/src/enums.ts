export const ROLES = [
  'SUPER_ADMIN',
  'FINANCE',
  'SUPPORT',
  'SALES',
  'CLIENT',
] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: Role[] = [
  'SUPER_ADMIN',
  'FINANCE',
  'SUPPORT',
  'SALES',
];

export const INVOICE_TYPES = ['TAX', 'PROFORMA', 'CREDIT_NOTE'] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_STATUSES = [
  'DRAFT',
  'SENT',
  'PARTIAL',
  'PAID',
  'OVERDUE',
  'VOID',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_GATEWAYS = [
  'BANK',
  'CASH',
  'CHEQUE',
] as const;
export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const BILLING_CYCLES = [
  'ONE_TIME',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const SUBSCRIPTION_STATUSES = [
  'ACTIVE',
  'PENDING',
  'SUSPENDED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const PROJECT_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const DOCUMENT_TYPES = [
  'LOGO',
  'BRIEF',
  'ASSET',
  'CONTRACT',
  'QUOTE',
  'REPORT',
  'TAX',
  'OTHER',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const SERVICE_REQUEST_STATUSES = [
  'NEW',
  'REVIEWING',
  'QUOTED',
  'ACCEPTED',
  'DECLINED',
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'INVOICE_DUE',
  'PAYMENT_SUCCESS',
  'TICKET_REPLY',
  'ANNOUNCEMENT',
  'PROJECT_UPDATE',
  'SERVICE_REQUEST',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isStaffRole(role: Role): boolean {
  return role !== 'CLIENT';
}

export function canAccessFinance(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'FINANCE';
}

export function canAccessSupport(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'SUPPORT';
}

export function canAccessSales(role: Role): boolean {
  return role === 'SUPER_ADMIN' || role === 'SALES' || role === 'FINANCE';
}
