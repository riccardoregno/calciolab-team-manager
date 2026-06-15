import { PermissionContext, DEFAULT_AREA_PERMISSION } from "./permissionContext";

export default function PermissionProvider({ value, children }) {
  return (
    <PermissionContext.Provider value={{ ...DEFAULT_AREA_PERMISSION, ...(value || {}) }}>
      {children}
    </PermissionContext.Provider>
  );
}
