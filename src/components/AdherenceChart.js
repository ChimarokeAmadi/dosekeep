'use client';

import { useEffect, useRef, useState } from 'react';
import { AT_RISK_THRESHOLD, formatRate } from '@/lib/adherence';

// The chart is drawn at its real pixel width (measured), so text stays 11px on any screen.
const H = 220;
const PAD = { top: 14, right: 74, bottom: 26, left: 38 };
const plotH = H - PAD.top - PAD.bottom;
const y = (rate) => PAD.top + plotH * (1 - rate);

// A bar with a 4px rounded top, flat on the baseline.
function barPath(x, top, width, bottom) {
  const r = Math.min(4, width / 2, bottom - top);
  return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${bottom}Z`;
}

function Tooltip({ d, cx, W }) {
  const counted = d.taken + d.missed;
  const left = Math.min(Math.max(cx - 75, 0), W - 150);
  return (
    <g className="tip" transform={`translate(${left}, 0)`} pointerEvents="none">
      <rect width="150" height="44" rx="6" />
      <text x="10" y="18" className="tip-title">
        {d.day}
      </text>
      <text x="10" y="35">
        {counted === 0 ? 'No doses due' : `${formatRate(d.rate)} · ${d.taken} of ${counted} taken`}
      </text>
    </g>
  );
}

const shortDay = (day) => {
  const [, m, d] = day.split('-');
  return `${Number(d)}/${Number(m)}`;
};

// Daily adherence, one bar per day. Single series, so no legend: the heading names it.
// Hover or keyboard focus shows the exact numbers; the table below has them all.
export function AdherenceChart({ daily, title }) {
  const [active, setActive] = useState(null);
  const [W, setW] = useState(640);
  const box = useRef(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  const plotW = W - PAD.left - PAD.right;
  const slot = plotW / daily.length;
  const barW = Math.max(3, Math.min(18, slot - 2)); // at least a 2px gap between bars
  const labelEvery = Math.max(1, Math.ceil(42 / slot)); // about one label per 42px
  const thresholdY = y(AT_RISK_THRESHOLD);

  return (
    <figure className="chart" ref={box}>
      <figcaption>{title}</figcaption>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Bar chart, one bar per day. Details in the table below.`}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis" x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {t * 100}%
            </text>
          </g>
        ))}
        <line className="threshold" x1={PAD.left} x2={W - PAD.right} y1={thresholdY} y2={thresholdY} />
        <text className="threshold-label" x={W - PAD.right + 6} y={thresholdY + 4}>
          80% target
        </text>

        {daily.map((d, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const x = cx - barW / 2;
          return (
            <g
              key={d.day}
              className={active === i ? 'bar active' : 'bar'}
              tabIndex={0}
              aria-label={`${d.day}: ${formatRate(d.rate)}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <rect className="hit" x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH} />
              {d.rate === null ? (
                <line className="nodata" x1={x} x2={x + barW} y1={y(0) - 1} y2={y(0) - 1} />
              ) : (
                <path className="fill" d={barPath(x, Math.min(y(d.rate), y(0) - 2), barW, y(0))} />
              )}
              {i % labelEvery === (daily.length - 1) % labelEvery && (
                <text className="axis" x={cx} y={H - 8} textAnchor="middle">
                  {shortDay(d.day)}
                </text>
              )}
            </g>
          );
        })}
        {active !== null && <Tooltip d={daily[active]} cx={PAD.left + slot * active + slot / 2} W={W} />}
      </svg>
      <details>
        <summary>Show as a table</summary>
        <table className="table compact">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Taken</th>
              <th scope="col">Missed</th>
              <th scope="col">Adherence</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.day}>
                <td>{d.day}</td>
                <td>{d.taken}</td>
                <td>{d.missed}</td>
                <td>{formatRate(d.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
