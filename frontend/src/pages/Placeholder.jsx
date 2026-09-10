import { Construction } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Link } from 'react-router-dom';

const Placeholder = ({ pageName }) => {
  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center">
        <Construction className="w-24 h-24 text-slate-500 mb-6" />
        <h1 className="text-3xl font-bold text-slate-200 mb-4">{pageName}</h1>
        <p className="text-slate-400 max-w-md mb-8">
          This module is under development and will be available in a future release.
        </p>
        <Link to="/dashboard" className="text-cyber-500 hover:text-cyber-400 underline font-medium">
          Return to Dashboard
        </Link>
      </main>
    </div>
  );
};

export default Placeholder;
