import React, { useState } from 'react';
import { ArrowLeft, Save, Plus, Search, Building2, Truck, FileText, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PurchaseOrder {
  id: string;
  numero_commande: string;
  date_commande: string;
  statut: string;
  total_ht: number;
  fournisseur: {
    societe: string;
  };
}

interface Client {
  id: string;
  numero_client: string;
  nom: string;
  prenom: string;
  societe: string;
}

interface Chauffeur {
  id: string;
  numero_chauffeur: string;
  nom: string;
  prenom: string;
  immatricule: string;
}

interface OrderItem {
  id: string;
  produit_id: string;
  nom_produit: string;
  quantite_pieces: number;
  quantite_unitaire: number;
  quantite_totale: number;
  prix_unitaire: number;
  total: number;
  unite: string;
}

interface DeliveryNoteAddProps {
  onNavigateBack: () => void;
  preSelectedPurchaseOrder?: PurchaseOrder | null;
}

const DeliveryNoteAdd: React.FC<DeliveryNoteAddProps> = ({ onNavigateBack, preSelectedPurchaseOrder }) => {
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedChauffeur, setSelectedChauffeur] = useState<Chauffeur | null>(null);
  const [actualImmatricule, setActualImmatricule] = useState<string>('');
  
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showChauffeurModal, setShowChauffeurModal] = useState(false);
  
  const [purchaseOrderSearch, setPurchaseOrderSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [chauffeurSearch, setChauffeurSearch] = useState('');
  
  const [formData, setFormData] = useState({
    date_livraison: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextDeliveryNumber, setNextDeliveryNumber] = useState<string>('');

  // Generate next delivery number
  const generateDeliveryNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('bon_de_livraison')
        .select('numero_livraison')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = data[0].numero_livraison.replace('BL-', '');
        nextNumber = parseInt(lastNumber) + 1;
      }

      return `BL-${String(nextNumber).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating delivery number:', error);
      return `BL-0001`;
    }
  };

  // Load data on component mount
  React.useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        generateDeliveryNumber().then(setNextDeliveryNumber),
        fetchPurchaseOrders(),
        fetchClients(),
        fetchChauffeurs()
      ]);
      
      // If there's a pre-selected purchase order, use it
      if (preSelectedPurchaseOrder) {
        setSelectedPurchaseOrder(preSelectedPurchaseOrder);
        fetchOrderItems(preSelectedPurchaseOrder.id);
      }
    };
    loadData();
  }, [preSelectedPurchaseOrder]);

  const fetchPurchaseOrders = async () => {
    try {
      // First get all purchase order IDs that already have delivery notes
      const { data: existingDeliveries, error: deliveryError } = await supabase
        .from('bon_de_livraison')
        .select('bon_commande_id');

      if (deliveryError) throw deliveryError;

      const usedPurchaseOrderIds = (existingDeliveries || []).map(d => d.bon_commande_id);

      // Fetch purchase orders excluding those that already have delivery notes
      const { data, error } = await supabase
        .from('bon_de_commande')
        .select(`
          *,
          fournisseur:fournisseurs(societe)
        `)
        .neq('statut', 'annulee')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out purchase orders that already have delivery notes
      const availableOrders = (data || []).filter(order => 
        !usedPurchaseOrderIds.includes(order.id)
      );

      setPurchaseOrders(availableOrders);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('societe', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchChauffeurs = async () => {
    try {
      const { data, error } = await supabase
        .from('chauffeurs')
        .select('*')
        .order('nom', { ascending: true });

      if (error) throw error;
      setChauffeurs(data || []);
    } catch (error) {
      console.error('Error fetching chauffeurs:', error);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('bon_de_commande_items')
        .select(`
          *,
         produit:produits(nom_produit, unite, dimension_standard)
        `)
        .eq('commande_id', orderId);

      if (error) throw error;

      // Debug log to see the actual data structure
      console.log('BC Items data:', data);

      const items = (data || []).map(item => {
        console.log('Processing item:', item);
        console.log('Product data:', item.produit);
        
        return {
          id: item.id,
          produit_id: item.produit_id,
          nom_produit: item.produit.nom_produit,
          prix_unitaire: item.prix_unitaire,
          quantite_pieces: item.quantite_pieces,
          quantite_unitaire: item.quantite_unitaire,
          quantite_totale: item.quantite,
          total: item.prix_unitaire * item.quantite,
          unite: item.produit.unite
        };
      });

      console.log('Converted items:', items);
      setOrderItems(items);
    } catch (error) {
      console.error('Error fetching order items:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectPurchaseOrder = (order: PurchaseOrder) => {
    setSelectedPurchaseOrder(order);
    fetchOrderItems(order.id);
    setShowPurchaseOrderModal(false);
    setPurchaseOrderSearch('');
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setShowClientModal(false);
    setClientSearch('');
  };

  const handleSelectChauffeur = (chauffeur: Chauffeur) => {
    setSelectedChauffeur(chauffeur);
    setActualImmatricule(chauffeur.immatricule); // Set default to driver's vehicle
    setShowChauffeurModal(false);
    setChauffeurSearch('');
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.total, 0);
  };

  const filteredPurchaseOrders = purchaseOrders.filter(order =>
    order.numero_commande.toLowerCase().includes(purchaseOrderSearch.toLowerCase()) ||
    order.fournisseur.societe.toLowerCase().includes(purchaseOrderSearch.toLowerCase())
  );

  const filteredClients = clients.filter(client =>
    client.societe.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.nom.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.prenom.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filteredChauffeurs = chauffeurs.filter(chauffeur =>
    chauffeur.nom.toLowerCase().includes(chauffeurSearch.toLowerCase()) ||
    chauffeur.prenom.toLowerCase().includes(chauffeurSearch.toLowerCase()) ||
    chauffeur.numero_chauffeur.toLowerCase().includes(chauffeurSearch.toLowerCase())
  );

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedPurchaseOrder) {
      newErrors.purchaseOrder = 'Veuillez sélectionner un bon de commande';
    }

    if (!selectedClient) {
      newErrors.client = 'Veuillez sélectionner un client';
    }

    if (!selectedChauffeur) {
      newErrors.chauffeur = 'Veuillez sélectionner un chauffeur';
    }

    if (!actualImmatricule.trim()) {
      newErrors.immatricule = 'L\'immatricule du véhicule est requise';
    }

    if (!formData.date_livraison) {
      newErrors.date_livraison = 'La date de livraison est requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      // Create the delivery note
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('bon_de_livraison')
        .insert({
          numero_livraison: nextDeliveryNumber,
          bon_commande_id: selectedPurchaseOrder!.id,
          client_id: selectedClient!.id,
          chauffeur_id: selectedChauffeur!.id,
          immatricule_utilise: actualImmatricule,
          date_livraison: formData.date_livraison,
          notes: formData.notes,
         statut: 'livree',
          total_ht: calculateTotal()
        })
        .select()
        .single();

      if (deliveryError) throw deliveryError;

      // Create the delivery items
      const itemsToInsert = orderItems.map(item => ({
        livraison_id: deliveryData.id,
        produit_id: item.produit_id,
        quantite_commandee: item.quantite_totale,
        quantite_livree: item.quantite_totale, // Initially same as ordered
        prix_unitaire: item.prix_unitaire,
        quantite_pieces: item.quantite_pieces,
        quantite_unitaire: item.quantite_unitaire
        quantite_totale: item.quantite_pieces * item.quantite_unitaire,
        total: item.prix_unitaire * (item.quantite_pieces * item.quantite_unitaire),
      const { error: itemsError } = await supabase
        .from('bon_de_livraison_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update the purchase order status to 'livree' and assign client
      const { error: purchaseOrderError } = await supabase
        .from('bon_de_commande')
        .update({ 
          statut: 'livree',
          client_id: selectedClient!.id
        })
        .eq('id', selectedPurchaseOrder!.id);

      if (purchaseOrderError) {
        console.error('Error updating purchase order:', purchaseOrderError);
      } else {
        console.log('Purchase order updated to delivered status with client assignment');
      }

      console.log('Delivery note created successfully:', deliveryData);
      onNavigateBack();
    } catch (error: any) {
      console.error('Error creating delivery note:', error);
      setErrors({ general: 'Erreur lors de la création. Veuillez réessayer.' });
    } finally {
      setIsSubmitting(false);
    }
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-MA', {
      minimumFractionDigits: 2,
      useGrouping: false
    }).format(price) + ' DH';
  };

  if (!nextDeliveryNumber) {
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
          <h1 className="text-3xl font-bold text-gray-900">Créer un bon de livraison</h1>
          <p className="text-gray-600 mt-1">Numéro: {nextDeliveryNumber}</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Purchase Order Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Bon de commande source
              </h2>
              
              {selectedPurchaseOrder ? (
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{selectedPurchaseOrder.numero_commande}</p>
                    <p className="text-sm text-gray-600">
                      {selectedPurchaseOrder.fournisseur.societe} - {formatPrice(selectedPurchaseOrder.total_ht)}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPurchaseOrderModal(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowPurchaseOrderModal(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors duration-200 flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600"
                >
                  <Plus className="w-5 h-5" />
                  Sélectionner un bon de commande
                </button>
              )}
              
              {errors.purchaseOrder && (
                <p className="text-red-500 text-sm mt-2">{errors.purchaseOrder}</p>
              )}
            </div>

            {/* Client Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Client à livrer
              </h2>
              
              {selectedClient ? (
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{selectedClient.societe}</p>
                    <p className="text-sm text-gray-600">
                      {selectedClient.prenom} {selectedClient.nom} - {selectedClient.numero_client}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowClientModal(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowClientModal(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors duration-200 flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600"
                >
                  <Plus className="w-5 h-5" />
                  Sélectionner un client
                </button>
              )}
              
              {errors.client && (
                <p className="text-red-500 text-sm mt-2">{errors.client}</p>
              )}
            </div>

            {/* Chauffeur Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Chauffeur et véhicule
              </h2>
              
              {selectedChauffeur ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {selectedChauffeur.prenom} {selectedChauffeur.nom}
                      </p>
                      <p className="text-sm text-gray-600">{selectedChauffeur.numero_chauffeur}</p>
                    </div>
                    <button
                      onClick={() => setShowChauffeurModal(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Changer
                    </button>
                  </div>
                  
                  <div>
                    <label htmlFor="immatricule" className="block text-sm font-medium text-gray-700 mb-2">
                      Véhicule utilisé (Immatricule)
                    </label>
                    <input
                      type="text"
                      id="immatricule"
                      value={actualImmatricule}
                      onChange={(e) => setActualImmatricule(e.target.value)}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono ${
                        errors.immatricule ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Immatricule du véhicule"
                    />
                    {errors.immatricule && (
                      <p className="text-red-500 text-xs mt-1">{errors.immatricule}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Véhicule par défaut: {selectedChauffeur.immatricule}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowChauffeurModal(true)}
                  className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors duration-200 flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600"
                >
                  <Plus className="w-5 h-5" />
                  Sélectionner un chauffeur
                </button>
              )}
              
              {errors.chauffeur && (
                <p className="text-red-500 text-sm mt-2">{errors.chauffeur}</p>
              )}
            </div>

            {/* Products Section */}
            {orderItems.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Produits à livrer</h2>
                
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Total Prix</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orderItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.nom_produit}</td>
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
                          <td className="px-4 py-3 text-sm text-gray-900">{item.quantite_pieces}</td>
                          <td className="px-4 py-3">
                            {requiresDualInput(item.unite) ? (
                              <span className="text-sm font-medium text-blue-600">
                                {item.quantite_unitaire} {getUnitLabel(item.unite)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-blue-600">
                              {requiresDualInput(item.unite) ? (
                                `${item.quantite_totale} ${getUnitLabel(item.unite)}`
                              ) : (
                                `${item.quantite_pieces} ${getUnitLabel(item.unite)}`
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatPrice(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Delivery Info */}
          <div className="space-y-6">
            {/* Delivery Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations livraison</h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="date_livraison" className="block text-sm font-medium text-gray-700 mb-1">
                    Date de livraison
                  </label>
                  <input
                    type="date"
                    id="date_livraison"
                    name="date_livraison"
                    value={formData.date_livraison}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.date_livraison ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.date_livraison && (
                    <p className="text-red-500 text-xs mt-1">{errors.date_livraison}</p>
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
                    placeholder="Notes pour cette livraison..."
                  />
                </div>
              </div>
            </div>

            {/* Total */}
            {orderItems.length > 0 && (
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
            )}

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

      {/* Purchase Order Modal */}
      {showPurchaseOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Sélectionner un bon de commande</h3>
            </div>
            <div className="p-6">
              <div className="relative mb-4">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par numéro ou fournisseur..."
                  value={purchaseOrderSearch}
                  onChange={(e) => setPurchaseOrderSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {filteredPurchaseOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => handleSelectPurchaseOrder(order)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">{order.numero_commande}</div>
                          <div className="text-sm text-gray-600">{order.fournisseur.societe}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(order.date_commande).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">{formatPrice(order.total_ht)}</div>
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            order.statut === 'confirmee' ? 'bg-green-100 text-green-800' : 
                            order.statut === 'livree' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {order.statut === 'confirmee' ? 'Confirmée' : 
                             order.statut === 'livree' ? 'Livrée' : 
                             order.statut === 'envoyee' ? 'Envoyée' : 'Brouillon'}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredPurchaseOrders.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>Aucun bon de commande disponible</p>
                      <p className="text-sm mt-1">Tous les bons de commande ont déjà une livraison associée</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowPurchaseOrderModal(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Sélectionner un client</h3>
            </div>
            <div className="p-6">
              <div className="relative mb-4">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200"
                    >
                      <div className="font-medium text-gray-900">{client.societe}</div>
                      <div className="text-sm text-gray-600">
                        {client.prenom} {client.nom} - {client.numero_client}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowClientModal(false)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chauffeur Modal */}
      {showChauffeurModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Sélectionner un chauffeur</h3>
            </div>
            <div className="p-6">
              <div className="relative mb-4">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un chauffeur..."
                  value={chauffeurSearch}
                  onChange={(e) => setChauffeurSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {filteredChauffeurs.map((chauffeur) => (
                    <button
                      key={chauffeur.id}
                      onClick={() => handleSelectChauffeur(chauffeur)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors duration-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">
                            {chauffeur.prenom} {chauffeur.nom}
                          </div>
                          <div className="text-sm text-gray-600">{chauffeur.numero_chauffeur}</div>
                        </div>
                        <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {chauffeur.immatricule}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowChauffeurModal(false)}
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

export default DeliveryNoteAdd;