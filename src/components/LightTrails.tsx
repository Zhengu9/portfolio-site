type LightTrailsVariant = "hero" | "contact";

const trailCount = 36;

function getTrailPath(index: number, position: number) {
  const offset = index * 5 * position;
  const rise = index * 6;
  return `M ${-380 + offset} ${-189 - rise} C ${-380 + offset} ${-189 - rise} ${-312 + offset} ${216 - rise} ${152 - offset} ${343 - rise} C ${616 - offset} ${470 - rise} ${684 - offset} ${875 - rise} ${684 - offset} ${875 - rise}`;
}

export function LightTrails({ variant }: { variant: LightTrailsVariant }) {
  return (
    <div
      className={`light-trails light-trails-${variant}`}
      aria-hidden="true"
    >
      {[1, -1].map((position, groupIndex) => (
        <svg
          key={position}
          viewBox="0 0 696 316"
          fill="none"
          focusable="false"
        >
          {Array.from({ length: trailCount }, (_, index) => (
            <path
              key={index}
              d={getTrailPath(index, position)}
              pathLength="1"
              stroke="currentColor"
              strokeWidth={0.5 + index * 0.03}
              opacity={Math.min(1, 0.1 + index * 0.03)}
              style={{
                animationDuration: `${20 + ((index * 7 + groupIndex * 3) % 11)}s`,
                animationDelay: `${-(index * 0.67 + groupIndex * 4)}s`,
              }}
            />
          ))}
        </svg>
      ))}
    </div>
  );
}
