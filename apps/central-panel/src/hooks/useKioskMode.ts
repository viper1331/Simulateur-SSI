import { useEffect, useState } from 'react';

type KioskOptions = {
  autoFullscreen?: boolean;
};

const enterFullscreen = async () => {
  const element = document.documentElement;
  if (element.requestFullscreen) {
    try {
      await element.requestFullscreen();
    } catch (error) {
      console.warn('Fullscreen request rejected', error);
    }
  }
};

export const useKioskMode = ({ autoFullscreen = true }: KioskOptions = {}) => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kioskParam = params.get('kiosk');
    const shouldEnable = kioskParam === '1' || kioskParam === 'true';
    if (shouldEnable) {
      setEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove('kiosk-mode');
      return;
    }
    document.body.classList.add('kiosk-mode');
    if (autoFullscreen) {
      enterFullscreen();
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEnabled(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('kiosk-mode');
    };
  }, [enabled, autoFullscreen]);

  return { kioskEnabled: enabled, disableKiosk: () => setEnabled(false), enableKiosk: () => setEnabled(true) };
};
