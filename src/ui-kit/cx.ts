/** Joins class names, skipping the ones that are false or missing. */
export const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");
