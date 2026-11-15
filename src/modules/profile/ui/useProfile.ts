import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PROFILE, type Profile } from "../domain/profile.ts";
import type { ProfileRepo } from "../data/repo.ts";

/** Loads the profile once and saves changes. Until it loads, the default avatar is shown. */
export function useProfile(repo: ProfileRepo) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    repo
      .get()
      .then((p) => {
        if (live) {
          setProfile(p);
          setLoaded(true);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [repo]);
  const save = useCallback(
    async (next: Profile) => {
      const saved = await repo.save(next);
      setProfile(saved);
      return saved;
    },
    [repo],
  );
  return { profile, loaded, save };
}
