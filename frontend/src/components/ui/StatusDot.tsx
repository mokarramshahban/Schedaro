type StatusDotProps = { label: string; state: 'success' | 'pending' | 'error' }

export function StatusDot({ label, state }: StatusDotProps) {
  return <span className={`status-chip status-chip--${state}`}><i aria-hidden="true" />{label}</span>
}
