import { StorageService } from './storage';

export interface CloudBackupStatus {
  lastBackupTime?: string;
  isBackingUp: boolean;
  success: boolean;
  itemCount: number;
  error?: string;
}

let backupDebounceTimer: any = null;
let isCurrentlyBackingUp = false;

export const CloudBackupService = {
  getStatus(): CloudBackupStatus {
    try {
      const time = localStorage.getItem('depos_last_cloud_backup_time') || undefined;
      const count = parseInt(localStorage.getItem('depos_last_cloud_backup_count') || '0', 10);
      return {
        lastBackupTime: time,
        isBackingUp: isCurrentlyBackingUp,
        success: Boolean(time),
        itemCount: count,
      };
    } catch {
      return { isBackingUp: false, success: false, itemCount: 0 };
    }
  },

  /**
   * Invisible background trigger called whenever Entrada, Salida, or Reposition changes.
   * Debounced so rapid inputs are seamlessly bundled into one cloud snapshot.
   */
  triggerAutoBackup(delayMs: number = 1500): void {
    if (backupDebounceTimer) {
      clearTimeout(backupDebounceTimer);
    }

    backupDebounceTimer = setTimeout(() => {
      this.executeBackup().catch((err) => {
        console.warn('Background auto cloud backup error (silent):', err);
      });
    }, delayMs);
  },

  async executeBackup(): Promise<{ success: boolean; timestamp: string; sizeKB: number }> {
    if (isCurrentlyBackingUp) {
      return { success: false, timestamp: '', sizeKB: 0 };
    }

    isCurrentlyBackingUp = true;
    const nowIso = new Date().toISOString();

    try {
      // 1. Export comprehensive local snapshot
      const backupJson = StorageService.exportBackup();
      const parsed = JSON.parse(backupJson);

      // Include expiration agenda
      try {
        const rawExp = localStorage.getItem('depos_expiration_agenda');
        if (rawExp) {
          parsed.expirations = JSON.parse(rawExp);
        }
      } catch {}

      const settings = StorageService.getSettings();
      const payload = {
        storeName: settings.storeName || 'depos',
        timestamp: nowIso,
        data: parsed,
        githubConfig: settings.githubBackupConfig,
      };

      const payloadStr = JSON.stringify(payload);
      const sizeKB = Math.round(payloadStr.length / 1024);

      // 2. Post to cloud endpoint
      const response = await fetch('/api/cloud-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payloadStr,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // 3. Optional direct GitHub API commit if token and repo are configured in settings
      const gh = settings.githubBackupConfig;
      if (gh && gh.enabled && gh.token && gh.repo) {
        await this.syncToGitHubDirect(gh, payloadStr);
      }

      // 4. Record success in local storage
      localStorage.setItem('depos_last_cloud_backup_time', nowIso);
      localStorage.setItem('depos_last_cloud_backup_count', String(parsed.products?.length || 0));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cloud_backup_completed', {
          detail: { timestamp: nowIso, sizeKB }
        }));
      }

      isCurrentlyBackingUp = false;
      return { success: true, timestamp: nowIso, sizeKB };
    } catch (err: any) {
      isCurrentlyBackingUp = false;
      console.warn('Invisible cloud backup error:', err?.message || err);
      return { success: false, timestamp: nowIso, sizeKB: 0 };
    }
  },

  /**
   * Commits backup JSON directly to GitHub repository via GitHub REST API
   */
  async syncToGitHubDirect(
    config: { token?: string; repo?: string; branch?: string; path?: string },
    contentStr: string
  ): Promise<boolean> {
    if (!config.token || !config.repo) return false;
    try {
      const branch = config.branch || 'main';
      const filePath = config.path || 'backup/depos_db.json';
      const cleanRepo = config.repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');

      // Check if file exists to obtain current SHA
      let currentSha: string | undefined = undefined;
      const getUrl = `https://api.github.com/repos/${cleanRepo}/contents/${filePath}?ref=${branch}`;
      const getRes = await fetch(getUrl, {
        headers: {
          Authorization: `token ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (getRes.ok) {
        const fileInfo = await getRes.json();
        currentSha = fileInfo.sha;
      }

      // Convert content to Base64 (UTF-8 safe)
      const base64Content = btoa(unescape(encodeURIComponent(contentStr)));

      const putUrl = `https://api.github.com/repos/${cleanRepo}/contents/${filePath}`;
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          Authorization: `token ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Respaldo Automático Escudo Antivuelco: ${new Date().toLocaleString('es-ES')}`,
          content: base64Content,
          branch,
          sha: currentSha,
        }),
      });

      return putRes.ok;
    } catch (e) {
      console.warn('Direct GitHub API sync error:', e);
      return false;
    }
  },

  /**
   * Disaster recovery restore: pulls latest snapshot from cloud server
   */
  async restoreFromCloud(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/cloud-backup/latest');
      if (!res.ok) {
        throw new Error('No se encontró una copia previa en el servidor.');
      }

      const body = await res.json();
      if (!body || !body.data) {
        throw new Error('El respaldo de la nube está vacío.');
      }

      const dataStr = JSON.stringify(body.data);
      const imported = StorageService.importBackup(dataStr);

      if (imported) {
        if (body.data.expirations && Array.isArray(body.data.expirations)) {
          localStorage.setItem('depos_expiration_agenda', JSON.stringify(body.data.expirations));
        }
        return { success: true, message: '¡Datos restaurados con éxito desde la nube!' };
      }
      return { success: false, message: 'El formato de los datos no es válido.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Error al conectar con la nube.' };
    }
  },
};
