import React, { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FournisseurAddProps {
  onNavigateBack: () => void;
}

const FournisseurAdd: React.FC<FournisseurAddProps> = ({ onNavigateBack }) => {
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    societe: '',
    ice: '',
    email: '',
    telephone: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [nextFournisseurNumber, setNextFournisseurNumber] = useState<string>('');

  // Generate next fournisseur number from database
  const generateFournisseurNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('numero_fournisseur')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = data[0].numero_fournisseur.replace('FRS-', '');
        nextNumber = parseInt(lastNumber) + 1;
      }

      return `FRS-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating fournisseur number:', error);
      return `FRS-001`;
    }
  };

  // Load next fournisseur number on component mount
  React.useEffect(() => {
    generateFournisseurNumber().then(setNextFournisseurNumber);
  }, []);

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
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Required fields validation
    if (!formData.nom.trim()) {
      newErrors.nom = 'Le nom est requis';
    }

    if (!formData.prenom.trim()) {
      newErrors.prenom = 'Le prénom est requis';
    }

    // Optional field validations (only if filled)
    if (formData.ice.trim() && formData.ice.length !== 15) {
      newErrors.ice = 'Le numéro ICE doit contenir 15 chiffres';
    } else if (formData.ice.trim() && !/^\d+$/.test(formData.ice)) {
      newErrors.ice = 'Le numéro ICE ne doit contenir que des chiffres';
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format d\'email invalide';
    }

    if (!formData.telephone.trim()) {
      newErrors.telephone = 'Le téléphone est requis';
    } else if (!/^(\+212|0)[5-7]\d{8}$/.test(formData.telephone.replace(/\s/g, ''))) {
      newErrors.telephone = 'Format de téléphone marocain invalide';
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

    try {
      // Save to Supabase
      const { data, error } = await supabase
        .from('fournisseurs')
        .insert([
          {
            numero_fournisseur: nextFournisseurNumber,
            nom: formData.nom.trim(),
            prenom: formData.prenom.trim(),
            societe: formData.societe.trim(),
            ice: formData.ice.trim(),
            email: formData.email.trim(),
            telephone: formData.telephone.trim()
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      console.log('Fournisseur saved successfully:', data);
      
      // Reset form
      setFormData({
        nom: '',
        prenom: '',
        societe: '',
        ice: '',
        email: '',
        telephone: ''
      });

      onNavigateBack();
    } catch (error: any) {
      console.error('Error saving fournisseur:', error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        if (error.details?.includes('numero_fournisseur')) {
          setErrors({ general: 'Ce numéro fournisseur existe déjà' });
        } else if (error.details?.includes('ice')) {
          setErrors({ ice: 'Ce numéro ICE est déjà utilisé' });
        } else {
          setErrors({ general: 'Ces informations existent déjà' });
        }
      } else {
        setErrors({ general: 'Erreur lors de l\'enregistrement. Veuillez réessayer.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!nextFournisseurNumber) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Ajouter un fournisseur</h1>
          <p className="text-gray-600 mt-1">Créez un nouveau fournisseur dans le système</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 pb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Fournisseur Number (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Numéro Fournisseur
              </label>
              <input
                type="text"
                value={nextFournisseurNumber}
                readOnly
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
              />
              <p className="text-xs text-gray-500 mt-1">Ce numéro sera généré automatiquement</p>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="prenom" className="block text-sm font-semibold text-gray-900 mb-2">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="prenom"
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                    errors.prenom ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Entrez le prénom"
                />
                {errors.prenom && (
                  <p className="text-red-500 text-xs mt-1">{errors.prenom}</p>
                )}
              </div>

              <div>
                <label htmlFor="nom" className="block text-sm font-semibold text-gray-900 mb-2">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nom"
                  name="nom"
                  value={formData.nom}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                    errors.nom ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Entrez le nom"
                />
                {errors.nom && (
                  <p className="text-red-500 text-xs mt-1">{errors.nom}</p>
                )}
              </div>
            </div>

            {/* Company */}
            <div>
              <label htmlFor="societe" className="block text-sm font-semibold text-gray-900 mb-2">
                Société
              </label>
              <input
                type="text"
                id="societe"
                name="societe"
                value={formData.societe}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                  errors.societe ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Entrez le nom de la société"
              />
              {errors.societe && (
                <p className="text-red-500 text-xs mt-1">{errors.societe}</p>
              )}
            </div>

            {/* ICE */}
            <div>
              <label htmlFor="ice" className="block text-sm font-semibold text-gray-900 mb-2">
                Numéro ICE
              </label>
              <input
                type="text"
                id="ice"
                name="ice"
                value={formData.ice}
                onChange={handleInputChange}
                maxLength={15}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 font-mono ${
                  errors.ice ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="000000000000000 (15 chiffres)"
              />
              {errors.ice && (
                <p className="text-red-500 text-xs mt-1">{errors.ice}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Le numéro ICE doit contenir exactement 15 chiffres</p>
            </div>

            {/* Contact Fields */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="exemple@email.com"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="telephone" className="block text-sm font-semibold text-gray-900 mb-2">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="telephone"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                    errors.telephone ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="+212 6 12 34 56 78"
                />
                {errors.telephone && (
                  <p className="text-red-500 text-xs mt-1">{errors.telephone}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Format: +212 6 XX XX XX XX ou 06 XX XX XX XX</p>
              </div>
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
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer le fournisseur'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FournisseurAdd;