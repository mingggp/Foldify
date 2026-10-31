/**
 * Foldify wordmark: FOLDIFY in capitals, the O is a box in the three brand teals,
 * centred on the capitals (logo idea 3A-L, design/logo-proposals/round6).
 */
const CAP = 0.7; // cap height of Bai Jamjuree Bold, in em
const BOX = 0.6; // box height, in em

export function LogoCube({ className = "", style }) {
  return (
    <svg viewBox="0 0 86.6 100" className={className} style={style} aria-hidden="true">
      <polygon points="0,25 43.3,0 86.6,25 43.3,50" fill="#00d5c9" />
      <polygon points="0,25 43.3,50 43.3,100 0,75" fill="#00c8b5" />
      <polygon points="43.3,50 86.6,25 86.6,75 43.3,100" fill="#28a1ab" />
    </svg>
  );
}

export default function Logo({ size = "md" }) {
  return (
    <span
      role="img"
      aria-label="Foldify"
      className={`font-display font-bold select-none whitespace-nowrap leading-none ${size === "sm" ? "text-[17px]" : "text-[22px]"}`}
      style={{ letterSpacing: "0.05em" }}
    >
      <span aria-hidden="true">F</span>
      <LogoCube
        style={{
          display: "inline-block",
          height: `${BOX}em`,
          width: `${BOX * 0.866}em`,
          margin: "0 0.06em 0 0.02em",
          verticalAlign: `${CAP / 2 - BOX / 2}em`,
        }}
      />
      <span aria-hidden="true">LDIFY</span>
    </span>
  );
}
