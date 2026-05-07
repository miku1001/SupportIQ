import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Completing sign-in...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get('code');
      const error = currentUrl.searchParams.get('error_description') || currentUrl.searchParams.get('error');

      if (error) {
        setMessage(error);
        return;
      }

      if (!code) {
        navigate('/admin', { replace: true });
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setMessage(exchangeError.message || 'Unable to complete OAuth sign-in.');
        return;
      }

      navigate('/admin', { replace: true });
    };

    handleOAuthCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100">
      <div className="max-w-md space-y-3">
        <p className="text-lg font-semibold">{message}</p>
        <p className="text-sm text-zinc-400">If this page does not redirect automatically, return to the admin login page.</p>
      </div>
    </div>
  );
}

export default AuthCallback;