import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

type Segment = {
  id: string;
  label: string;
  color: string;
  icon?: string;
};

interface SpinWheelProps {
  segments: Segment[];
  onSpin: () => Promise<number>;
  disabled?: boolean;
  ariaLabel?: string;
}

const SPIN_DURATION = 6500;

export function SpinWheel({ segments, onSpin, disabled, ariaLabel }: SpinWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [pendingResultIndex, setPendingResultIndex] = useState<number | null>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  const segmentAngle = useMemo(() => 360 / segments.length, [segments.length]);

  useEffect(() => {
    if (pendingResultIndex == null || !isSpinning) {
      return;
    }
    const finalRotation = 360 * 8 + (360 - pendingResultIndex * segmentAngle - segmentAngle / 2);
    const frame = requestAnimationFrame(() => {
      setRotation(finalRotation);
    });
    const timeout = window.setTimeout(() => {
      setIsSpinning(false);
      setPendingResultIndex(null);
    }, SPIN_DURATION);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [pendingResultIndex, isSpinning, segmentAngle]);

  const handleSpin = async () => {
    if (isSpinning || disabled) return;
    setIsSpinning(true);
    const resultIndex = await onSpin();
    setPendingResultIndex(resultIndex);
    if (announcerRef.current) {
      announcerRef.current.textContent = 'Spinning...';
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="relative">
        <div
          className={clsx(
            'w-72 h-72 md:w-96 md:h-96 rounded-full border-8 border-festiveGold shadow-xl transition-transform duration-[6500ms] ease-out'
          )}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {segments.map((segment, index) => {
            const rotate = index * segmentAngle;
            return (
              <div
                key={segment.id}
                className="absolute w-full h-full"
                style={{ transform: `rotate(${rotate}deg)` }}
              >
                <div
                  className="w-1/2 h-1/2 origin-bottom-right absolute right-1/2 top-1/2 flex items-center justify-end pr-4"
                  style={{ backgroundColor: segment.color, clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%)' }}
                >
                  <span className="text-sm md:text-lg font-semibold text-white drop-shadow-md text-right">
                    {segment.icon ? `${segment.icon} ` : ''}
                    {segment.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full w-24 h-24 flex items-center justify-center border-4 border-festiveGold">
          <span className="text-xl font-bold text-festiveDark">SPIN</span>
        </div>
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl">🔻</div>
      </div>
      <button
        onClick={handleSpin}
        disabled={disabled || isSpinning}
        className="px-10 py-3 bg-festiveRed text-white rounded-full font-semibold shadow-lg hover:bg-festiveGold transition-colors"
        aria-label={ariaLabel}
      >
        {isSpinning ? 'Spinning…' : 'SPIN NOW!'}
      </button>
      <div ref={announcerRef} aria-live="polite" className="sr-only" />
    </div>
  );
}

export default SpinWheel;
