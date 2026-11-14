/** What the student can clear. Each one is permanent. */
export type ClearScope = "practice" | "questions" | "everything";

export interface DataCounts {
  questions: number;
  sessions: number;
  exams: number;
  cards: number;
  bookmarks: number;
  notes: number;
}

export interface DataRepo {
  counts(): Promise<DataCounts>;
  /**
   * practice:   every finished and unfinished session (answers and scores).
   * questions:  every question, with its bookmarks, notes and revision cards. Sessions stay.
   * everything: all of the above plus exams, subjects, tags and collections.
   * The account and the appearance settings are kept.
   */
  clear(scope: ClearScope, onProgress?: (done: string) => void): Promise<void>;
}
