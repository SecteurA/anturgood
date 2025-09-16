import React, { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProductAddProps {
  onNavigateBack: () => void;
}

const ProductAdd: React.FC<ProductAddProps> = ({ onNavigateBack }) => {
  const [formData, setFormData] = useState({
    nom_produit: '',
    prix_achat: '',
    prix_vente: '',
    unite: 'unite',
    dimension_standard: '1'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!formData.nom_produit.trim()) {
      newErrors.nom_produit = 'Le nom du produit est requis';
    }

    if (!formData.prix_achat.trim()) {
      newErrors.prix_achat = 'Le prix d\'achat est requis';
    } else if (isNaN(Number(formData.prix_achat)) || Number(formData.prix_achat) < 0) {
      newErrors.prix_achat = 'Le prix d\'achat doit être un nombre positif';
    }

    if (!formData.prix_vente.trim()) {
      newErrors.prix_vente = 'Le prix de vente est requis';
    } else if (isNaN(Number(formData.prix_vente)) || Number(formData.prix_vente) < 0) {
      newErrors.prix_vente = 'Le prix de vente doit être un nombre positif';
    }

    if (!formData.unite.trim()) {
      newErrors.unite = 'L\'unité est requise';
    }

    if (!formData.dimension_standard.trim()) {
      newErrors.dimension_standard = 'La dimension standard est requise';
    } else if (isNaN(Number(formData.dimension_standard)) || Number(formData.dimension_standard) <= 0) {
      newErrors.dimension_standard = 'La dimension standard doit être un nombre positif';
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
        .from('produits')
        .insert([
          {
            nom_produit: formData.nom_produit.trim(),
            prix_achat: Number(formData.prix_achat),
            prix_vente: Number(formData.prix_vente),
            unite: formData.unite,
            dimension_standard: Number(formData.dimension_standard)
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      console.log('Product saved successfully:', data);
      
      // Reset form
      setFormData({
        nom_produit: '',
        prix_achat: '',
        prix_vente: '',
        unite: 'unite',
        dimension_standard: '1'
      });

      onNavigateBack();
    } catch (error: any) {
      console.error('Error saving product:', error);
      setErrors({ general: 'Erreur lors de l\'enregistrement. Veuillez réessayer.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiresDimension = (unite: string) => {
    return ['ml', 'm2', 'kg', 'l', 'cm', 'm', 'g', 't'].includes(unite);
  };

  const getUnitLabel = (unite: string) => {
    const unitLabels = {
      unite: 'Unité',
      ml: 'ML',
      m2: 'M²',
      kg: 'KG',
      l: 'L',
      pcs: 'PCS',
      box: 'Boîte',
      cm: 'CM',
      m: 'M',
      g: 'G',
      t: 'T'
    };
    return unitLabels[unite as keyof typeof unitLabels] || unite.toUpperCase();
  };

  const calculateMargin = () => {
    const achat = Number(formData.prix_achat);
    const vente = Number(formData.prix_vente);
    if (achat > 0 && vente > 0) {
      const margin = vente - achat;
      const marginPercent = (margin / achat * 100);
      return { margin, marginPercent };
    }
    return null;
  };

  const marginData = calculateMargin();

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
          <h1 className="text-3xl font-bold text-gray-900">Ajouter un produit</h1>
          <p className="text-gray-600 mt-1">Créez un nouveau produit dans le catalogue</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 pb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">
                  {errors.general}
                </div>
              </div>
            )}

            {/* Product Name */}
            <div>
              <label htmlFor="nom_produit" className="block text-sm font-semibold text-gray-900 mb-2">
                Nom du Produit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="nom_produit"
                name="nom_produit"
                value={formData.nom_produit}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                  errors.nom_produit ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Entrez le nom du produit"
              />
              {errors.nom_produit && (
                <p className="text-red-500 text-xs mt-1">{errors.nom_produit}</p>
              )}
            </div>

            {/* Price Fields */}
            <div className="grid grid-cols-4 gap-6">
              <div>
                <label htmlFor="prix_achat" className="block text-sm font-semibold text-gray-900 mb-2">
                  Prix d'Achat (MAD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="prix_achat"
                  name="prix_achat"
                  value={formData.prix_achat}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                    errors.prix_achat ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {errors.prix_achat && (
                  <p className="text-red-500 text-xs mt-1">{errors.prix_achat}</p>
                )}
              </div>

              <div>
                <label htmlFor="prix_vente" className="block text-sm font-semibold text-gray-900 mb-2">
                  Prix de Vente (MAD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="prix_vente"
                  name="prix_vente"
                  value={formData.prix_vente}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                    errors.prix_vente ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {errors.prix_vente && (
                  <p className="text-red-500 text-xs mt-1">{errors.prix_vente}</p>
                )}
              </div>

              <div>
                <label htmlFor="unite" className="block text-sm font-semibold text-gray-900 mb-2">
                  Unité <span className="text-red-500">*</span>
                </label>
                <select
                  id="unite"
                  name="unite"
                  value={formData.unite}
                  onChange={(e) => setFormData(prev => ({ ...prev, unite: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                    errors.unite ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="unite">Unité</option>
                  <option value="ml">Mètre linéaire (ML)</option>
                  <option value="m2">Mètre carré (M²)</option>
                  <option value="kg">Kilogramme (KG)</option>
                  <option value="l">Litre (L)</option>
                  <option value="pcs">Pièces (PCS)</option>
                  <option value="box">Boîte</option>
                  <option value="cm">Centimètre (CM)</option>
                  <option value="m">Mètre (M)</option>
                  <option value="g">Gramme (G)</option>
                  <option value="t">Tonne (T)</option>
                </select>
                {errors.unite && (
                  <p className="text-red-500 text-xs mt-1">{errors.unite}</p>
                )}
              </div>
            </div>

            {/* Dimension Field - Only for measurement units */}
            {requiresDimension(formData.unite) && (
              <div>
                <label htmlFor="dimension_standard" className="block text-sm font-semibold text-gray-900 mb-2">
                  Dimension Standard <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    id="dimension_standard"
                    name="dimension_standard"
                    value={formData.dimension_standard}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0.01"
                    className={`w-32 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 ${
                      errors.dimension_standard ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="4.3"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {getUnitLabel(formData.unite)} par pièce
                  </span>
                </div>
                {errors.dimension_standard && (
                  <p className="text-red-500 text-xs mt-1">{errors.dimension_standard}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Dimension standard par pièce. Exemple: une poutrelle de 4.3m
                </p>
              </div>
            )}

            {/* Margin Calculation */}
            {marginData && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Aperçu de la marge</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Marge unitaire:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {new Intl.NumberFormat('fr-MA', {
                        minimumFractionDigits: 2,
                        useGrouping: false
                      }).format(marginData.margin)} DH
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Pourcentage de marge:</span>
                    <span className={`ml-2 font-medium ${
                      marginData.marginPercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {marginData.marginPercent >= 0 ? '+' : ''}{marginData.marginPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

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
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer le produit'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProductAdd;