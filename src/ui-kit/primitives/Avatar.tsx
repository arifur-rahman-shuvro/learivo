/** Round avatar: a person glyph by default, or initials once the student has a name. */
export function Avatar({
  initials,
  color,
  size = 36,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
    >
      {initials !== "" ? (
        initials
      ) : (
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.5 20c.9-3.6 3.7-5.4 7.5-5.4s6.6 1.8 7.5 5.4" />
        </svg>
      )}
    </span>
  );
}
