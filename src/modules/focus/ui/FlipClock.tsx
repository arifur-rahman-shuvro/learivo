import { useEffect, useRef, useState } from "react";
import "./flip.css";

/** One digit as a flip card: the old number folds down, the new one drops into place. */
export function FlipDigit({ value }: { value: string }) {
  const [shown, setShown] = useState({ cur: value, prev: value, n: 0 });
  if (shown.cur !== value) setShown({ cur: value, prev: shown.cur, n: shown.n + 1 });
  const { cur, prev, n } = shown;
  return (
    <div className="flip-card" aria-hidden data-flips={n}>
      <div className="flip-half flip-top">
        <span>{cur}</span>
      </div>
      <div className="flip-half flip-bottom">
        <span>{prev}</span>
      </div>
      {n > 0 && (
        <>
          <div key={`t${n}`} className="flip-half flip-top flip-flap-top">
            <span>{prev}</span>
          </div>
          <div key={`b${n}`} className="flip-half flip-bottom flip-flap-bottom">
            <span>{cur}</span>
          </div>
        </>
      )}
    </div>
  );
}

/** "5:03" or "1:05:03" into groups of two digits: [["0","5"],["0","3"]] */
export function digitGroups(text: string): string[][] {
  return text.split(":").map((g) => g.padStart(2, "0").split(""));
}

/** The whole screen: pure black, only the flipping time. Tap to show Pause and Exit. */
export function FlipScreen({
  text,
  label,
  running,
  onToggle,
  onExit,
}: {
  text: string;
  label: string;
  running: boolean;
  onToggle: () => void;
  onExit: () => void;
}) {
  const groups = digitGroups(text);
  const [show, setShow] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const reveal = () => {
    setShow(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), 3500);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <section
      aria-label="Full screen timer"
      className="flip-stage"
      data-show={show}
      onPointerDown={reveal}
    >
      <div
        className="flip-clock"
        role="timer"
        aria-label={label}
        data-groups={groups.length}
        data-paused={!running}
      >
        {groups.map((g, gi) => (
          <div key={gi} className="contents">
            {gi > 0 && (
              <div className="flip-sep" aria-hidden>
                <i />
                <i />
              </div>
            )}
            <div className="flip-group">
              {g.map((d, di) => (
                <FlipDigit key={di} value={d} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flip-controls" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" onClick={onToggle}>
          {running ? "Pause" : "Resume"}
        </button>
        <button type="button" onClick={onExit}>
          Exit full screen
        </button>
      </div>
    </section>
  );
}
