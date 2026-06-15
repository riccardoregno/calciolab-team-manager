import { createContext, useContext } from "react";

export const DEFAULT_AREA_PERMISSION = {
  area: null,
  level: "manage",
  source: "role",
  canView: true,
  canManage: true,
};

export const PermissionContext = createContext(DEFAULT_AREA_PERMISSION);

export function useAreaPermission() {
  return useContext(PermissionContext);
}

export function isManageAllowed(permission) {
  return permission?.canManage === true;
}
