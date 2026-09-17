import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, ScanLine, ClipboardList, Bell, BarChart3, Settings, LogOut } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);

  let officer = { full_name: 'Officer', badge_number: '000' };
  try {
    const saved = localStorage.getItem('identix_officer');
    if (saved) officer = JSON.parse(saved);
  } catch(e) {}

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const token = localStorage.getItem('identix_token');
        const res = await fetch('/api/history', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          const count = data.filter(r => r.risk_tier === 'HIGH_RISK').length;
          setAlertCount(count);
        }
      } catch (_) {}
    };
    fetchAlerts();
    const id = setInterval(fetchAlerts, 30000);
    return () => clearInterval(id);
  }, []);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/screening/new', label: 'New Screening', icon: ScanLine },
    { path: '/history', label: 'History', icon: ClipboardList },
    { path: '/alerts', label: 'Alerts', icon: Bell, badge: alertCount || null },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('identix_token');
    localStorage.removeItem('identix_officer');
    navigate('/login');
  };

  return (
    <div className="w-[240px] bg-navy-900 border-r border-navy-600 h-full flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <Shield className="text-cyber-500 w-8 h-8" />
        <div>
          <h2 className="text-xl font-bold text-cyber-500 tracking-wider">IDentix</h2>
        </div>
      </div>
      
      <div className="px-6 mb-6">
        <div className="bg-navy-800 rounded-lg p-3 border border-navy-600">
          <p className="text-sm font-medium text-slate-200">{officer.full_name}</p>
          <p className="text-xs text-slate-400">Badge: {officer.badge_number}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between px-3 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-cyber-500/10 text-cyber-400 border-r-2 border-cyber-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              {item.badge && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-navy-600">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-3 text-slate-400 hover:text-red-400 hover:bg-navy-700 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
