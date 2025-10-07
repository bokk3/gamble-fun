import React from 'react';
import { useNavigate } from 'react-router-dom';

const Register: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl border border-white border-opacity-20 p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white text-center mb-8">Register</h1>
        
        <div className="text-center">
          <div className="text-6xl mb-4">🚧</div>
          <h2 className="text-xl font-bold text-white mb-4">Coming Soon!</h2>
          <p className="text-white opacity-75 mb-6">Registration is currently under development.</p>
          
          <button
            onClick={() => navigate('/login')}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold py-3 px-6 rounded-lg transition-all duration-200"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;