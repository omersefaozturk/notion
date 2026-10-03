import type { OwnerSummary } from '../api/types';
import { cx } from '../lib/util';

interface Props {
  owner: Pick<OwnerSummary, 'initial' | 'color' | 'name'>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  xs: 'h-3.5 w-3.5 text-[8px]',
  sm: 'h-4 w-4 text-[9px]',
  md: 'h-6 w-6 text-xs',
  lg: 'h-10 w-10 text-base',
};

/** Small circle with the owner's initial in the owner's colour. */
export function OwnerBadge({ owner, size = 'sm', className }: Props) {
  return (
    <span
      title={owner.name}
      aria-label={owner.name}
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none text-white',
        SIZES[size],
        className,
      )}
      style={{ background: owner.color }}
    >
      {owner.initial}
    </span>
  );
}
