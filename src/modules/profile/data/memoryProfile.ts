import { cleanProfile, DEFAULT_PROFILE, type Profile } from "../domain/profile.ts";
import type { ProfileRepo } from "./repo.ts";

export class MemoryProfile implements ProfileRepo {
  constructor(private profile: Profile = DEFAULT_PROFILE) {}
  async get() {
    return this.profile;
  }
  async save(p: Profile) {
    this.profile = cleanProfile(p);
    return this.profile;
  }
}
