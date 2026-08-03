export function fmt(n) {
  if (n == null) return "—";
  if (n >= 1000) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return "$" + n.toFixed(2);
}

export function changeStr(change) {
  if (change == null) return null;
  return (change >= 0 ? "▲ " : "▼ ") + Math.abs(change).toFixed(1) + "%";
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
