import React, { useState } from 'react';
import { ArrowLeft, Save, Edit3, FileText, Truck, Users, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DeliveryNote {
  id: string;
  numero_livraison: string;
  date_livraison: string;
  statut: string;
  total_ht: number;
  notes: string;
  immatricule_utilise: string;
  client: {
    nom: string;
    prenom: string;
    societe: string;
    numero_client: string;
  };
  chauffeur: {
    nom: string;
    prenom: string;
    numero_chauffeur: string;
  };
  bon_commande: {
    numero_commande: string;
  };
}

interface DeliveryItem {
  id: string;
  quantite_commandee: number;
  quantite_livree: number;
  prix_unitaire: number;
  total_ligne: number;
  produit: {
    nom_produit: string;
  };
}

interface DeliveryNoteEditProps {
  onNavigateBack: () => void;
  note: DeliveryNote;
}

const DeliveryNoteEdit: React.FC<DeliveryNoteEditProps> = ({ onNavigateBack, note }) => {
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    statut: note.statut,
    notes: note.notes || '',
    immatricule_utilise: note.immatricule_utilise
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printWithPrices, setPrintWithPrices] = useState(true);

  const handlePrint = (withPrices: boolean) => {
    setPrintWithPrices(withPrices);
    setShowPrintModal(false);
    // Small delay to ensure state is updated before printing
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Load delivery items on component mount
  React.useEffect(() => {
    fetchDeliveryItems();
  }, []);

  const fetchDeliveryItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('bon_de_livraison_items')
        .select(`
          *,
          produit:produits(nom_produit, prix_vente, unite)
        `)
        .eq('livraison_id', note.id)
        .order('id', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setDeliveryItems(data || []);
    } catch (err: any) {
      console.error('Error fetching delivery items:', err);
      setError('Erreur lors du chargement des détails de la livraison');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    setDeliveryItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, quantite_livree: newQuantity, total_ligne: item.prix_unitaire * newQuantity }
          : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);

    try {
      // Calculate new total
      const newTotal = deliveryItems.reduce((sum, item) => sum + item.total_ligne, 0);

      // Update delivery note
      const { data, error } = await supabase
        .from('bon_de_livraison')
        .update({
          statut: formData.statut,
          notes: formData.notes.trim() || null,
          immatricule_utilise: formData.immatricule_utilise.trim(),
          total_ht: newTotal
        })
        .eq('id', note.id)
        .select();

      if (error) {
        throw error;
      }

      // Update delivery items
      for (const item of deliveryItems) {
        const { error: itemError } = await supabase
          .from('bon_de_livraison_items')
          .update({
            quantite_livree: item.quantite_livree
          })
          .eq('id', item.id);

        if (itemError) {
          throw itemError;
        }
      }

      // If status is changed to "livree", update the source purchase order
      if (formData.statut === 'livree') {
        // Get the delivery note with purchase order and client info
        const { data: deliveryData, error: deliveryError } = await supabase
          .from('bon_de_livraison')
          .select('bon_commande_id, client_id')
          .eq('id', note.id)
          .single();

        if (deliveryError) {
          console.error('Error fetching delivery data:', deliveryError);
        } else {
          // Update the purchase order status to "livree" and assign client
          const { error: purchaseOrderError } = await supabase
            .from('bon_de_commande')
            .update({
              statut: 'livree',
              client_id: deliveryData.client_id
            })
            .eq('id', deliveryData.bon_commande_id);

          if (purchaseOrderError) {
            console.error('Error updating purchase order:', purchaseOrderError);
          } else {
            console.log('Purchase order updated to delivered status with client assignment');
          }
        }
      }
      console.log('Delivery note updated successfully:', data);
      onNavigateBack();
    } catch (error: any) {
      console.error('Error updating delivery note:', error);
      setError('Erreur lors de la modification. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-MA', {
      minimumFractionDigits: 2,
      useGrouping: false
    }).format(price) + ' DH';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      en_preparation: 'bg-yellow-100 text-yellow-800',
      en_cours: 'bg-blue-100 text-blue-800',
      livree: 'bg-green-100 text-green-800',
      annulee: 'bg-red-100 text-red-800'
    };

    const statusLabel = {
      en_preparation: 'En préparation',
      en_cours: 'En cours',
      livree: 'Livrée',
      annulee: 'Annulée'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusConfig[status as keyof typeof statusConfig] || statusConfig.en_preparation
      }`}>
        {statusLabel[status as keyof typeof statusLabel] || status}
      </span>
    );
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

  const getUnitBadge = (unite: string) => {
    const unitConfig = {
      unite: 'bg-gray-100 text-gray-800',
      ml: 'bg-blue-100 text-blue-800',
      m2: 'bg-green-100 text-green-800',
      kg: 'bg-purple-100 text-purple-800',
      l: 'bg-cyan-100 text-cyan-800',
      pcs: 'bg-orange-100 text-orange-800',
      box: 'bg-amber-100 text-amber-800',
      cm: 'bg-indigo-100 text-indigo-800',
      m: 'bg-teal-100 text-teal-800',
      g: 'bg-pink-100 text-pink-800',
      t: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        unitConfig[unite as keyof typeof unitConfig] || unitConfig.unite
      }`}>
        {getUnitLabel(unite)}
      </span>
    );
  };

  const requiresDualInput = (unite: string) => {
    return ['ml', 'm2', 'kg', 'l', 'cm', 'm', 'g', 't'].includes(unite);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Chargement des détails...</p>
        </div>
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
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{note.numero_livraison}</h1>
            {getStatusBadge(note.statut)}
          </div>
          <p className="text-gray-600 mt-1">
            Bon de livraison du {new Date(note.date_livraison).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <button
          onClick={() => setShowPrintModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200 print:hidden"
        >
          <Printer className="w-4 h-4" />
          Imprimer
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Delivery Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Informations générales
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="font-medium text-gray-900">Bon de commande source</div>
                  <div className="text-sm text-gray-600 mt-1 font-mono">
                    {note.bon_commande.numero_commande}
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="font-medium text-gray-900">Date de livraison</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {new Date(note.date_livraison).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
            </div>

            {/* Client Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Client
              </h2>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="font-medium text-gray-900">{note.client.societe}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {note.client.prenom} {note.client.nom}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {note.client.numero_client}
                </div>
              </div>
            </div>

            {/* Chauffeur Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Chauffeur et véhicule
              </h2>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="font-medium text-gray-900">
                    {note.chauffeur.prenom} {note.chauffeur.nom}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{note.chauffeur.numero_chauffeur}</div>
                </div>
                
                <div>
                  <label htmlFor="immatricule_utilise" className="block text-sm font-medium text-gray-700 mb-2">
                    Véhicule utilisé (Immatricule)
                  </label>
                  <input
                    type="text"
                    id="immatricule_utilise"
                    name="immatricule_utilise"
                    value={formData.immatricule_utilise}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Items */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Articles à livrer</h2>
              
              {deliveryItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Produit</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Unité</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Prix unitaire</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Nb Pièces</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Dimension</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Quantité Totale</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {deliveryItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {item.produit.nom_produit}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getUnitBadge(item.produit?.unite || 'unite')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatPrice(item.prix_unitaire)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.quantite_pieces || Math.round(item.quantite_livree / 1)}
                          </td>
                          <td className="px-4 py-3">
                            {requiresDualInput(item.produit.unite) ? (
                              <span className="text-sm font-medium text-blue-600">
                                {item.quantite_unitaire || 1} {getUnitLabel(item.produit.unite)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-blue-600">
                              {requiresDualInput(item.produit.unite) ? (
                                `${item.quantite_livree} ${getUnitLabel(item.produit.unite)}`
                              ) : (
                                `${item.quantite_livree} ${getUnitLabel(item.produit.unite)}`
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {formatPrice(item.total_ligne)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          Total:
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">
                          {formatPrice(deliveryItems.reduce((sum, item) => sum + item.total_ligne, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Aucun article dans cette livraison</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Edit Form */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                Modifier la livraison
              </h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="statut" className="block text-sm font-medium text-gray-700 mb-1">
                    Statut
                  </label>
                  <select
                    id="statut"
                    name="statut"
                    value={formData.statut}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="en_preparation">En préparation</option>
                    <option value="en_cours">En cours</option>
                    <option value="livree">Livrée</option>
                    <option value="annulee">Annulée</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Notes pour cette livraison..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-6 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={onNavigateBack}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors duration-200"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </form>

            {/* Delivery Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Récapitulatif</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Date de livraison:</span>
                  <span className="font-medium">{new Date(note.date_livraison).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Articles commandés:</span>
                  <span className="font-medium">{deliveryItems.reduce((sum, item) => sum + item.quantite_commandee, 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Articles à livrer:</span>
                  <span className="font-medium">{deliveryItems.reduce((sum, item) => sum + item.quantite_livree, 0)}</span>
                </div>
                <div className="flex justify-between py-2 border-t border-gray-200 text-lg font-semibold">
                  <span>Total:</span>
                  <span>{formatPrice(deliveryItems.reduce((sum, item) => sum + item.total_ligne, 0))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Options Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Options d'impression</h3>
              <p className="text-sm text-gray-600 mt-1">Choisissez le type de bon de livraison à imprimer</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <button
                  onClick={() => handlePrint(true)}
                  className="w-full p-4 border-2 border-blue-300 rounded-lg hover:bg-blue-50 transition-colors duration-200 text-left"
                >
                  <div className="font-medium text-gray-900">BL Chiffré</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Avec prix unitaires et totaux
                  </div>
                </button>
                
                <button
                  onClick={() => handlePrint(false)}
                  className="w-full p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 text-left"
                >
                  <div className="font-medium text-gray-900">BL Non Chiffré</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Sans informations de prix
                  </div>
                </button>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowPrintModal(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print-only content */}
      <div
  className="hidden print:block fixed inset-0 bg-white px-8 pt-0 pb-8"
  style={{ marginTop: "-28px" }} // pulls content up to kill the top gap
>
        {/* Company Header */}
<div className="grid grid-cols-3 items-center border-b-2 border-gray-800 py-1 mb-2">
  {/* Left: Logo */}
  <div className="flex justify-start">
    <img
      src="https://pub-237d2da54b564d23aaa1c3826e1d4e65.r2.dev/ANTURGOOD/logo2.png"
      alt="ANTURGOOD Logo"
      className="h-32 w-auto"
    />
  </div>

  {/* Center: Title */}
  <div className="text-center">
    <p className="text-lg text-gray-900 font-bold">BON DE LIVRAISON</p>
  </div>

  {/* Right: empty for balance */}
  <div></div>
</div>

        {/* Delivery Note Info */}
        <div className="mb-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations Livraison</h3>
              <div className="space-y-2">
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32">N° BL:</span>
                  <span className="text-gray-900">{note.numero_livraison}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32">Date:</span>
                  <span className="text-gray-900">{new Date(note.date_livraison).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32">BC Source:</span>
                  <span className="text-gray-900">{note.bon_commande.numero_commande}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Client</h3>
              <div className="space-y-2">
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32">Société:</span>
                  <span className="text-gray-900">{note.client.societe}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32">Contact:</span>
                  <span className="text-gray-900">{note.client.prenom} {note.client.nom}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Articles Livrés</h3>
          <table className="w-full border-collapse border border-gray-800">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-800 px-4 py-2 text-left font-semibold">Produit</th>
                <th className="border border-gray-800 px-4 py-2 text-center font-semibold">Nb Pièces</th>
                <th className="border border-gray-800 px-4 py-2 text-center font-semibold">Dimension</th>
                <th className="border border-gray-800 px-4 py-2 text-center font-semibold">Quantité Totale</th>
                {printWithPrices && (
                  <>
                    <th className="border border-gray-800 px-4 py-2 text-right font-semibold">Prix Unitaire</th>
                    <th className="border border-gray-800 px-4 py-2 text-right font-semibold">Total</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {deliveryItems.map((item) => (
                <tr key={item.id}>
                  <td className="border border-gray-800 px-4 py-2">{item.produit.nom_produit}</td>
                  <td className="border border-gray-800 px-4 py-2 text-center">
                    {item.quantite_pieces || Math.round(item.quantite_livree)}
                  </td>
                  <td className="border border-gray-800 px-4 py-2 text-center">
                    {item.produit.unite && ['ml', 'm2', 'kg', 'l', 'cm', 'm', 'g', 't'].includes(item.produit.unite) ? (
                      `${item.quantite_unitaire || 1} ${item.produit.unite.toUpperCase()}`
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="border border-gray-800 px-4 py-2 text-center font-medium">
                    {item.produit.unite && ['ml', 'm2', 'kg', 'l', 'cm', 'm', 'g', 't'].includes(item.produit.unite) ? (
                      `${item.quantite_livree} ${item.produit.unite.toUpperCase()}`
                    ) : (
                      `${item.quantite_livree} ${item.produit.unite ? item.produit.unite.toUpperCase() : 'Unité'}`
                    )}
                  </td>
                  {printWithPrices && (
                    <>
                      <td className="border border-gray-800 px-4 py-2 text-right">{formatPrice(item.prix_unitaire)}</td>
                      <td className="border border-gray-800 px-4 py-2 text-right font-medium">{formatPrice(item.total_ligne)}</td>
                    </>
                  )}
                </tr>
              ))}
              {printWithPrices && (
                <tr className="bg-gray-100">
                  <td className="border border-gray-800 px-4 py-3 font-bold" colSpan={4}>TOTAL</td>
                  <td className="border border-gray-800 px-4 py-3 text-right font-bold text-lg" colSpan={2}>
                    {formatPrice(deliveryItems.reduce((sum, item) => sum + item.total_ligne, 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {formData.notes && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
            <div className="border border-gray-300 p-4 rounded">
              <p className="text-gray-900">{formData.notes}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="absolute bottom-8 left-8 right-8 text-center text-xs text-gray-500 border-t border-gray-300 pt-4">
          <p>ANTURGOOD - Système de gestion wget.ma | Document généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          @page {
            margin: 15px;
            size: A4 portrait;
          }
          
          /* Hide everything by default */
          body * {
            visibility: hidden;
          }
          
          /* Show only the print content */
          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }
          
          /* Reset layout for print content */
          .print\\:block {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            font-size: 12pt !important;
            line-height: 1.4 !important;
          }
          
          /* Table styling for print */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          
          th, td {
            border: 1px solid #000 !important;
            padding: 8px !important;
          }
          
          /* Ensure proper page breaks */
          .print\\:block {
            page-break-inside: avoid;
          }
          
          /* Hide any remaining UI elements */
          nav, aside, button, .print\\:hidden {
            display: none !important;
            padding: 15px !important;
          }
          }
        }
      `}</style>
    </div>
  );
};

export default DeliveryNoteEdit;	