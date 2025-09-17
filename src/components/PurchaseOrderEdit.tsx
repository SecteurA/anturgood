import React, { useState } from 'react';
import { ArrowLeft, Save, Edit3, FileText, Plus, Trash2, Search, Package, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PurchaseOrder {
  id: string;
  numero_commande: string;
  date_commande: string;
  statut: string;
  total_ht: number;
  notes: string;
  fournisseur: {
    nom: string;
    prenom: string;
    societe: string;
    numero_fournisseur: string;
  };
}

interface OrderItem {
  id: string;
  produit_id: string;
  quantite_pieces: number;
  quantite_unitaire: number;
  quantite_totale: number;
  prix_unitaire: number;
  total_ligne: number;
  produit: {
    nom_produit: string;
    unite: string;
  };
}

interface Product {
  id: string;
  nom_produit: string;
  prix_achat: number;
  prix_vente: number;
  unite: string;
  dimension_standard: number;
}

interface PurchaseOrderEditProps {
  onNavigateBack: () => void;
  order: PurchaseOrder;
}

const PurchaseOrderEdit: React.FC<PurchaseOrderEditProps> = ({ onNavigateBack, order }) => {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [formData, setFormData] = useState({
    statut: order.statut,
    notes: order.notes || ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load order items and products on component mount
  React.useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchOrderItems(),
        fetchProducts()
      ]);
    };
    loadData();
  }, []);

  const fetchOrderItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('bon_de_commande_items')
        .select(`
          *,
          produit:produits(nom_produit, unite)
        `)
        .eq('commande_id', order.id)
        .order('id', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Convert database format to component format
      const convertedItems = (data || []).map(item => {
        // Calculate pieces and unit quantities properly based on product type
        const requiresDual = item.produit && ['ml', 'm2', 'kg', 'l', 'cm', 'm', 'g', 't'].includes(item.produit.unite);
        
        let pieces, unitQty, totalQty;
        
        if (requiresDual) {
          // For products with dual input (pieces × dimension)
          pieces = item.quantite_pieces || Math.max(1, Math.round(item.quantite / (item.quantite_unitaire || item.produit?.dimension_standard || 1)));
          unitQty = item.quantite_unitaire || item.produit?.dimension_standard || 1;
          totalQty = pieces * unitQty;
        } else {
          // For simple products (unite, pcs, box)
          pieces = item.quantite || 1;
          unitQty = 1;
          totalQty = pieces;
        }
        
        return {
          ...item,
          quantite_pieces: pieces,
          quantite_unitaire: unitQty,
          quantite_totale: totalQty
        };
      });
      
      setOrderItems(convertedItems);
    } catch (err: any) {
      console.error('Error fetching order items:', err);
      setError('Erreur lors du chargement des détails de la commande');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select('id, nom_produit, prix_achat, prix_vente, unite, dimension_standard')
        .order('nom_produit', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddProduct = (product: Product) => {
    const existingItem = orderItems.find(item => item.produit_id === product.id);
    
    if (existingItem) {
      // Increase quantity if product already exists
      handlePiecesQuantityChange(existingItem.id, existingItem.quantite_pieces + 1);
    } else {
      // Add new item with temporary ID
      const newItem: OrderItem = {
        id: `temp-${Date.now()}`,
        produit_id: product.id,
        quantite_pieces: 1,
        quantite_unitaire: product.dimension_standard,
        quantite_totale: 1 * product.dimension_standard,
        prix_unitaire: product.prix_achat, 
        total_ligne: product.prix_achat * (1 * product.dimension_standard),
        produit: {
          nom_produit: product.nom_produit,
          unite: product.unite
        }
      };
      setOrderItems(prev => [...prev, newItem]);
    }
    
    setProductSearch('');
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }

    setOrderItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              quantite_pieces: newQuantity,
              quantite_totale: newQuantity * item.quantite_unitaire,
              total_ligne: item.prix_unitaire * (newQuantity * item.quantite_unitaire)
            }
          : item
      )
    );
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
              total_ligne: item.prix_unitaire * (newQuantityPieces * item.quantite_unitaire)
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
              total_ligne: item.prix_unitaire * (item.quantite_pieces * newQuantityUnit)
            }
          : item
      )
    );
  };

  const handlePriceChange = (itemId: string, newPrice: number) => {
    setOrderItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, prix_unitaire: newPrice, total_ligne: newPrice * item.quantite_totale }
          : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.total_ligne, 0);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);

    try {
      const newTotal = calculateTotal();

      // Update purchase order
      const { data, error } = await supabase
        .from('bon_de_commande')
        .update({
          statut: formData.statut,
          notes: formData.notes.trim() || null,
          total_ht: newTotal
        })
        .eq('id', order.id)
        .select();

      if (error) {
        throw error;
      }

      // Delete existing items and recreate them (simpler than handling inserts/updates/deletes)
      const { error: deleteError } = await supabase
        .from('bon_de_commande_items')
        .delete()
        .eq('commande_id', order.id);

      if (deleteError) {
        throw deleteError;
      }

      // Insert all current items
      if (orderItems.length > 0) {
        const itemsToInsert = orderItems.map(item => ({
          commande_id: order.id,
          produit_id: item.produit_id,
          quantite: item.quantite_totale, // Store total calculated quantity
          quantite_pieces: item.quantite_pieces, // Store number of pieces
          quantite_unitaire: item.quantite_unitaire, // Store dimension per piece
          prix_unitaire: item.prix_unitaire
        }));

        const { error: insertError } = await supabase
          .from('bon_de_commande_items')
          .insert(itemsToInsert);

        if (insertError) {
          throw insertError;
        }
      }

      console.log('Purchase order updated successfully:', data);
      onNavigateBack();
    } catch (error: any) {
      console.error('Error updating purchase order:', error);
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
      brouillon: 'bg-gray-100 text-gray-800',
      envoyee: 'bg-blue-100 text-blue-800',
      confirmee: 'bg-green-100 text-green-800',
      livree: 'bg-purple-100 text-purple-800',
      annulee: 'bg-red-100 text-red-800'
    };

    const statusLabel = {
      brouillon: 'Brouillon',
      envoyee: 'Envoyée',
      confirmee: 'Confirmée',
      livree: 'Livrée',
      annulee: 'Annulée'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusConfig[status as keyof typeof statusConfig] || statusConfig.brouillon
      }`}>
        {statusLabel[status as keyof typeof statusLabel] || status}
      </span>
    );
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
            <h1 className="text-3xl font-bold text-gray-900">{order.numero_commande}</h1>
            {getStatusBadge(order.statut)}
          </div>
          <p className="text-gray-600 mt-1">
            Bon de commande du {new Date(order.date_commande).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200 print:hidden"
        >
          <Printer className="w-4 h-4" />
          Imprimer
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supplier Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Fournisseur
              </h2>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="font-medium text-gray-900">{order.fournisseur.societe}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {order.fournisseur.prenom} {order.fournisseur.nom}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {order.fournisseur.numero_fournisseur}
                </div>
              </div>
            </div>

            {/* Order Items - Now Editable */}
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Prix unitaire</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Quantité</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Dimension</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orderItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {item.produit.nom_produit}
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
                            {/* Number of pieces */}
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantite_pieces}
                              onChange={(e) => handlePiecesQuantityChange(item.id, Number(e.target.value))}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            {/* Unit quantity per piece (only for measurement units) */}
                            {requiresDualInput(item.produit.unite) ? (
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
                                  {getUnitLabel(item.produit.unite)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {/* Total calculated units */}
                            <div className="text-sm font-medium text-blue-600">
                              {requiresDualInput(item.produit.unite) ? (
                                `${item.quantite_totale} ${getUnitLabel(item.produit.unite)}`
                              ) : (
                                `${item.quantite_pieces} ${getUnitLabel(item.produit.unite)}`
                              )}
                            </div>
                          </td>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Aucun article dans cette commande</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Edit Form */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                Modifier la commande
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
                    <option value="brouillon">Brouillon</option>
                    <option value="envoyee">Envoyée</option>
                    <option value="confirmee">Confirmée</option>
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
                    placeholder="Notes pour cette commande..."
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

            {/* Order Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Récapitulatif</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Date de commande:</span>
                  <span className="font-medium">{new Date(order.date_commande).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Nombre d'articles:</span>
                  <span className="font-medium">{orderItems.reduce((sum, item) => sum + item.quantite_pieces, 0)}</span>
                </div>
                <div className="flex justify-between py-2 border-t border-gray-200 text-lg font-semibold">
                  <span>Total:</span>
                  <span>{formatPrice(calculateTotal())}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
    <p className="text-lg text-gray-900 font-bold">BON DECOMMANDE</p>
  </div>

  {/* Right: empty for balance */}
  <div></div>
</div>

        {/* Order Info and Supplier Info */}
        <div className="mb-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations Commande</h3>
              <div className="space-y-2">
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32">N° BC:</span>
                  <span className="text-gray-900">{order.numero_commande}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32">Date:</span>
                  <span className="text-gray-900">{new Date(order.date_commande).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32">Statut:</span>
                  <span className="text-gray-900">
                    {order.statut === 'brouillon' ? 'Brouillon' :
                     order.statut === 'envoyee' ? 'Envoyée' :
                     order.statut === 'confirmee' ? 'Confirmée' :
                     order.statut === 'livree' ? 'Livrée' :
                     order.statut === 'annulee' ? 'Annulée' : order.statut}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Fournisseur</h3>
              <div className="space-y-2">
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32">Société:</span>
                  <span className="text-gray-900">{order.fournisseur.societe}</span>
                </div>
                <div className="flex">
                  <span className="font-medium text-gray-700 w-32">Contact:</span>
                  <span className="text-gray-900">{order.fournisseur.prenom} {order.fournisseur.nom}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Articles Commandés</h3>
          <table className="w-full border-collapse border border-gray-800">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-800 px-4 py-2 text-left font-semibold">Produit</th>
                <th className="border border-gray-800 px-4 py-2 text-center font-semibold">Nb Pièces</th>
                <th className="border border-gray-800 px-4 py-2 text-center font-semibold">Dimension</th>
                <th className="border border-gray-800 px-4 py-2 text-center font-semibold">Quantité Totale</th>
                <th className="border border-gray-800 px-4 py-2 text-right font-semibold">Prix Unitaire</th>
                <th className="border border-gray-800 px-4 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item) => (
                <tr key={item.id}>
                  <td className="border border-gray-800 px-4 py-2">{item.produit.nom_produit}</td>
                  <td className="border border-gray-800 px-4 py-2 text-center">{item.quantite_pieces}</td>
                  <td className="border border-gray-800 px-4 py-2 text-center">
                    {requiresDualInput(item.produit.unite) ? (
                      `${item.quantite_unitaire} ${getUnitLabel(item.produit.unite)}`
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="border border-gray-800 px-4 py-2 text-center font-medium">
                    {requiresDualInput(item.produit.unite) ? (
                      `${item.quantite_totale} ${getUnitLabel(item.produit.unite)}`
                    ) : (
                      `${item.quantite_pieces} ${getUnitLabel(item.produit.unite)}`
                    )}
                  </td>
                  <td className="border border-gray-800 px-4 py-2 text-right">{formatPrice(item.prix_unitaire)}</td>
                  <td className="border border-gray-800 px-4 py-2 text-right font-medium">{formatPrice(item.total_ligne)}</td>
                </tr>
              ))}
              <tr className="bg-gray-100">
                <td className="border border-gray-800 px-4 py-3 font-bold" colSpan={5}>TOTAL</td>
                <td className="border border-gray-800 px-4 py-3 text-right font-bold text-lg">
                  {formatPrice(calculateTotal())}
                </td>
              </tr>
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
      `}</style>
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
                          <div className="font-medium text-gray-900">{product.nom_produit}</div>
                          <div className="text-sm text-gray-600">Prix d'achat: {formatPrice(product.prix_achat)}</div>
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

export default PurchaseOrderEdit;