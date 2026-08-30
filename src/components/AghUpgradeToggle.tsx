export function AghUpgradeToggle({
  iconUrl,
  label,
  active,
  onToggle,
}: {
  iconUrl: string;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="agh-toggle"
      data-active={active || undefined}
      onClick={onToggle}
      title={`${label}: ${active ? 'owned' : 'not owned'} — click to toggle`}
    >
      <img src={iconUrl} alt={label} draggable={false} />
    </button>
  );
}
