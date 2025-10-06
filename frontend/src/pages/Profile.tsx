import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Sparkles } from 'lucide-react';
import { UserProfile } from '@/components/auth/UserProfile';
import { useLanguage } from '@/contexts/LanguageContext';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-cyan-400/10 to-blue-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-40 h-40 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      {/* Navigation Header */}
      <nav className="relative z-10 border-b border-gray-200/60 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost"
                onClick={() => navigate('/')}
                className="-ml-2 p-2 hover:translate-x-[-4px] transition-transform duration-200 hover:bg-white"
              >
                <ArrowLeft className="w-5 h-5 text-black" />
              </Button>

              
              <div className="h-8 w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent" />
              
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-xl transition-shadow duration-300">
                    <User className="w-6 h-6 text-white" />
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <span className="text-xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                    {t('profile.title')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Profile Content Container */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-full border border-indigo-100 mb-6">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-indigo-700">{t('profile.yourPersonalSpace')}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-cyan-900 bg-clip-text text-transparent mb-4">
              {t('profile.welcomeBack')}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              {t('profile.manageSettings')}
            </p>
          </div>

          {/* Profile Content with enhanced wrapper */}
          <div className="relative">
            {/* Subtle glow effect behind the profile */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-200/20 via-purple-200/20 to-cyan-200/20 rounded-3xl blur-xl -z-10"></div>
            
            {/* Profile component wrapper */}
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl shadow-gray-200/50 border border-white/60 overflow-hidden">
              <UserProfile />
            </div>
          </div>
        </div>
      </div>

      {/* Floating elements for visual interest */}
      <div className="absolute bottom-10 left-10 w-20 h-20 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-full blur-2xl animate-bounce delay-700 pointer-events-none"></div>
      <div className="absolute top-1/3 right-10 w-16 h-16 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-full blur-xl animate-bounce delay-1000 pointer-events-none"></div>
    </div>
  );
};

export default Profile;