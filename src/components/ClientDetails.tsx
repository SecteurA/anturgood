import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Truck, ShoppingBag, TrendingUp, Calendar, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Client {
  id: string;
  numero_client: string;
  nom: string;
  prenom: string;
  societe: string;
  ice: string;
  email: string;
  telephone: string;
  credit_initial: number;
  chiffre_affaires: number;
  total_paiements: number;
  current_debt: number;
  available_credit: number;
  created_at: string;
  total_margin: number;
}

interface DeliveryNote {
  id: string;
  numero_livraison: string;
  date_livraison: string;
  statut: string;
  notes: string | null;
  client: {
    nom: string;
    prenom: string;
    societe: string;
  };
  chauffeur: {
    nom: string;
    prenom: string;
  };
  bon_commande: {
    numero_commande: string;
  };
  items: DeliveryItem[];
}

interface DeliveryItem {
  id: string;
  quantite_livree: number;
  prix_unitaire: number;
  total_ligne: number;
  produit: {
    nom_produit: string;
  };
}

interface ClientStats {
  deliveredCount: number;
  pendingCount: number;
}

interface Payment {
  id: string;
  montant: number;
  mode_paiement: string;
  reference: string | null;
  issuer: string | null;
  date_paiement: string;
  notes: string | null;
}

interface ClientDetailsProps {
  client: Client;
  onNavigateBack: () => void;
  onNavigateToDelivery: (note: DeliveryNote) => void;
}

