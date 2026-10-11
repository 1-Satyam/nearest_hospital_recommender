import { useEffect, useRef, useState } from 'react';
import ArogyaLogo from './ArogyaLogo';
import './SplashScreen.css';

export default function SplashScreen({ onReady }) {
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const completed = useRef(false);
  const finishRef = useRef(null);

  useEffect(() => {
    let frameId;
    let startedAt = null;
    const totalDuration = 2600;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const finish = () => {
      if (completed.current) return;
      completed.current = true;
      cancelAnimationFrame(frameId);
      setProgress(100);
      setIsReady(true);
      document.dispatchEvent(new CustomEvent('arogya:ready'));
      onReady();
    };
    finishRef.current = finish;

    const tick = (time) => {
      if (startedAt === null) startedAt = time;
      const nextProgress = Math.min(100, Math.round(((time - startedAt) / totalDuration) * 100));
      setProgress(nextProgress);
      if (nextProgress >= 100) finish();
      else frameId = requestAnimationFrame(tick);
    };

    if (reducedMotion) finish();
    else frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      finishRef.current = null;
    };
  }, [onReady]);

  return (
    <main className="arogya-splash">
      <div className="arogya-splash__content">
        <div
          className="arogya-splash__mark"
          role="img"
          aria-label="Arogya map pin logo"
        >
          <ArogyaLogo className="arogya-splash__logo" />
        </div>
        <h1 className="arogya-splash__title">Arogya</h1>
        <p className="arogya-splash__what">Nearest hospital recommender</p>
        <p className="arogya-splash__lede">The right care, close to you.</p>

        <div className="arogya-splash__load">
          <div
            className="arogya-splash__track"
            role="progressbar"
            aria-label="Loading"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progress}
          >
            <div className="arogya-splash__fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="arogya-splash__status" aria-live="polite">
            {isReady ? 'Ready' : 'Checking hospitals near you'}
          </p>
        </div>

        <div className="arogya-splash__actions">
          <a className="arogya-splash__sos" href="tel:112">
            Emergency? Call 112
          </a>
          {!isReady && (
            <button
              className="arogya-splash__skip"
              type="button"
              onClick={() => finishRef.current?.()}
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
