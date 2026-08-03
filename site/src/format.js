// Spread onto a clickable div to make it keyboard-operable.
export const clickable = (fn) => ({
  role: "link",
  tabIndex: 0,
  onClick: fn,
  onKeyDown: (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  },
});

export function fmt(n) {
  if (n == null) return "—";
  if (n >= 1000) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return "$" + n.toFixed(2);
}

export function changeStr(change) {
  if (change == null) return null;
  return (change >= 0 ? "▲ " : "▼ ") + Math.abs(change).toFixed(1) + "%";
}

// Map dated [day, price] pairs to SVG points, x proportional to date.
export function datePts(pairs, w, h, pad) {
  const a = pairs.length === 1 ? [pairs[0], pairs[0]] : pairs;
  const d0 = a[0][0], d1 = a[a.length - 1][0], span = d1 - d0 || 1;
  const prices = a.map((p) => p[1]);
  const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
  return a
    .map(([d, v]) => {
      const x = ((d - d0) / span) * w;
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
}

// Map a series to SVG polyline points. A single value renders flat.
export function sparkPts(series, w, h, pad) {
  const a = series.length === 1 ? [series[0], series[0]] : series;
  const min = Math.min(...a), max = Math.max(...a), range = max - min || 1;
  return a
    .map((v, i) => {
      const x = (i / (a.length - 1)) * w;
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
}
