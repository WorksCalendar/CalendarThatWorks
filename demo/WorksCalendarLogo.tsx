export default function WorksCalendarLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon
        points="4,25 25,25 50,65 75,25 96,25 64,90 50,55 36,90"
        fill="#1b2d47"
      />
    </svg>
  );
}
