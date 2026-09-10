import { CheckCircle, XCircle, AlertTriangle, PauseCircle } from 'lucide-react';

const CheckResult = ({ name, status, detail }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'PASSED':
        return (
          <div className="flex items-center gap-1.5 text-green-500 font-medium">
            <CheckCircle className="w-4 h-4" />
            <span>PASSED</span>
          </div>
        );
      case 'FAILED':
        return (
          <div className="flex items-center gap-1.5 text-red-500 font-medium">
            <XCircle className="w-4 h-4" />
            <span>FAILED</span>
          </div>
        );
      case 'INCONCLUSIVE':
        return (
          <div className="flex items-center gap-1.5 text-amber-500 font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>INCONCLUSIVE</span>
          </div>
        );
      case 'UNAVAILABLE':
      default:
        return (
          <div className="flex items-center gap-1.5 text-slate-400 font-medium">
            <PauseCircle className="w-4 h-4" />
            <span>UNAVAILABLE</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-navy-800 border border-navy-600 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <span className="font-medium text-slate-200">{name}</span>
        {getStatusDisplay()}
      </div>
      {detail && <p className="text-sm text-slate-400">{detail}</p>}
    </div>
  );
};

export default CheckResult;
