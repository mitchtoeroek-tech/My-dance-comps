export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="64" height="64" rx="18" fill="#7BC4A8" />
      <circle cx="32" cy="16" r="6" fill="#F4FBF8" />
      <path
        d="M32 23c6 8 14 18 14 28 0 6-5 9-10 9s-8-3-8-7c0-5 6-8 10-10"
        fill="none"
        stroke="#F4FBF8"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M28 30c-8 4-14 8-16 14"
        fill="none"
        stroke="#F2C4CE"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="48" cy="14" r="3" fill="#F2C4CE" />
    </svg>
  );
}
