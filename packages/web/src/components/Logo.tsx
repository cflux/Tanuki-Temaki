export const Logo = ({ className = "h-28" }: { className?: string }) => {
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: '1 / 1' }}>
      {/* Logo SVG */}
      <svg
        className="w-full h-full relative"
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        style={{ zIndex: 1 }}
      >
        <defs>
          <filter id="invert-mask">
            {/* Increase contrast to remove gray background */}
            <feComponentTransfer>
              <feFuncR type="linear" slope="5" intercept="-2" />
              <feFuncG type="linear" slope="5" intercept="-2" />
              <feFuncB type="linear" slope="5" intercept="-2" />
            </feComponentTransfer>
            {/* Invert colors */}
            <feColorMatrix
              type="matrix"
              values="-1 0 0 0 1
                      0 -1 0 0 1
                      0 0 -1 0 1
                      0 0 0 1 0"
            />
          </filter>
          <mask id="tanuki-mask">
            <image href="/tanuki-mask.svg" width="400" height="400" filter="url(#invert-mask)" />
          </mask>
        </defs>
        <rect
          width="400"
          height="400"
          fill="currentColor"
          mask="url(#tanuki-mask)"
        />
      </svg>

      {/* Scanline overlay - more visible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 10,
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.3) 0px, rgba(0, 0, 0, 0.3) 2px, transparent 2px, transparent 4px)',
        }}
      />
    </div>
  );
};
