import React, { useState } from 'react';
import { ArrowLeft, Save, Plus, Trash2, Search, Building2, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Fournisseur {
  id: string;
  numero_fournisseur: string;
  nom: string;
  prenom: string;
  societe: string;
}

interface Product {
  id: string;
  nom_produit: string;
  prix_achat: number;
  prix_vente: number;
  unite: string;
  dimension_standard: number;
}

interface OrderItem {
  id: string;
  produit_id: string;
  nom_produit: string;
  prix_unitaire: number;
  quantite_pieces: number;
  quantite_unitaire: number;
  quantite_totale: number;
  total: number;
  unite: string;
}

interface PurchaseOrderAddProps {
  onNavigateBack: () => void;
}

const PurchaseOrderAdd: React.FC<PurchaseOrderAddProps> = ({ onNavigateBack }) => {
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  const [showFournisseurModal, setShowFournisseurModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [fournisseurSearch, setFournisseurSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  
  const [formData, setFormData] = useState({
    date_commande: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextOrderNumber, setNextOrderNumber] = useState<string>('');

  // Generate next order number
  const generateOrderNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('bon_de_commande')
        .select('numero_commande')
        ;

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        // Extract all numeric parts and find the maximum
        const numbers = data
          .map(item => parseInt(item.numero_commande.replace('BC-', '')))
          .filter(num => !isNaN(num));
        
        if (numbers.length > 0) {
          nextNumber = Math.max(...numbers) + 1;
        }
      }

      return `BC-${String(nextNumber).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating order number:', error);
      return `BC-0001`;
    }
  };

  // Load data on component mount
  React.useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        generateOrderNumber().then(setNextOrderNumber),
        fetchFournisseurs(),
        fetchProducts()
      ]);
    };
    loadData();
  }, []);

  const fetchFournisseurs = async () => {
    try {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('*')
        .order('societe', { ascending: true });

      if (error) throw error;
      setFournisseurs(data || []);
    } catch (error) {
      console.error('Error fetching fournisseurs:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select('*, dimension_standard')
        .order('nom_produit', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectFournisseur = (fournisseur: Fournisseur) => {
    setSelectedFournisseur(fournisseur);
    setShowFournisseurModal(false);
    setFournisseurSearch('');
  };

  const handleAddProduct = (product: Product) => {
    const existingItem = orderItems.find(item => item.produit_id === product.id);
    
    if (existingItem) {
      // Increase quantity if product already exists
      handlePiecesQuantityChange(existingItem.id, existingItem.quantite_pieces + 1);
    } else {
      // Add new item
      const newItem: OrderItem = {
        id: `temp-${Date.now()}`,
        produit_id: product.id,
        nom_produit: product.nom_produit,
        prix_unitaire: product.prix_vente,
        quantite_pieces: 1,
        quantite_unitaire: product.dimension_standard,
        quantite_totale: 1 * product.dimension_standard,
        total: product.prix_vente * (1 * product.dimension_standard),
        unite: product.unite
      };
      setOrderItems(prev => [...prev, newItem]);
    }
    
    setShowProductModal(false);
    setProductSearch('');
  };

  const handlePiecesQuantityChange = (itemId: string, newQuantityPieces: number) => {
    if (newQuantityPieces <= 0) {
      handleRemoveItem(itemId);
      return;
    }

    setOrderItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              quantite_pieces: newQuantityPieces,
              quantite_totale: newQuantityPieces * item.quantite_unitaire,
              total: item.prix_unitaire * (newQuantityPieces * item.quantite_unitaire)
            }
          : item
      )
    );
  };

  const handleUnitQuantityChange = (itemId: string, newQuantityUnit: number) => {
    if (newQuantityUnit <= 0) {
      return;
    }

    setOrderItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              quantite_unitaire: newQuantityUnit,
              quantite_totale: item.quantite_pieces * newQuantityUnit,
              total: item.prix_unitaire * (item.quantite_pieces * newQuantityUnit)
            }
          : item
      )
    );
  };

  const handlePriceChange = (itemId: string, newPrice: number) => {
    setOrderItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, prix_unitaire: newPrice, total: newPrice * item.quantite_totale }
          : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.total, 0);
  };

  const filteredFournisseurs = fournisseurs.filter(f =>
    f.societe.toLowerCase().includes(fournisseurSearch.toLowerCase()) ||
    f.nom.toLowerCase().includes(fournisseurSearch.toLowerCase()) ||
    f.prenom.toLowerCase().includes(fournisseurSearch.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.nom_produit.toLowerCase().includes(productSearch.toLowerCase())
  );

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

  const getPiecesLabel = (unite: string) => {
    const piecesLabels = {
      unite: 'Quantité',
      ml: 'Nb Pièces',
      m2: 'Nb Pièces',
      kg: 'Nb Pièces',
      l: 'Nb Pièces',
      pcs: 'Nombre de pièces',
      box: 'Nombre de boîtes',
      cm: 'Nb Pièces',
      m: 'Nb Pièces',
      g: 'Nb Pièces',
      t: 'Nb Pièces'
    };
    return piecesLabels[unite as keyof typeof piecesLabels] || 'Quantité';
  };

  const getUnitQuantityLabel = (unite: string) => {
    const unitQuantityLabels = {
      unite: '',
      ml: 'ML par pièce',
      m2: 'M² par pièce', 
      kg: 'KG par pièce',
      l: 'L par pièce',
      pcs: '',
      box: '',
      cm: 'CM par pièce',
      m: 'M par pièce',
      g: 'G par pièce',
      t: 'T par pièce'
    };
    return unitQuantityLabels[unite as keyof typeof unitQuantityLabels] || '';
  };

  const requiresDualInput = (unite: string) => {
    return ['ml', 'm2', 'kg', 'l', 'cm', 'm', 'g', 't'].includes(unite);
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedFournisseur) {
      newErrors.fournisseur = 'Veuillez sélectionner un fournisseur';
    }

    if (orderItems.length === 0) {
      newErrors.items = 'Veuillez ajouter au moins un produit';
    }

    if (!formData.date_commande) {
      newErrors.date_commande = 'La date de commande est requise';
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
    setErrors({}); // Clear previous errors

    try {
      // Create the purchase order
      const { data: orderData, error: orderError } = await supabase
        .from('bon_de_commande')
        .insert([
          {
            numero_commande: nextOrderNumber,
            fournisseur_id: selectedFournisseur!.id,
            date_commande: formData.date_commande,
            total_ht: calculateTotal(),
            notes: formData.notes.trim() || null,
            statut: 'confirmee'
          }
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create the order items
      const itemsToInsert = orderItems.map(item => ({
        commande_id: orderData.id,
        produit_id: item.produit_id,
        quantite: item.quantite_totale, // Store the total calculated quantity
        quantite_pieces: item.quantite_pieces, // Store number of pieces
        quantite_unitaire: item.quantite_unitaire, // Store dimension per piece
        prix_unitaire: item.prix_unitaire
      }));

      const { error: itemsError } = await supabase
        .from('bon_de_commande_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      console.log('Purchase order created successfully:', orderData);
      onNavigateBack();
    } catch (error: any) {
      console.error('Error creating purchase order:', error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        // Unique constraint violation
        if (error.details?.includes('numero_commande')) {
          setErrors({ general: `Le numéro de commande ${nextOrderNumber} existe déjà. Rechargez la page et réessayez.` });
        } else {
          setErrors({ general: 'Une commande avec ces informations existe déjà.' });
        }
      } else if (error.code === '23503') {
        // Foreign key constraint violation
        setErrors({ general: 'Erreur de référence: le fournisseur ou un produit sélectionné n\'existe plus.' });
      } else if (error.code === '23514') {
        // Check constraint violation
        setErrors({ general: 'Erreur de validation: statut de commande invalide ou données incorrectes.' });
      } else if (error.message) {
        // Show the actual error message from the database
        setErrors({ general: `Erreur: ${error.message}` });
      } else {
        setErrors({ general: 'Erreur lors de la création. Veuillez réessayer.' });
      }
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

  if (!nextOrderNumber) {
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
          <h1 className="text-3xl font-bold text-gray-900">Créer un bon de commande</h1>
          <p className="text-gray-600 mt-1">Numéro: {nextOrderNumber}</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supplier Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Fournisseur
              </h2>
              
              {selectedFournisseur ? (
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{selectedFournisseur.societe}</p>
                    <p className="text-sm text-gray-600">
                      {selectedFournisseur.prenom} {selectedFournisseur.nom} - {selectedFournisseur.numero_fournisseur}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFournisseurModal(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowFournisseurModal(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors duration-200 flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600"
                >
                  <Plus className="w-5 h-5" />
                  Sélectionner un fournisseur
                </button>
              )}
              
              {errors.fournisseur && (
                <p className="text-red-500 text-sm mt-2">{errors.fournisseur}</p>
              )}
            </div>

            {/* Products Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Produits
                </h2>
                <button
                  onClick={() => setShowProductModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors duration-200"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter produit
                </button>
              </div>

              {orderItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Produit</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Unité</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Prix unitaire</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Quantité</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Dimension</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Quantité Totale</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orderItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {item.nom_produit}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getUnitBadge(item.unite)}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.prix_unitaire}
                              onChange={(e) => handlePriceChange(item.id, Number(e.target.value))}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {/* Quantity - Number of pieces */}
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantite_pieces}
                              onChange={(e) => handlePiecesQuantityChange(item.id, Number(e.target.value))}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {/* Unit quantity per piece (only for measurement units) */}
                            {requiresDualInput(item.unite) ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.quantite_unitaire}
                                  onChange={(e) => handleUnitQuantityChange(item.id, Number(e.target.value))}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <span className="text-xs text-gray-500">
                                  {getUnitLabel(item.unite)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {/* Total calculated units */}
                            <div className="text-sm font-medium text-blue-600">
                              {requiresDualInput(item.unite) ? (
                                `${item.quantite_totale} ${getUnitLabel(item.unite)}`
                              ) : (
                                `${item.quantite_pieces} ${getUnitLabel(item.unite)}`
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {formatPrice(item.total)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Aucun produit ajouté</p>
                </div>
              )}

              {errors.items && (
                <p className="text-red-500 text-sm mt-2">{errors.items}</p>
              )}
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="space-y-6">
            {/* Order Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="date_commande" className="block text-sm font-medium text-gray-700 mb-1">
                    Date de commande
                  </label>
                  <input
                    type="date"
                    id="date_commande"
                    name="date_commande"
                    value={formData.date_commande}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.date_commande ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.date_commande && (
                    <p className="text-red-500 text-xs mt-1">{errors.date_commande}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optionnel)
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Notes pour ce bon de commande..."
                  />
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Récapitulatif</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Nombre d'articles:</span>
                  <span className="font-medium">{orderItems.reduce((sum, item) => sum + item.quantite_pieces, 0)}</span>
                </div>
                <div className="flex justify-between py-2 text-lg font-semibold">
                  <span>Total:</span>
                  <span>{formatPrice(calculateTotal())}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onNavigateBack}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors duration-200"
              >
                <Save className="w-4 h-4" />
                {isSubmitting ? 'Création...' : 'Créer'}
              </button>
            </div>

            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-sm">{errors.general}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supplier Modal */}
      {showFournisseurModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Sélectionner un fournisseur</h3>
            </div>
            <div className="p-6">
              <div className="relative mb-4">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un fournisseur..."
                  value={fournisseurSearch}
                  onChange={(e) => setFournisseurSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {filteredFournisseurs.map((fournisseur) => (
                    <button
                      key={fournisseur.id}
                      onClick={() => handleSelectFournisseur(fournisseur)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200"
                    >
                      <div className="font-medium text-gray-900">{fournisseur.societe}</div>
                      <div className="text-sm text-gray-600">
                        {fournisseur.prenom} {fournisseur.nom} - {fournisseur.numero_fournisseur}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowFournisseurModal(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Ajouter un produit</h3>
            </div>
            <div className="p-6">
              <div className="relative mb-4">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleAddProduct(product)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            {product.nom_produit}
                            {getUnitBadge(product.unite)}
                          </div>
                          <div className="text-sm text-gray-600">Prix de vente: {formatPrice(product.prix_vente)}</div>
                          {requiresDualInput(product.unite) ? (
                            <div className="text-xs text-gray-500 mt-1">
                              Dimension standard: {product.dimension_standard} {getUnitLabel(product.unite)}/pièce
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 mt-1">
                              Prix de vente par {getUnitLabel(product.unite)}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowProductModal(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderAdd;