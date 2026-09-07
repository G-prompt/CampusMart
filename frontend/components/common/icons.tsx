export function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function CartIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden="true" className={className}>
      <circle cx="9.5" cy="20.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20.5" r="1.4" fill="currentColor" stroke="none" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 3h2.2l1.9 11.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6l1.4-7.4H6.1" />
    </svg>
  );
}
