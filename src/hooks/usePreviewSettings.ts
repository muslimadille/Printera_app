import { useState, useEffect } from 'react';

export function usePreviewSettings() {
  const [settings, setSettings] = useState({
    showNestingPreview: true,
    show3DPreview: true,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('printCalc_previewSettings');
      if (stored) {
        setSettings({
          showNestingPreview: true,
          show3DPreview: true,
          ...JSON.parse(stored)
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  return settings;
}
