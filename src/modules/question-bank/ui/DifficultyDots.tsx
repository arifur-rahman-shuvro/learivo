/** Five small dots, filled up to the question's level. */
export function DifficultyDots({ level }: { level: number }) {
  return (
    <span
      role="img"
      aria-label={`Level ${level} of 5`}
      className="inline-flex items-center gap-0.5"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`size-1.5 rounded-full ${i <= level ? "bg-accent" : "bg-line-strong"}`}
        />
      ))}
    </span>
  );
}
