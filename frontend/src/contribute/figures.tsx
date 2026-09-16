// Inline SVG figures for the Contribute page. Each carries information the
// surrounding prose would otherwise have to spell out, so the page reads
// shorter rather than longer. Colors come from the hot-ui palette so the
// figures follow the rest of the site rather than hardcoding a second one.
//
// Each figure sits in a scroller with a min-width, so label text keeps its
// size on a phone instead of shrinking to nothing.

export function CommonsFigure() {
  const provider = (y: number, name: string) => (
    <g key={name}>
      <rect x="4" y={y} width="172" height="52" rx="3" fill="var(--fig-surface)" stroke="var(--fig-line)" />
      <text x="16" y={y + 22} className="fig-label">
        {name}
      </text>
      <text x="16" y={y + 39} className="fig-sub">
        own storage, own license
      </text>
    </g>
  );

  return (
    <svg viewBox="0 0 860 288" role="img" aria-labelledby="fig1title fig1desc">
      <title id="fig1title">Imagery stays with the provider; OpenAerialMap holds only the metadata</title>
      <desc id="fig1desc">
        Three providers keep imagery in their own storage. Metadata flows to the OpenAerialMap
        catalog, which is searched by mappers, responders, researchers and public agencies. The imagery
        itself is served directly from provider storage, bypassing OpenAerialMap.
      </desc>

      {provider(16, "Provider A")}
      {provider(96, "Provider B")}
      {provider(176, "Provider C")}

      {/* metadata into the catalog */}
      {[42, 122, 202].map((y) => (
        <path
          key={`m${y}`}
          d={`M 180 ${y} C 246 ${y}, 262 131, 326 131`}
          fill="none"
          stroke="var(--fig-accent)"
          strokeWidth="1.5"
          markerEnd="url(#fig-arrow)"
        />
      ))}
      <text x="212" y="118" className="fig-tag">
        metadata
      </text>

      <rect x="330" y="98" width="214" height="66" rx="3" fill="var(--fig-accent-soft)" stroke="var(--fig-accent)" />
      <text x="344" y="126" className="fig-label">
        OpenAerialMap catalog
      </text>
      <text x="344" y="147" className="fig-sub">
        metadata only
      </text>

      {/* catalog out to the people who search it */}
      {[
        [40, "Community mapping"],
        [92, "Disaster response"],
        [144, "Research"],
        [196, "Government"],
      ].map(([y, label]) => (
        <g key={label as string}>
          <path
            d={`M 548 131 C 606 131, 624 ${y as number} , 686 ${y as number}`}
            fill="none"
            stroke="var(--fig-accent)"
            strokeWidth="1.5"
            markerEnd="url(#fig-arrow)"
          />
          <text x="698" y={(y as number) + 4} className="fig-label">
            {label}
          </text>
        </g>
      ))}

      {/* imagery served straight from provider storage, around the catalog */}
      {/* Leaves from below the provider stack, not through it, and runs under
          the catalog box to make the bypass unmistakable. */}
      {/* One unbroken run, ending level with the consumer column. Knocking a
          label out of the middle of it made it read as two separate arrows. */}
      <path
        d="M 180 238 C 340 258, 520 258, 686 236"
        fill="none"
        stroke="var(--fig-muted)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        markerEnd="url(#fig-arrow-muted)"
      />
      <text x="360" y="276" className="fig-tag">
        imagery served from provider storage
      </text>

      <defs>
        <marker id="fig-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--fig-accent)" />
        </marker>
        <marker id="fig-arrow-muted" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--fig-muted)" />
        </marker>
      </defs>
    </svg>
  );
}

