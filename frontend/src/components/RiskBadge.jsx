import { ShieldCheck, AlertTriangle, XOctagon, Info } from 'lucide-react';

const RiskBadge = ({ tier, score }) => {
  if (!tier) {
    return (
      <div className="bg-slate-800/50 border-2 border-slate-600 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <Info className="w-12 h-12 text-slate-400 mb-3" />
        <h2 className="text-xl font-bold text-slate-300">INSUFFICIENT EVIDENCE</h2>
      </div>
    );
  }

  const config = {
    CLEAR: {
      bg: 'bg-green-500/10',
      border: 'border-green-500',
      text: 'text-green-500',
      icon: ShieldCheck,
      label: 'CLEAR'
    },
    REVIEW: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500',
      text: 'text-amber-500',
      icon: AlertTriangle,
      label: 'REVIEW REQUIRED'
    },
    HIGH_RISK: {
      bg: 'bg-red-500/10',
      border: 'border-red-500',
      text: 'text-red-500',
      icon: XOctagon,
      label: 'HIGH RISK'
    }
  };

  const style = config[tier] || config.CLEAR;
  const Icon = style.icon;

  return (
    <div className={`${style.bg} border-2 ${style.border} rounded-xl p-6 flex items-center justify-between`}>
      <div className="flex items-center gap-4">
        <Icon className={`w-12 h-12 ${style.text}`} />
        <div>
          <h2 className={`text-2xl font-bold tracking-wider ${style.text}`}>{style.label}</h2>
          <p className="text-slate-400 text-sm mt-1">Automated Assessment Result</p>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-3xl font-bold ${style.text}`}>{score !== undefined ? score : '--'}</div>
        <div className="text-xs text-slate-400 uppercase tracking-wider">Risk Score</div>
      </div>
    </div>
  );
};

export default RiskBadge;
