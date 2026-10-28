/** Cycles through words in place, each sliding up into view; sits inline at the end of a line. Decorative: give the sentence to screen readers separately. */
export function RotatingWord({ words }: { words: string[] }) {
  const all = [...words, words[0]]; // the repeat lets the loop restart seamlessly
  return (
    <span aria-hidden="true" className="inline-block h-[1.2em] overflow-hidden align-top">
      <span data-motion className="block" style={{ animation: `word-cycle ${words.length * 2.6}s cubic-bezier(0.7, 0, 0.2, 1) infinite` }}>
        {all.map((w, i) => (
          <span key={i} className="block h-[1.2em] leading-[1.2em]">
            {w}
          </span>
        ))}
      </span>
    </span>
  );
}
