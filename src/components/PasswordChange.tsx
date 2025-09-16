import React, { useState } from 'react';
import { ArrowLeft, Save, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PasswordChangeProps {
  onNavigateBack: () => void;
}

const PasswordChange: React.FC<PasswordChangeProps> = ({ onNavigateBack }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Clear success message when user starts typing
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword.trim()) {
      newErrors.currentPassword = 'Le mot de passe actuel est requis';
    }

    if (!formData.newPassword.trim()) {
      newErrors.newPassword = 'Le nouveau mot de passe est requis';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Le nouveau mot de passe doit contenir au moins 6 caractères';
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'La confirmation du mot de passe est requise';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'Le nouveau mot de passe doit être différent de l\'actuel';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage('');

    try {
      // First, get the current user to obtain their email
      const { data: { user }, error: getUserError } = await supabase.auth.getUser();
      
      if (getUserError || !user?.email) {
        // Session is invalid, force logout to redirect to login
        await supabase.auth.signOut();
        return; // Component will unmount due to auth state change
      }

      // Re-authenticate the user with their current password to verify it and refresh the session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: formData.currentPassword
      });

      if (signInError) {
        if (signInError.message?.includes('Invalid login credentials')) {
          setErrors({ currentPassword: 'Mot de passe actuel incorrect' });
        } else {
          // Re-authentication failed for other reasons, force logout
          await supabase.auth.signOut();
          return; // Component will unmount due to auth state change
        }
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (updateError) {
        throw updateError;
      }

      // Success
      setSuccessMessage('Mot de passe modifié avec succès !');
      
      // Reset form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

    } catch (error: any) {
      console.error('Password change error:', error);
      
      if (error.message?.includes('Password should be at least')) {
        setErrors({ newPassword: 'Le mot de passe doit contenir au moins 6 caractères' });
      } else if (error.message?.includes('Session invalide')) {
        setErrors({ general: error.message });
      } else {
        setErrors({ general: 'Erreur lors de la modification. Veuillez réessayer.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onNavigateBack}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Changer le mot de passe</h1>
          <p className="text-gray-600 mt-1">Modifiez votre mot de passe de connexion</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 pb-8">
        <div className="max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">
                  {errors.general}
                </div>
              </div>
            )}

            {successMessage && (
              <div className="rounded-md bg-green-50 p-4">
                <div className="text-sm text-green-700">
                  {successMessage}
                </div>
              </div>
            )}

            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-semibold text-gray-900 mb-2">
                Mot de passe actuel <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  id="currentPassword"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                    errors.currentPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Entrez votre mot de passe actuel"
                />
                <Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.currentPassword}</p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-900 mb-2">
                Nouveau mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                    errors.newPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Entrez votre nouveau mot de passe"
                />
                <Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Le mot de passe doit contenir au moins 6 caractères</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-900 mb-2">
                Confirmer le nouveau mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Confirmez votre nouveau mot de passe"
                />
                <Lock className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={onNavigateBack}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors duration-200"
                >
                  <Save className="w-5 h-5" />
                  {isSubmitting ? 'Modification...' : 'Changer le mot de passe'}
                </button>
              </div>
            </div>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Sécurité</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Après la modification, vous resterez connecté sur cet appareil. 
                  Vous devrez utiliser le nouveau mot de passe lors de vos prochaines connexions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordChange;