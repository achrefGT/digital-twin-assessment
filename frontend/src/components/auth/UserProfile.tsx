import React, { useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Mail, 
  Calendar, 
  Edit2, 
  Save, 
  X, 
  Lock, 
  Eye, 
  EyeOff,
  UserCheck,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export const UserProfile: React.FC = () => {
  const { user, changePassword, updateProfile } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || ''
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const formatDate = (dateString: string) => {
    const locale = language === 'fr' ? 'fr-FR' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'super_admin':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return t('userNav.admin');
      case 'super_admin':
        return t('userNav.superAdmin');
      default:
        return t('userNav.user');
    }
  };

  const handleProfileEdit = () => {
    setProfileData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || ''
    });
    setIsEditingProfile(true);
  };

  const handleProfileCancel = () => {
    setProfileData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || ''
    });
    setIsEditingProfile(false);
  };

  const handleProfileSave = async () => {
    if (!user) return;

    setIsUpdatingProfile(true);
    try {
      await updateProfile({
        first_name: profileData.first_name.trim() || undefined,
        last_name: profileData.last_name.trim() || undefined
      });
      toast({ title: t('profile.profileUpdated'), description: t('profile.profileUpdatedDesc') });
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: t('profile.updateFailed'),
        description: error instanceof Error ? error.message : t('profile.updateFailedDesc'),
        variant: 'destructive'
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast({
        title: t('profile.passwordMismatch'),
        description: t('profile.passwordMismatchDesc'),
        variant: 'destructive'
      });
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast({
        title: t('profile.passwordTooShort'),
        description: t('auth.passwordTooShort'),
        variant: 'destructive'
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordData.current_password, passwordData.new_password);
      toast({ title: t('profile.passwordChanged'), description: t('profile.passwordChangedDesc') });
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      setShowPasswords({ current: false, new: false, confirm: false });
      setShowPasswordForm(false);
    } catch (error) {
      console.error('Password change error:', error);
      toast({
        title: t('profile.passwordChangeFailed'),
        description: error instanceof Error ? error.message : t('profile.passwordChangeFailedDesc'),
        variant: 'destructive'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  if (!user) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center">
          <p className="text-gray-500">{t('profile.notAvailable')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {t('profile.personalInfo')}
                </CardTitle>
                <CardDescription>{t('profile.managePersonalInfo')}</CardDescription>
              </div>
              {!isEditingProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleProfileEdit}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  {t('common.edit')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="first_name">{t('auth.firstName')}</Label>
                {isEditingProfile ? (
                  <Input
                    id="first_name"
                    value={profileData.first_name}
                    onChange={(e) => setProfileData(prev => ({
                      ...prev,
                      first_name: e.target.value
                    }))}
                    placeholder={t('profile.enterFirstName')}
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{user.first_name || t('profile.notProvided')}</p>
                )}
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <Label htmlFor="last_name">{t('auth.lastName')}</Label>
                {isEditingProfile ? (
                  <Input
                    id="last_name"
                    value={profileData.last_name}
                    onChange={(e) => setProfileData(prev => ({
                      ...prev,
                      last_name: e.target.value
                    }))}
                    placeholder={t('profile.enterLastName')}
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{user.last_name || t('profile.notProvided')}</p>
                )}
              </div>
            </div>

            {isEditingProfile && (
              <div className="flex items-center gap-3 pt-4">
                <Button
                  onClick={handleProfileSave}
                  disabled={isUpdatingProfile}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isUpdatingProfile ? t('profile.saving') : t('profile.saveChanges')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleProfileCancel}
                  disabled={isUpdatingProfile}
                  className="flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  {t('common.cancel')}
                </Button>
              </div>
            )}

            <Separator />

            {/* Read-only fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {t('auth.email')}
                </Label>
                <p className="text-sm font-medium text-gray-900">{user.email}</p>
              </div>

              <div className="space-y-2">
                <Label>{t('auth.username')}</Label>
                <p className="text-sm font-medium text-gray-900">{user.username}</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {t('profile.role')}
                </Label>
                <Badge className={getRoleColor(user.role)}>
                  {getRoleLabel(user.role)}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  {t('profile.accountStatus')}
                </Label>
                <div className="flex items-center gap-2">
                  <Badge variant={user.is_active ? 'default' : 'secondary'}>
                    {user.is_active ? t('profile.active') : t('profile.inactive')}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {t('profile.memberSince')}
                </Label>
                <p className="text-sm font-medium text-gray-900">{formatDate(user.created_at)}</p>
              </div>

              {user.last_login && (
                <div className="space-y-2">
                  <Label>{t('profile.lastLogin')}</Label>
                  <p className="text-sm font-medium text-gray-900">{formatDate(user.last_login)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                {t('profile.securitySettings')}
              </CardTitle>
              <CardDescription>{t('profile.manageAccountSecurity')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {!showPasswordForm ? (
              <Button
                onClick={() => setShowPasswordForm(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {t('profile.changePassword')}
              </Button>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label htmlFor="current_password">{t('profile.currentPassword')}</Label>
                    <div className="relative">
                      <Input
                        id="current_password"
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwordData.current_password}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => togglePasswordVisibility('current')}
                      >
                        {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="new_password">{t('profile.newPassword')}</Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwordData.new_password}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                        required
                        minLength={8}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => togglePasswordVisibility('new')}
                      >
                        {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">{t('profile.confirmNewPassword')}</Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordData.confirm_password}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                        required
                        minLength={8}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => togglePasswordVisibility('confirm')}
                      >
                        {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={isChangingPassword} className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {isChangingPassword ? t('profile.changing') : t('profile.changePassword')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
                      setShowPasswords({ current: false, new: false, confirm: false });
                    }}
                    className="flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserProfile;