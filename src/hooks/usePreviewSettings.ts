import { useState, useEffect } from 'react';

export interface PreviewSettings {
  show2DPreview: boolean;
  showNestingPreview: boolean;
  show3DPreview: boolean;
}

export function usePreviewSettings(templateId?: string): PreviewSettings {
  const [settings, setSettings] = useState<PreviewSettings>({
    show2DPreview: true,
    showNestingPreview: true,
    show3DPreview: true,
  });

  const loadSettings = () => {
    try {
      const storedGlobal = localStorage.getItem('printCalc_previewSettings');
      const globalParsed = storedGlobal ? JSON.parse(storedGlobal) : {};

      const storedOverrides = localStorage.getItem('printCalc_templatePreviewOverrides');
      const overridesParsed = storedOverrides ? JSON.parse(storedOverrides) : {};
      const templateOverride = templateId ? (overridesParsed[templateId] || {}) : {};

      setSettings({
        show2DPreview: templateOverride.show2D ?? globalParsed.show2DPreview ?? true,
        showNestingPreview: templateOverride.showNesting ?? globalParsed.showNestingPreview ?? true,
        show3DPreview: templateOverride.show3D ?? globalParsed.show3DPreview ?? true,
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSettings();
    window.addEventListener('storage', loadSettings);
    window.addEventListener('previewSettingsUpdated', loadSettings);
    return () => {
      window.removeEventListener('storage', loadSettings);
      window.removeEventListener('previewSettingsUpdated', loadSettings);
    };
  }, [templateId]);

  return settings;
}
