import Link from 'next/link';

export function Brand({ href = '/' }) {
  return (
    <Link href={href} className="brand">
      <span className="brand-mark" aria-hidden="true">
        ✚
      </span>
      DoseKeep
    </Link>
  );
}
