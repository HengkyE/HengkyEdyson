/**
 * Permission system for role-based access control
 */

import type { UserRole } from '@/edysonpos/types/database';

export type Permission =
  | 'view:all:transactions'
  | 'view:own:transactions'
  | 'create:sales'
  | 'edit:products'
  | 'view:products'
  | 'manage:inventory'
  | 'view:reports'
  | 'manage:users'
  | 'manage:settings';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view:all:transactions',
    'create:sales',
    'edit:products',
    'view:products',
    'manage:inventory',
    'view:reports',
    'manage:users',
    'manage:settings',
  ],
  manager: [
    'view:all:transactions',
    'create:sales',
    'edit:products',
    'view:products',
    'manage:inventory',
    'view:reports',
  ],
  cashier: [
    'view:own:transactions',
    'create:sales',
    'view:products',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role can view all transactions (admin/manager)
 */
export function canViewAllTransactions(role: UserRole): boolean {
  return hasPermission(role, 'view:all:transactions');
}

/**
 * Check if a role can edit products
 */
export function canEditProducts(role: UserRole): boolean {
  return hasPermission(role, 'edit:products');
}

/**
 * Check if a role can manage users (admin only)
 */
export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, 'manage:users');
}

