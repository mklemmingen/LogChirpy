/**
 * Z-Index Layer System
 * 
 * Centralized z-index management to prevent view hierarchy conflicts.
 * Each layer has a defined range to ensure proper stacking order.
 */

export const Z_LAYERS = {
  // Base content layer - main app content
  CONTENT: 1,
  
  // UI overlays - status badges, floating buttons, etc.
  OVERLAYS: 10,
  
  // Navigation and toolbar overlays
  NAVIGATION: 50,
  
  // Camera and media overlays
  CAMERA_OVERLAYS: 100,
  
  // Modals and dialogs
  MODALS: 1000,
  
  // Toasts, snackbars, and notifications
  NOTIFICATIONS: 2000,
  
  // Critical system alerts
  ALERTS: 3000,
} as const;

/**
 * Layer ranges for components that need multiple z-index values
 */
export const LAYER_RANGES = {
  CONTENT: { min: 1, max: 9 },
  OVERLAYS: { min: 10, max: 49 },
  NAVIGATION: { min: 50, max: 99 },
  CAMERA_OVERLAYS: { min: 100, max: 999 },
  MODALS: { min: 1000, max: 1999 },
  NOTIFICATIONS: { min: 2000, max: 2999 },
  ALERTS: { min: 3000, max: 3999 },
} as const;

/**
 * Helper function to get a z-index within a layer range
 */
export const getLayerIndex = (layer: keyof typeof LAYER_RANGES, offset: number = 0): number => {
  const range = LAYER_RANGES[layer];
  const index = range.min + offset;
  
  if (index > range.max) {
    console.warn(`Z-index ${index} exceeds maximum for layer ${layer} (${range.max})`);
    return range.max;
  }
  
  return index;
};

/**
 * Predefined z-index values for common components
 */
export const COMPONENT_Z_INDEX = {
  // Content layer
  BACKGROUND: Z_LAYERS.CONTENT,
  MAIN_CONTENT: getLayerIndex('CONTENT', 1),
  
  // Overlay layer
  STATUS_BADGE: getLayerIndex('OVERLAYS', 0),
  FLOATING_BUTTON: getLayerIndex('OVERLAYS', 1),
  TOOLTIP: getLayerIndex('OVERLAYS', 2),
  
  // Navigation layer
  TAB_BAR: getLayerIndex('NAVIGATION', 0),
  HEADER: getLayerIndex('NAVIGATION', 1),
  
  // Camera overlays
  CAMERA_UI: getLayerIndex('CAMERA_OVERLAYS', 0),
  CAMERA_CONTROLS: getLayerIndex('CAMERA_OVERLAYS', 1),
  DETECTION_OVERLAY: getLayerIndex('CAMERA_OVERLAYS', 2),
  
  // Modals
  MODAL_BACKDROP: getLayerIndex('MODALS', 0),
  MODAL_CONTENT: getLayerIndex('MODALS', 1),
  MODAL_HEADER: getLayerIndex('MODALS', 2),
  
  // Notifications
  SNACKBAR: getLayerIndex('NOTIFICATIONS', 0),
  TOAST: getLayerIndex('NOTIFICATIONS', 1),
  
  // Alerts
  SYSTEM_ALERT: getLayerIndex('ALERTS', 0),
} as const;