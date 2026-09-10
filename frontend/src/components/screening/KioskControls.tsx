import React from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { Button } from '../common/Button';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useScreening } from '../../context/ScreeningContext';

/**
 * Kiosk control bar shown during active screening.
 * Contains fullscreen toggle and exit screening button.
 * Rendered inside the screening header — NOT inside the sidebar.
 */
export const KioskControls: React.FC = () => {
  const { isFullscreen, isSupported, enter, exit } = useFullscreen();
  const { state, requestExit } = useScreening();

  const isActive =
    state.phase === 'SCREENING_ACTIVE' || state.phase === 'SCREENING_PROCESSING';

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-2">
      {isSupported && (
        <Button
          variant="outline"
          size="sm"
          onClick={isFullscreen ? exit : enter}
          icon={
            isFullscreen
              ? <Minimize2 className="w-4 h-4" />
              : <Maximize2 className="w-4 h-4" />
          }
          title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
        >
          {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
        </Button>
      )}
      <Button
        variant="danger"
        size="sm"
        onClick={requestExit}
        icon={<X className="w-4 h-4" />}
      >
        Exit Screening
      </Button>
    </div>
  );
};
