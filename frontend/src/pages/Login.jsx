import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../lib/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/api/login', formData);
      localStorage.setItem('identix_token', response.data.access_token);
      localStorage.setItem('identix_officer', JSON.stringify(response.data.officer));
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="bg-navy-800 border border-navy-600 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Shield className="w-16 h-16 text-cyber-500 mb-4" />
          <h1 className="text-3xl font-bold text-cyber-500 tracking-wider">IDentix</h1>
          <p className="text-slate-400 text-sm text-center mt-2">Border Security Document Verification System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
            <input
              type="text"
              className="w-full bg-navy-700 border border-navy-600 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-cyber-500 focus:ring-1 focus:ring-cyber-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-navy-700 border border-navy-600 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-cyber-500 focus:ring-1 focus:ring-cyber-500 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && <div className="text-red-500 text-sm text-center">{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-cyber-500 hover:bg-cyber-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors"
          >
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Login'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-navy-600 pt-4">
          <p className="text-amber-500 text-xs font-bold tracking-widest">OFFICIAL USE ONLY — AUTHORIZED PERSONNEL</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
