export function OptionChip({ active, icon: Icon, label, onClick }) {
  return (
    <button className={`option-chip ${active ? 'is-active' : ''}`} onClick={onClick} type="button">
      <Icon size={15} strokeWidth={2.3} />
      <span>{label}</span>
    </button>
  );
}

export function ChoiceGroup({ title, children }) {
  return (
    <section className="choice-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
