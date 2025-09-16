import React, { useState } from 'react';
import { ArrowLeft, Save, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChauffeurAddProps {
  onNavigateBack: () => void;
}

const ChauffeurAdd: React.FC<ChauffeurAddProps> = ({ onNavigateBack }) => {
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    immatricule: '',
    type_chauffeur: 'externe'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [nextChauffeurNumber, setNextChauffeurNumber] = useState<string>('');

  // Generate next chauffeur number from database
  const generateChauffeurNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('chauffeurs')
        .select('numero_chauffeur')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = data[0].numero_chauffeur.replace('CHA-', '');
        nextNumber = parseInt(lastNumber) + 1;
      }

      return `CHA-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating chauffeur number:', error);
      return `CHA-001`;
    }
  };

  // Load next chauffeur number on component mount
  React.useEffect(() => {
    generateChauffeurNumber().then(setNextChauffeurNumber);
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

    if (!formData.telephone.trim()) {
      newErrors.telephone = 'Le téléphone est requis';
    } else if (!/^(\+212|0)[5-7]\d{8}$/.test(formData.telephone.replace(/\s/g, ''))) {
      newErrors.telephone = 'Format de téléphone marocain invalide';
    }

    if (!formData.immatricule.trim()) {
      newErrors.immatricule = 'L\'immatricule est requise';
    } else if (!/^[0-9]+\s*[|‎-]\s*[أ-ي]+\s*[|‎-]\s*[0-9]+$|^[0-9]{1,6}\s*[A-Z]{1,3}\s*[0-9]{1,3}$/.test(formData.immatricule.trim())) {
      // Accept both Moroccan formats: Arabic and Latin
      newErrors.immatricule = 'Format d\'immatricule invalide (ex: 123456 A 12 ou 12345|أ|67)';
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
        .from('chauffeurs')
        .insert([
          {
            numero_chauffeur: nextChauffeurNumber,
            nom: formData.nom.trim(),
            prenom: formData.prenom.trim(),
            telephone: formData.telephone.trim(),
            immatricule: formData.immatricule.trim(),
            type_chauffeur: formData.type_chauffeur
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      console.log('Chauffeur saved successfully:', data);
      
      // Reset form
      setFormData({
        nom: '',
        prenom: '',
        telephone: '',
        immatricule: '',
        type_chauffeur: 'externe'
      });

      onNavigateBack();
    } catch (error: any) {
      console.error('Error saving chauffeur:', error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        if (error.details?.includes('numero_chauffeur')) {
          setErrors({ general: 'Ce numéro chauffeur existe déjà' });
        } else if (error.details?.includes('immatricule')) {
          setErrors({ immatricule: 'Cette immatricule est déjà utilisée' });
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

  if (!nextChauffeurNumber) {
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
          <h1 className="text-3xl font-bold text-gray-900">Ajouter un chauffeur</h1>
          <p className="text-gray-600 mt-1">Créez un nouveau chauffeur dans le système</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 pb-8">
        <div className="max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">
                  {errors.general}
                </div>
              </div>
            )}

            {/* Chauffeur Number (Read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Numéro Chauffeur
              </label>
              <input
                type="text"
                value={nextChauffeurNumber}
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

            {/* Contact Information */}
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

            {/* Vehicle License Plate */}
            <div>
              <label htmlFor="immatricule" className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Véhicule Assigné (Immatricule) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="immatricule"
                name="immatricule"
                value={formData.immatricule}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 font-mono ${
                  errors.immatricule ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="123456 A 12 ou 12345|أ|67"
              />
              {errors.immatricule && (
                <p className="text-red-500 text-xs mt-1">{errors.immatricule}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Véhicule par défaut assigné au chauffeur. Peut être modifié lors des livraisons.
              </p>
            </div>

            {/* Driver Type */}
            <div>
              <label htmlFor="type_chauffeur" className="block text-sm font-semibold text-gray-900 mb-2">
                Type de Chauffeur <span className="text-red-500">*</span>
              </label>
              <select
                id="type_chauffeur"
                name="type_chauffeur"
                value={formData.type_chauffeur}
                onChange={(e) => setFormData(prev => ({ ...prev, type_chauffeur: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200"
              >
                <option value="externe">Externe (Payé par BL)</option>
                <option value="interne">Interne (Salaire fixe)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Les chauffeurs externes sont payés par bon de livraison, les internes reçoivent un salaire fixe.
              </p>
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
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer le chauffeur'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChauffeurAdd;