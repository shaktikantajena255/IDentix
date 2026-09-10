const StatCard = ({ title, value, icon: Icon, color, subtitle }) => {
  // Use inline styles for the colored left border (custom CSS colors aren't Tailwind utilities)
  const colorStyles = {
    cyan:  { border: '#06b6d4', icon: 'rgba(6,182,212,0.2)',  text: '#06b6d4' },
    green: { border: '#22c55e', icon: 'rgba(34,197,94,0.2)',  text: '#22c55e' },
    amber: { border: '#f59e0b', icon: 'rgba(245,158,11,0.2)', text: '#f59e0b' },
    red:   { border: '#ef4444', icon: 'rgba(239,68,68,0.2)',  text: '#ef4444' },
  };

  const style = colorStyles[color] || colorStyles.cyan;

  return (
    <div
      className="bg-navy-800 border border-navy-600 rounded-xl p-5"
      style={{ borderLeft: `4px solid ${style.border}` }}
    >
      <div className="flex items-center gap-4">
        <div
          className="p-3 rounded-lg"
          style={{ backgroundColor: style.icon, color: style.border }}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <h3 className="text-2xl font-bold" style={{ color: style.text }}>{value}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
