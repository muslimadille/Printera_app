import { useState, useEffect } from 'react';
import { fetchSiteSettings, SiteSettings, DEFAULT_SITE_SETTINGS } from '@/services/siteSettingsService';

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchSiteSettings();
        setSettings(data);
      } catch (e) {
        console.error('Failed fetching site settings in hook:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { settings, loading };
}
