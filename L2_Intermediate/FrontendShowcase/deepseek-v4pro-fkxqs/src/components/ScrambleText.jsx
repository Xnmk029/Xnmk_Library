import { useEffect, useLayoutEffect, useRef } from 'react';
import { useInView } from 'framer-motion';
import { onTick } from '../lib/raf';

const GLYPHS = '01ABCDEFGHJKLMNPQRSTUVWXYZ#$%&*+-<>[]{}/\\|=_~^:;!?░▒▓█▚▞◆◇◈※∴';

/**
 * Cyberpunk character-scramble reveal.
 *
 * Characters roll through random glyphs and lock in left-to-right. The
 * still-rolling tail is rendered in the live theme colour (see `.sc-scr`)
 * so the reveal reads as a scanning decode, not a plain typewriter.
 *
 * Text is written straight into two child spans via refs — no per-frame
 * React state, and every instance shares one rAF loop.
 */
export default function ScrambleText({
  text = '',
  className = '',
  as: Tag = 'span',
  speed = 30,
  settle = 300,
  delay = 0,
  glyphs = GLYPHS,
  trigger = 0,
  whenInView = false,
  viewAmount = 0.3,
  cursor = false,
  onDone,
}) {
  const hostRef = useRef(null);
  const revRef = useRef(null);
  const scrRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const inView = useInView(hostRef, { once: true, amount: viewAmount });
  const armed = whenInView ? inView : true;

  const scrambleTail = (chars, from) => {
    let out = '';
    for (let i = from; i < chars.length; i += 1) {
      const ch = chars[i];
      out += ch === ' ' || ch === '\n' ? ch : glyphs[(Math.random() * glyphs.length) | 0];
    }
    return out;
  };

  // Paint a fully scrambled frame before the browser's first paint so the
  // element already occupies its final box (zero layout shift).
  useLayoutEffect(() => {
    const chars = Array.from(text);
    if (revRef.current) revRef.current.textContent = '';
    if (scrRef.current) scrRef.current.textContent = scrambleTail(chars, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    if (!armed) return undefined;
    const rev = revRef.current;
    const scr = scrRef.current;
    if (!rev || !scr) return undefined;

    const chars = Array.from(text);
    if (chars.length === 0) {
      rev.textContent = '';
      scr.textContent = '';
      return undefined;
    }

    let elapsed = 0;
    let frame = 0;
    let finished = false;

    const stop = onTick((_time, dt) => {
      if (finished) return;
      elapsed += dt * 1000;

      const p = elapsed - delay - settle;
      const locked = p < 0 ? 0 : Math.min(chars.length, Math.floor(p / speed) + 1);

      if (locked >= chars.length) {
        rev.textContent = text;
        scr.textContent = '';
        finished = true;
        stop();
        if (doneRef.current) doneRef.current();
        return;
      }

      rev.textContent = chars.slice(0, locked).join('');
      // Re-roll the tail every other frame → chunkier, more mechanical feel.
      frame += 1;
      if (frame % 2 === 0) scr.textContent = scrambleTail(chars, locked);
    });

    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, trigger, armed, speed, settle, delay]);

  return (
    <Tag ref={hostRef} className={`scramble ${className}`.trim()} aria-label={text} data-scramble="">
      <span className="sc-rev" ref={revRef} />
      <span className="sc-scr" ref={scrRef} />
      {cursor ? <i className="term-cursor" aria-hidden="true" /> : null}
    </Tag>
  );
}
