/**
 * Service to request and manage Local Network / Location permissions
 * required by Android to discover peers and transfer data over Wi-Fi Hotspot without internet.
 */

const PERMISSION_CHECKED_KEY = 'depos_local_network_perm_requested';

export const NetworkPermissionService = {
  /**
   * Prompts the user for location / nearby Wi-Fi access on app startup.
   * In Android WebView (Capacitor), requesting geolocation triggers Android's
   * native system dialog asking for ACCESS_FINE_LOCATION and nearby device network access.
   */
  async requestOnStartup(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;

      // Check if navigator.geolocation exists
      if ('geolocation' in navigator) {
        return new Promise<boolean>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              try {
                localStorage.setItem(PERMISSION_CHECKED_KEY, 'granted');
              } catch {}
              console.log('[NetworkPermission] Permiso de red local concedido:', pos.coords.latitude);
              resolve(true);
            },
            (err) => {
              try {
                localStorage.setItem(PERMISSION_CHECKED_KEY, 'prompt_shown');
              } catch {}
              console.warn('[NetworkPermission] Estado de permiso de red local:', err.message);
              resolve(false);
            },
            {
              enableHighAccuracy: false,
              timeout: 6000,
              maximumAge: 600000,
            }
          );
        });
      }
      return false;
    } catch (e) {
      console.warn('[NetworkPermission] Excepción al solicitar permisos:', e);
      return false;
    }
  },

  /**
   * Explicitly request or re-request local network permissions with user feedback
   */
  async requestPermissionsExplicitly(): Promise<{ granted: boolean; message: string }> {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return { granted: false, message: 'La API de permisos no está disponible en este entorno.' };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          try {
            localStorage.setItem(PERMISSION_CHECKED_KEY, 'granted');
          } catch {}
          resolve({
            granted: true,
            message: '¡Permiso de Red Local y Zona Wi-Fi activado con éxito!',
          });
        },
        (error) => {
          let msg = 'No se concedió el permiso de red local.';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'Permiso denegado. Puedes activarlo en Ajustes de Android > Aplicaciones > Depos > Permisos > Ubicación/Dispositivos cercanos.';
          } else if (error.code === error.TIMEOUT) {
            msg = 'Tiempo de espera agotado al consultar permisos.';
          }
          resolve({ granted: false, message: msg });
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    });
  },

  isGranted(): boolean {
    try {
      return localStorage.getItem(PERMISSION_CHECKED_KEY) === 'granted';
    } catch {
      return false;
    }
  },
};
