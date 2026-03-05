/**
 * React hook for permission checking
 */

import { useAuth } from '@/contexts/AuthContext';
import type { Permission } from '@/utils/permissions';
import { hasPermission } from '@/utils/permissions';

export function usePermissions() {
  const { profile } = useAuth();

  const checkPermission = (permission: Permission): boolean => {
    if (!profile) return false;
    return hasPermission(profile.role, permission);
  };

  return {
    hasPermission: checkPermission,
    role: profile?.role,
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'manager',
    isCashier: profile?.role === 'cashier',
    canViewAllTransactions: profile ? hasPermission(profile.role, 'view:all:transactions') : false,
    canEditProducts: profile ? hasPermission(profile.role, 'edit:products') : false,
    canManageUsers: profile ? hasPermission(profile.role, 'manage:users') : false,
  };
}

