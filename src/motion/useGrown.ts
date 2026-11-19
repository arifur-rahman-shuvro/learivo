import { useEffect, useState } from "react";

/**
 * False for the first painted frame, then true. Charts start at zero and grow to their value, so
 * the change is animated by an ordinary CSS transition. With reduced motion the transition rules
 * in motion.css make it instant.
 */
export function useGrown(): boolean {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return grown;
}
