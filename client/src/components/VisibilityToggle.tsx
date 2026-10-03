import type { Visibility } from '../api/types';
import { SegmentedControl } from './ui';

export function VisibilityToggle({ value, onChange, disabled }: { value: Visibility; onChange: (v: Visibility) => void; disabled?: boolean }) {
  if (disabled) {
    return <span className="text-sm text-neutral-600">{value === 'shared' ? 'Ortak' : 'Özel 🔒'}</span>;
  }
  return (
    <SegmentedControl<Visibility>
      value={value}
      onChange={onChange}
      options={[
        { value: 'shared', label: 'Ortak' },
        { value: 'private', label: 'Özel 🔒' },
      ]}
    />
  );
}