export function RoutesFigure() {
  const diamond = (cx: number, cy: number, label: string[]) => (
    <g>
      <path
        d={`M ${cx} ${cy - 34} L ${cx + 74} ${cy} L ${cx} ${cy + 34} L ${cx - 74} ${cy} Z`}
        fill="var(--fig-surface)"
        stroke="var(--fig-line)"
      />
      {label.map((line, i) => (
        <text key={line} x={cx} y={cy - 4 + i * 14} className="fig-sub" textAnchor="middle">
          {line}
        </text>
      ))}
    </g>
  );

  const endpoint = (y: number, name: string, effort: string, dashed = false) => (
    <g>
      <rect
        x="560"
        y={y}
        width="288"
        height="44"
        rx="3"
        fill={dashed ? "none" : "var(--fig-accent-soft)"}
        stroke={dashed ? "var(--fig-muted)" : "var(--fig-accent)"}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      <text x="574" y={y + 19} className="fig-label">
        {name}
      </text>
      <text x="574" y={y + 35} className="fig-sub">
        {effort}
      </text>
    </g>
  );

  return (
    <svg viewBox="0 0 860 330" role="img" aria-labelledby="fig2title fig2desc">
      <title id="fig2title">Which contribution route applies</title>
      <desc id="fig2desc">
        A decision path. Imagery not in public cloud storage as COGs goes to the OAM uploader. With
        no catalog, OAM generates one from an agreed metadata set, which is in development. With a
        catalog that follows the STAC spec, the URL is enough. With a catalog using its own
        conventions, OAM maps the metadata fields.
      </desc>

      {diamond(96, 60, ["Public storage,", "as COGs?"])}
      {diamond(96, 190, ["Has a STAC", "catalog?"])}
      {diamond(310, 190, ["Follows the", "spec as-is?"])}

      {/* no -> uploader */}
      <path d="M 96 94 L 96 156" fill="none" stroke="var(--fig-line)" strokeWidth="1.5" />
      <text x="104" y="126" className="fig-tag">
        yes
      </text>
      <path d="M 170 60 L 560 60" fill="none" stroke="var(--fig-line)" strokeWidth="1.5" markerEnd="url(#fig-arrow2)" />
      <text x="180" y="52" className="fig-tag">
        no
      </text>
      {endpoint(38, "OAM uploader", "Nothing to set up")}

      <path d="M 170 190 L 236 190" fill="none" stroke="var(--fig-line)" strokeWidth="1.5" markerEnd="url(#fig-arrow2)" />
      <text x="180" y="182" className="fig-tag">
        yes
      </text>

      <path d="M 96 224 L 96 300 L 560 300" fill="none" stroke="var(--fig-line)" strokeWidth="1.5" markerEnd="url(#fig-arrow2)" />
      <text x="104" y="256" className="fig-tag">
        no
      </text>
      {endpoint(278, "OAM generates the catalog", "Agree a metadata set, in development", true)}

      <path d="M 384 190 L 560 190" fill="none" stroke="var(--fig-line)" strokeWidth="1.5" markerEnd="url(#fig-arrow2)" />
      <text x="394" y="182" className="fig-tag">
        yes
      </text>
      {endpoint(168, "Send the catalog URL", "No work on your side")}

      <path d="M 310 224 L 310 244 L 560 244" fill="none" stroke="var(--fig-line)" strokeWidth="1.5" markerEnd="url(#fig-arrow2)" />
      <text x="318" y="240" className="fig-tag">
        no
      </text>
      {endpoint(222, "OAM maps the metadata", "One exchange to agree it")}

      <defs>
        <marker id="fig-arrow2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--fig-line)" />
        </marker>
      </defs>
    </svg>
  );
}

const MAPPING_ROWS: [string, string][] = [
  ["acquired_on", "properties.datetime"],
  ["sensor_name", "properties.instruments"],
  ["resolution_metres", "properties.gsd"],
  ["owner", "properties.oam:producer_name"],
];

export function MappingFigure() {
  return (
    <svg viewBox="0 0 860 210" role="img" aria-labelledby="fig3title fig3desc">
      <title id="fig3title">What a field mapping looks like</title>
      <desc id="fig3desc">
        Four example field renames from a provider catalog to the OpenAerialMap STAC extension:
        acquired_on to properties.datetime, sensor_name to properties.instruments,
        resolution_metres to properties.gsd, and owner to properties.oam:producer_name.
      </desc>

      <text x="4" y="22" className="fig-tag">
        YOUR FIELD
      </text>
      <text x="470" y="22" className="fig-tag">
        OAM STAC FIELD
      </text>
      <line x1="4" y1="32" x2="856" y2="32" stroke="var(--fig-line)" />

      {MAPPING_ROWS.map(([from, to], i) => {
        const y = 62 + i * 36;
        return (
          <g key={from}>
            <text x="4" y={y} className="fig-mono">
              {from}
            </text>
            <path
              d={`M 300 ${y - 5} L 450 ${y - 5}`}
              stroke="var(--fig-accent)"
              strokeWidth="1.5"
              markerEnd="url(#fig-arrow3)"
            />
            <text x="470" y={y} className="fig-mono">
              {to}
            </text>
            <line x1="4" y1={y + 14} x2="856" y2={y + 14} stroke="var(--fig-line)" opacity="0.5" />
          </g>
        );
      })}

      <defs>
        <marker id="fig-arrow3" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--fig-accent)" />
        </marker>
      </defs>
    </svg>
  );
}
