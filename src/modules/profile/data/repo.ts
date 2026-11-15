import type { Profile } from "../domain/profile.ts";

export interface ProfileRepo {
  get(): Promise<Profile>;
  save(profile: Profile): Promise<Profile>;
}
