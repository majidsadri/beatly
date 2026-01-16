import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

export const TransitionIndicator: React.FC = () => {
  const { isTransitioning, transitionPlan } = useStore();
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (isTransitioning && transitionPlan) {
      setStartTime(Date.now());
    } else {
      setStartTime(null);
      setCurrentPhase(null);
      setProgress(0);
    }
  }, [isTransitioning, transitionPlan]);

  useEffect(() => {
    if (!isTransitioning || !transitionPlan || !startTime) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const totalProgress = Math.min(1, elapsed / transitionPlan.duration);
      setProgress(totalProgress);

      // Find current phase
      for (const phase of transitionPlan.phases) {
        if (elapsed >= phase.startOffset && elapsed < phase.startOffset + phase.duration) {
          setCurrentPhase(phase.name);
          break;
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isTransitioning, transitionPlan, startTime]);

  if (!isTransitioning || !transitionPlan) {
    return null;
  }

  return (
    <div className="bg-dj-dark rounded-xl p-4 mb-8 border-2 border-dj-pink/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 bg-dj-pink rounded-full animate-pulse" />
          <span className="font-semibold text-dj-pink">
            Mix in Progress
          </span>
        </div>
        <span className="text-sm text-gray-400">
          {currentPhase || 'Starting...'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
        {/* Phase markers */}
        {transitionPlan.phases.map((phase, index) => {
          const startPercent = (phase.startOffset / transitionPlan.duration) * 100;
          return (
            <div
              key={index}
              className="absolute top-0 bottom-0 w-px bg-gray-600"
              style={{ left: `${startPercent}%` }}
            />
          );
        })}

        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-dj-purple via-dj-blue to-dj-pink transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />

        {/* Progress indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-dj-pink"
          style={{ left: `calc(${progress * 100}% - 8px)` }}
        />
      </div>

      {/* Phase labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        {transitionPlan.phases.map((phase, index) => (
          <span
            key={index}
            className={`${
              currentPhase === phase.name ? 'text-dj-pink' : ''
            }`}
          >
            {phase.name.split(':')[0]}
          </span>
        ))}
      </div>

      {/* Style indicator */}
      <div className="mt-3 text-center">
        <span
          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
            transitionPlan.style === 'smooth'
              ? 'bg-dj-purple/20 text-dj-purple'
              : 'bg-dj-pink/20 text-dj-pink'
          }`}
        >
          {transitionPlan.style === 'smooth' ? '🎵 Smooth Transition' : '🔥 Hype Drop'}
        </span>
      </div>
    </div>
  );
};
