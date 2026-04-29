import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function GoogleSignIn() {
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.token) {
          // Existing user - log them in
          sessionStorage.setItem('sf_token', data.token);
          localStorage.setItem('sf_user', JSON.stringify(data.user));
          if (data.school) {
            localStorage.setItem('sf_school', JSON.stringify(data.school));
          }
          toast.success('Logged in successfully!');
          window.location.href = '/';
        } else if (data.requiresRegistration) {
          // New user - redirect to registration with Google data
          navigate('/register', {
            state: { googleData: data.googleData }
          });
        }
      } else {
        toast.error(data.error || 'Google login failed');
      }
    } catch (error) {
      console.error('Google login error:', error);
      toast.error('Failed to authenticate with Google');
    }
  };

  const handleError = () => {
    toast.error('Failed to authenticate with Google');
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={handleError}
      theme="outline"
      size="large"
      locale="en"
    />
  );
}
