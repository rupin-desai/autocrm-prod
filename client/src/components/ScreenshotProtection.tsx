import { useEffect } from 'react';

interface ScreenshotProtectionProps {
  children: React.ReactNode;
  enabled?: boolean;
}

export function ScreenshotProtection({ children, enabled = true }: ScreenshotProtectionProps) {
  useEffect(() => {
    if (!enabled) return;

    const protectionOverlay = document.createElement('div');
    protectionOverlay.className = 'screenshot-protection-watermark';
    protectionOverlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9999;
        display: flex;
        flex-wrap: wrap;
        opacity: 0.05;
      ">
        ${Array.from({ length: 50 }).map((_, i) => `
          <div style="
            flex: 1 1 20%;
            text-align: center;
            font-size: 24px;
            color: #000;
            transform: rotate(-45deg);
            padding: 20px;
          ">CONFIDENTIAL - DO NOT SHARE</div>
        `).join('')}
      </div>
    `;
    document.body.appendChild(protectionOverlay);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.body.style.filter = 'blur(20px)';
      } else {
        document.body.style.filter = 'none';
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      if (
        (e.key === 'PrintScreen') ||
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) ||
        (e.ctrlKey && e.shiftKey && e.key === 'S')
      ) {
        e.preventDefault();
        document.body.style.filter = 'blur(20px)';
        setTimeout(() => {
          document.body.style.filter = 'none';
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('keydown', handleKeyPress);
      document.body.removeChild(protectionOverlay);
      document.body.style.filter = 'none';
    };
  }, [enabled]);

  return <>{children}</>;
}
