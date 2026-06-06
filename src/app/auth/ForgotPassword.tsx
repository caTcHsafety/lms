import { useState } from 'react';
import { Link } from 'react-router';
import { supabase } from '@/lib/supabase';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      
      if (error) throw error;
      
      setStatus('success');
      setMessage('Password reset instructions have been sent to your email.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to send reset email. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#4493BF] mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Login
        </Link>
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#0D2543]">Reset Password</h2>
          <p className="text-gray-500 mt-2 text-sm">Enter your email address to receive reset instructions</p>
        </div>

        {status === 'success' ? (
          <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
            <CheckCircle className="mx-auto text-green-500 mb-3" size={32} />
            <p className="text-green-800 text-sm font-medium">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {status === 'error' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{message}</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4493BF] focus:border-[#4493BF] transition-all"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 bg-[#0D2543] hover:bg-[#1a385e] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