const ClientDetails: React.FC<ClientDetailsProps> = ({ client: initialClient, onNavigateBack, onNavigateToDelivery }) => {
  const [client, setClient] = useState<Client>(initialClient);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Pagination states
  const [deliveriesCurrentPage, setDeliveriesCurrentPage] = useState(1);
  const [paymentsCurrentPage, setPaymentsCurrentPage] = useState(1);
  const deliveriesPerPage = 10;
  const paymentsPerPage = 10;
  
  // Filter states
  const [dateFilters, setDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });
  
  const [paymentForm, setPaymentForm] = useState({
    montant: '',
    mode_paiement: 'cash',
    reference: '',
    issuer: '',
    date_paiement: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  useEffect(() => {
    fetchClientData();
  }, [client.id]);

  // Update client when prop changes
  useEffect(() => {
    setClient(initialClient);
  }, [initialClient]);

  const fetchUpdatedClientData = async () => {
    try {
      const { data: updatedClient, error } = await supabase
        .from('clients')
        .select(`
          id,
          numero_client,
          nom,
          prenom,
          societe,
          ice,
          email,
          telephone,
          credit_initial,
          chiffre_affaires,
          total_paiements,
          current_debt,
          available_credit,
          total_margin,
          created_at
        `)
        .eq('id', client.id)
        .single();

      if (error) {
        throw error;
      }

      setClient(updatedClient);
    } catch (error) {
      console.error('Error fetching updated client data:', error);
    }
  };

  const fetchClientData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch delivery notes for this client
      const { data: deliveries, error: deliveryError } = await supabase
        .from('bon_de_livraison')
        .select(`
          *,
          client:clients(nom, prenom, societe),
          chauffeur:chauffeurs(nom, prenom),
          bon_commande:bon_de_commande(numero_commande, total_ht),
          items:bon_de_livraison_items(
            id,
            quantite_livree,
            prix_unitaire,
            total_ligne,
            produit:produits(nom_produit, prix_achat, prix_vente)
          )
        `)
        .eq('client_id', client.id)
        .neq('statut', 'annulee') // Exclude cancelled delivery notes
        .order('date_livraison', { ascending: false });

      if (deliveryError) {
        throw deliveryError;
      }

      setDeliveryNotes(deliveries || []);

      // Fetch payments for this client
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('paiements_clients')
        .select('*')
        .eq('client_id', client.id)
        .order('date_paiement', { ascending: false });

      if (paymentsError) {
        throw paymentsError;
      }

      setPayments(paymentsData || []);

      // Calculate statistics
      const deliveriesData = deliveries || [];
      
      const deliveredCount = deliveriesData.filter(d => d.statut === 'livree').length;
      const pendingCount = deliveriesData.filter(d => d.statut !== 'livree' && d.statut !== 'annulee').length;
      
      setStats({
        deliveredCount,
        pendingCount
      });

    } catch (err: any) {
      console.error('Error fetching client data:', err);
      setError('Erreur lors du chargement des données client');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPaymentForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentForm.montant || Number(paymentForm.montant) <= 0) {
      setError('Le montant doit être supérieur à 0');
      return;
    }

    setIsSubmittingPayment(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('paiements_clients')
        .insert([
          {
            client_id: client.id,
            montant: Number(paymentForm.montant),
            mode_paiement: paymentForm.mode_paiement,
            reference: paymentForm.reference.trim() || null,
            issuer: paymentForm.issuer.trim() || null,
            date_paiement: paymentForm.date_paiement,
            notes: paymentForm.notes.trim() || null
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      console.log('Payment added successfully:', data);
      
      // Reset form
      setPaymentForm({
        montant: '',
        mode_paiement: 'cash',
        reference: '',
        issuer: '',
        date_paiement: new Date().toISOString().split('T')[0],
        notes: ''
      });
      
      setShowPaymentModal(false);
      
      // Reset pagination to page 1 when new data is added
      setPaymentsCurrentPage(1);
      
      // Refresh data
      await fetchUpdatedClientData();
      await fetchClientData();
      
    } catch (error: any) {
      console.error('Error adding payment:', error);
      setError('Erreur lors de l\'ajout du paiement. Veuillez réessayer.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleDateFilterChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    setDateFilters(prev => ({
      ...prev,
      [field]: value
    }));
    // Reset pagination when filters change
    setDeliveriesCurrentPage(1);
    setPaymentsCurrentPage(1);
  };

  const clearDateFilters = () => {
    setDateFilters({
      dateFrom: '',
      dateTo: ''
    });
    setDeliveriesCurrentPage(1);
    setPaymentsCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return dateFilters.dateFrom || dateFilters.dateTo;
  };

  // Filter functions
  const filterByDateRange = (date: string) => {
    if (!dateFilters.dateFrom && !dateFilters.dateTo) return true;
    
    const itemDate = date; // Already in YYYY-MM-DD format
    const fromMatch = !dateFilters.dateFrom || itemDate >= dateFilters.dateFrom;
    const toMatch = !dateFilters.dateTo || itemDate <= dateFilters.dateTo;
    
    return fromMatch && toMatch;
  };

  // Pagination functions for deliveries
  const handleDeliveriesPageChange = (page: number) => {
    setDeliveriesCurrentPage(page);
  };

  const handleDeliveriesPrevPage = () => {
    if (deliveriesCurrentPage > 1) {
      setDeliveriesCurrentPage(deliveriesCurrentPage - 1);
    }
  };

  const handleDeliveriesNextPage = () => {
    const deliveriesTotalPages = Math.ceil(deliveryNotes.length / deliveriesPerPage);
    if (deliveriesCurrentPage < deliveriesTotalPages) {
      setDeliveriesCurrentPage(deliveriesCurrentPage + 1);
    }
  };

  // Pagination functions for payments
  const handlePaymentsPageChange = (page: number) => {
    setPaymentsCurrentPage(page);
  };

  const handlePaymentsPrevPage = () => {
    if (paymentsCurrentPage > 1) {
      setPaymentsCurrentPage(paymentsCurrentPage - 1);
    }
  };

  const handlePaymentsNextPage = () => {
    const paymentsTotalPages = Math.ceil(payments.length / paymentsPerPage);
    if (paymentsCurrentPage < paymentsTotalPages) {
      setPaymentsCurrentPage(paymentsCurrentPage + 1);
    }
  };

  // Filter data
  const filteredDeliveryNotes = deliveryNotes.filter(note => 
    filterByDateRange(note.date_livraison)
  );

  const filteredPayments = payments.filter(payment => 
    filterByDateRange(payment.date_paiement)
  );

  // Calculate pagination for deliveries
  const deliveriesTotalPages = Math.ceil(filteredDeliveryNotes.length / deliveriesPerPage);
  const deliveriesStartIndex = (deliveriesCurrentPage - 1) * deliveriesPerPage;
  const deliveriesEndIndex = deliveriesStartIndex + deliveriesPerPage;
  const currentDeliveryNotes = filteredDeliveryNotes.slice(deliveriesStartIndex, deliveriesEndIndex);

  // Calculate pagination for payments
  const paymentsTotalPages = Math.ceil(filteredPayments.length / paymentsPerPage);
  const paymentsStartIndex = (paymentsCurrentPage - 1) * paymentsPerPage;
  const paymentsEndIndex = paymentsStartIndex + paymentsPerPage;
  const currentPayments = filteredPayments.slice(paymentsStartIndex, paymentsEndIndex);

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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Chargement des données client...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchClientData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onNavigateBack}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{client.societe}</h1>
              <p className="text-gray-600">{client.prenom} {client.nom} - {client.numero_client}</p>
            </div>
          </div>
          
          {/* Client Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Contact</span>
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900">{client.email}</p>
                <p className="text-sm text-gray-600">{client.telephone}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">ICE</span>
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900 font-mono">{client.ice}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Client depuis</span>
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900">
                  {new Date(client.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(client.chiffre_affaires)}</p>
                <p className="text-xs text-gray-500">Hors annulées</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Crédit</p>
                <p className={`text-2xl font-bold ${client.current_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatPrice(client.current_debt)}
                </p>
                <p className="text-xs text-gray-500">Dû par le client</p>
              </div>
              <div className="flex flex-col items-center">
                <ShoppingBag className={`w-8 h-8 ${client.current_debt > 0 ? 'text-red-600' : 'text-green-600'}`} />
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors duration-200"
                >
                  + Paiement
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Marge</p>
                <p className={`text-2xl font-bold ${client.total_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPrice(client.total_margin)}
                </p>
                <p className="text-xs text-gray-500">Sur livraisons terminées</p>
              </div>
              <TrendingUp className={`w-8 h-8 ${client.total_margin >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
        </div>
      )}

      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="font-medium text-blue-800">Total Paiements</span>
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-1">{formatPrice(client.total_paiements)}</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="font-medium text-green-800">Avance à consommer</span>
          </div>
          <p className="text-2xl font-bold text-green-900 mt-1">
            {formatPrice(client.available_credit)}
          </p>
        </div>
      </div>

      {/* Status Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="font-medium text-green-800">Livraisons Terminées</span>
            </div>
            <p className="text-2xl font-bold text-green-900 mt-1">{stats.deliveredCount}</p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="font-medium text-blue-800">Livraisons En Cours</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 mt-1">{stats.pendingCount}</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filtrer par période</h3>
          {hasActiveFilters() && (
            <button
              onClick={clearDateFilters}
              className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1 transition-colors duration-200"
            >
              Effacer les filtres
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-1">
              Date début
            </label>
            <input
              type="date"
              id="date-from"
              value={dateFilters.dateFrom}
              onChange={(e) => handleDateFilterChange('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-1">
              Date fin
            </label>
            <input
              type="date"
              id="date-to"
              value={dateFilters.dateTo}
              onChange={(e) => handleDateFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={clearDateFilters}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Effacer les filtres
            </button>
          </div>
        </div>
        
        {hasActiveFilters() && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800">
                <strong>{filteredDeliveryNotes.length}</strong> livraison(s) et <strong>{filteredPayments.length}</strong> paiement(s) trouvé(s)
                {dateFilters.dateFrom && dateFilters.dateTo && ` du ${new Date(dateFilters.dateFrom).toLocaleDateString('fr-FR')} au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`}
                {dateFilters.dateFrom && !dateFilters.dateTo && ` à partir du ${new Date(dateFilters.dateFrom).toLocaleDateString('fr-FR')}`}
                {!dateFilters.dateFrom && dateFilters.dateTo && ` jusqu'au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`}
              </p>
              <p className="text-sm font-medium text-blue-900">
                CA filtré: {formatPrice(filteredDeliveryNotes.reduce((sum, note) => sum + (note.total_ht || 0), 0))}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Notes Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Historique des Livraisons</h2>
            {hasActiveFilters() && (
              <span className="text-sm text-gray-600">
                {filteredDeliveryNotes.length} livraison(s) trouvée(s)
              </span>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Numéro BL
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Chauffeur
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Nb Produits
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentDeliveryNotes.length > 0 ? (
                currentDeliveryNotes.map((note) => (
                  <tr 
                    key={note.id}
                    onClick={() => onNavigateToDelivery(note)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {note.numero_livraison}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Truck className="w-4 h-4 text-gray-400 mr-2" />
                        <div className="text-sm text-gray-900">
                          {note.chauffeur.prenom} {note.chauffeur.nom}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(note.date_livraison).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(note.statut)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {note.items.length} produit{note.items.length > 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(note.total_ht || 0)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Truck className="w-8 h-8 text-gray-300 mb-2" />
                      <p>Aucune livraison pour ce client</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delivery Notes Pagination */}
      {deliveriesTotalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Affichage de {deliveriesStartIndex + 1} à {Math.min(deliveriesEndIndex, deliveryNotes.length)} sur {deliveryNotes.length} livraisons
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeliveriesPrevPage}
              disabled={deliveriesCurrentPage === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            {Array.from({ length: deliveriesTotalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handleDeliveriesPageChange(page)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  deliveriesCurrentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={handleDeliveriesNextPage}
              disabled={deliveriesCurrentPage === deliveriesTotalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Historique des Paiements</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Mode de Paiement
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Référence
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Émetteur
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentPayments.length > 0 ? (
                currentPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.date_paiement).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatPrice(payment.montant)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        payment.mode_paiement === 'cash' ? 'bg-green-100 text-green-800' :
                        payment.mode_paiement === 'cheque' ? 'bg-blue-100 text-blue-800' :
                        payment.mode_paiement === 'effet' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {payment.mode_paiement === 'cash' ? 'Espèces' :
                         payment.mode_paiement === 'cheque' ? 'Chèque' :
                         payment.mode_paiement === 'effet' ? 'Effet' :
                         payment.mode_paiement === 'virement' ? 'Virement' :
                         payment.mode_paiement}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {payment.reference || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.issuer || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {payment.notes || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <ShoppingBag className="w-8 h-8 text-gray-300 mb-2" />
                      <p>Aucun paiement enregistré pour ce client</p>
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Ajouter le premier paiement
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Payments Pagination */}
      {paymentsTotalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Affichage de {paymentsStartIndex + 1} à {Math.min(paymentsEndIndex, filteredPayments.length)} sur {filteredPayments.length} paiements
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePaymentsPrevPage}
              disabled={paymentsCurrentPage === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            {Array.from({ length: paymentsTotalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePaymentsPageChange(page)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  paymentsCurrentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={handlePaymentsNextPage}
              disabled={paymentsCurrentPage === paymentsTotalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Ajouter un paiement</h3>
              <p className="text-sm text-gray-600 mt-1">Client: {client.societe}</p>
            </div>
            <form onSubmit={handleAddPayment} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="montant" className="block text-sm font-medium text-gray-700 mb-1">
                    Montant (DH) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="montant"
                    name="montant"
                    step="0.01"
                    min="0.01"
                    value={paymentForm.montant}
                    onChange={handlePaymentInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="mode_paiement" className="block text-sm font-medium text-gray-700 mb-1">
                    Mode de paiement <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="mode_paiement"
                    name="mode_paiement"
                    value={paymentForm.mode_paiement}
                    onChange={handlePaymentInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="cash">Espèces</option>
                    <option value="cheque">Chèque</option>
                    <option value="effet">Effet</option>
                    <option value="virement">Virement bancaire</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-1">
                    Référence
                  </label>
                  <input
                    type="text"
                    id="reference"
                    name="reference"
                    value={paymentForm.reference}
                    onChange={handlePaymentInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="N° chèque, effet, virement..."
                  />
                </div>

                <div>
                  <label htmlFor="issuer" className="block text-sm font-medium text-gray-700 mb-1">
                    Émetteur
                  </label>
                  <input
                    type="text"
                    id="issuer"
                    name="issuer"
                    value={paymentForm.issuer}
                    onChange={handlePaymentInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nom de la banque, émetteur..."
                  />
                </div>

                <div>
                  <label htmlFor="date_paiement" className="block text-sm font-medium text-gray-700 mb-1">
                    Date de paiement <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="date_paiement"
                    name="date_paiement"
                    value={paymentForm.date_paiement}
                    onChange={handlePaymentInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={paymentForm.notes}
                    onChange={handlePaymentInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Notes optionnelles..."
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                >
                  {isSubmittingPayment ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDetails;