import React, { useState, useEffect } from 'react';
import { ArrowLeft, Building2, FileText, Calendar, MapPin, TrendingUp, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Fournisseur {
  id: string;
  numero_fournisseur: string;
  nom: string;
  prenom: string;
  societe: string;
  ice: string;
  email: string;
  telephone: string;
  created_at: string;
  available_credit: number;
}

interface PurchaseOrder {
  id: string;
  numero_commande: string;
  date_commande: string;
  statut: string;
  total_ht: number;
  notes: string | null;
  items: PurchaseOrderItem[];
}

interface PurchaseOrderItem {
  id: string;
  quantite: number;
  prix_unitaire: number;
  total_ligne: number;
  produit: {
    nom_produit: string;
  };
}

interface FournisseurStats {
  totalOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  totalAmount: number;
  totalPayments: number;
  currentDebt: number;
  availableCredit: number;
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

interface FournisseurDetailsProps {
  fournisseur: Fournisseur;
  onNavigateBack: () => void;
  onNavigateToPurchaseOrder: (order: PurchaseOrder) => void;
}

const FournisseurDetails: React.FC<FournisseurDetailsProps> = ({ 
  fournisseur: initialFournisseur, 
  onNavigateBack, 
  onNavigateToPurchaseOrder 
}) => {
  const [fournisseur, setFournisseur] = useState<Fournisseur>(initialFournisseur);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<FournisseurStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Pagination states
  const [ordersCurrentPage, setOrdersCurrentPage] = useState(1);
  const [paymentsCurrentPage, setPaymentsCurrentPage] = useState(1);
  const ordersPerPage = 10;
  const paymentsPerPage = 10;
  
  const [paymentForm, setPaymentForm] = useState({
    montant: '',
    mode_paiement: 'cash',
    reference: '',
    issuer: '',
    date_paiement: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Filter states
  const [dateFilters, setDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchFournisseurData();
  }, [fournisseur.id]);

  // Update fournisseur when prop changes
  useEffect(() => {
    setFournisseur(initialFournisseur);
  }, [initialFournisseur]);

  const fetchFournisseurData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch purchase orders for this supplier
      const { data: orders, error: ordersError } = await supabase
        .from('bon_de_commande')
        .select(`
          *,
          items:bon_de_commande_items(
            id,
            quantite,
            prix_unitaire,
            total_ligne,
            produit:produits(nom_produit)
          )
        `)
        .eq('fournisseur_id', fournisseur.id)
        .neq('statut', 'annulee')
        .order('date_commande', { ascending: false });

      if (ordersError) {
        throw ordersError;
      }

      setPurchaseOrders(orders || []);

      // Fetch payments for this supplier
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('paiements_fournisseurs')
        .select('*')
        .eq('fournisseur_id', fournisseur.id)
        .order('date_paiement', { ascending: false });

      if (paymentsError) {
        throw paymentsError;
      }

      setPayments(paymentsData || []);

      // Calculate statistics
      const ordersData = orders || [];
      const paymentsTotal = (paymentsData || []).reduce((sum, payment) => sum + payment.montant, 0);
      
      const totalOrders = ordersData.length;
      const confirmedOrders = ordersData.filter(o => o.statut === 'confirmee').length;
      const deliveredOrders = ordersData.filter(o => o.statut === 'livree').length;
      const totalAmount = ordersData.reduce((sum, order) => sum + (order.total_ht || 0), 0);
      const ourDebt = totalAmount - paymentsTotal;
      const currentDebt = Math.max(0, ourDebt); // Amount we owe to supplier
      const availableCredit = Math.max(0, -ourDebt); // Advance supplier has received
      
      setStats({
        totalOrders,
        confirmedOrders,
        deliveredOrders,
        totalAmount,
        totalPayments: paymentsTotal,
        currentDebt,
        availableCredit
      });

    } catch (err: any) {
      console.error('Error fetching supplier data:', err);
      setError('Erreur lors du chargement des données fournisseur');
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
        .from('paiements_fournisseurs')
        .insert([
          {
            fournisseur_id: fournisseur.id,
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
      await fetchFournisseurData();
      
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
    setOrdersCurrentPage(1);
    setPaymentsCurrentPage(1);
  };

  const clearDateFilters = () => {
    setDateFilters({
      dateFrom: '',
      dateTo: ''
    });
    setOrdersCurrentPage(1);
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

  // Pagination functions for orders
  const handleOrdersPageChange = (page: number) => {
    setOrdersCurrentPage(page);
  };

  const handleOrdersPrevPage = () => {
    if (ordersCurrentPage > 1) {
      setOrdersCurrentPage(ordersCurrentPage - 1);
    }
  };

  const handleOrdersNextPage = () => {
    const ordersTotalPages = Math.ceil(filteredPurchaseOrders.length / ordersPerPage);
    if (ordersCurrentPage < ordersTotalPages) {
      setOrdersCurrentPage(ordersCurrentPage + 1);
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
    const paymentsTotalPages = Math.ceil(filteredPayments.length / paymentsPerPage);
    if (paymentsCurrentPage < paymentsTotalPages) {
      setPaymentsCurrentPage(paymentsCurrentPage + 1);
    }
  };

  // Filter data
  const filteredPurchaseOrders = purchaseOrders.filter(order => 
    filterByDateRange(order.date_commande)
  );

  const filteredPayments = payments.filter(payment => 
    filterByDateRange(payment.date_paiement)
  );
  
  // Calculate pagination for orders
  const ordersTotalPages = Math.ceil(filteredPurchaseOrders.length / ordersPerPage);
  const ordersStartIndex = (ordersCurrentPage - 1) * ordersPerPage;
  const ordersEndIndex = ordersStartIndex + ordersPerPage;
  const currentPurchaseOrders = filteredPurchaseOrders.slice(ordersStartIndex, ordersEndIndex);

  // Calculate pagination for payments
  const paymentsTotalPages = Math.ceil(filteredPayments.length / paymentsPerPage);
  const paymentsStartIndex = (paymentsCurrentPage - 1) * paymentsPerPage;
  const paymentsEndIndex = paymentsStartIndex + paymentsPerPage;
  const currentPayments = filteredPayments.slice(paymentsStartIndex, paymentsEndIndex);

  // Calculate filtered statistics
  const calculateFilteredStats = () => {
    if (!hasActiveFilters()) return stats;
    
    const filteredOrdersAmount = filteredPurchaseOrders.reduce((sum, order) => sum + (order.total_ht || 0), 0);
    const filteredPaymentsAmount = filteredPayments.reduce((sum, payment) => sum + payment.montant, 0);
    const filteredOurDebt = filteredOrdersAmount - filteredPaymentsAmount;
    const filteredDebt = Math.max(0, filteredOurDebt);
    const filteredCredit = Math.max(0, -filteredOurDebt);
    
    return {
      totalOrders: filteredPurchaseOrders.length,
      confirmedOrders: filteredPurchaseOrders.filter(o => o.statut === 'confirmee').length,
      deliveredOrders: filteredPurchaseOrders.filter(o => o.statut === 'livree').length,
      totalAmount: filteredOrdersAmount,
      totalPayments: filteredPaymentsAmount,
      currentDebt: filteredDebt,
      availableCredit: filteredCredit
    };
  };

  const displayStats = calculateFilteredStats();

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
          <p className="text-gray-500">Chargement des données fournisseur...</p>
        </div>
      </div>
    );
  }

  if (error && !showPaymentModal) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchFournisseurData}
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
            <Building2 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{fournisseur.societe}</h1>
              <p className="text-gray-600">{fournisseur.prenom} {fournisseur.nom} - {fournisseur.numero_fournisseur}</p>
            </div>
          </div>
          
          {/* Supplier Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Contact</span>
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900">{fournisseur.email}</p>
                <p className="text-sm text-gray-600">{fournisseur.telephone}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">ICE</span>
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900 font-mono">{fournisseur.ice}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Fournisseur depuis</span>
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900">
                  {new Date(fournisseur.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Statistics Cards */}
      {displayStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-[120px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Commandes</p>
                <p className="text-2xl font-bold text-gray-900">{displayStats.totalOrders}</p>
                <p className="text-xs text-gray-500 mt-1">Toutes commandes</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-[120px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Montant Total</p>
                <p className="text-2xl font-bold text-blue-600">{formatPrice(displayStats.totalAmount)}</p>
                <p className="text-xs text-gray-500 mt-1">Toutes commandes</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-[120px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Paiements</p>
                <p className="text-2xl font-bold text-green-600">{formatPrice(displayStats.totalPayments)}</p>
                <p className="text-xs text-gray-500 mt-1">Payé au fournisseur</p>
              </div>
              <div className="flex flex-col items-center">
                <TrendingUp className="w-8 h-8 text-green-600" />
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors duration-200"
                >
                  + Paiement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Status Section */}
      {displayStats && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-xl border border-blue-200 p-8 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Résumé Financier</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">{formatPrice(displayStats.totalPayments)}</p>
              <p className="text-sm text-gray-700 mt-1 font-medium">Total Paiements</p>
              <p className="text-xs text-gray-500 mt-1">Versés au fournisseur</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{formatPrice(displayStats.availableCredit)}</p>
              <p className="text-sm text-gray-700 mt-1 font-medium">Avance à consommer</p>
              <p className="text-xs text-gray-500 mt-1">Disponible</p>
            </div>
            
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                displayStats.currentDebt > 0 ? 'bg-red-100' : 'bg-green-100'
              }`}>
                <ShoppingBag className={`w-8 h-8 ${displayStats.currentDebt > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <p className={`text-2xl font-bold ${displayStats.currentDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatPrice(displayStats.currentDebt)}
              </p>
              <p className="text-sm text-gray-700 mt-1 font-medium">Crédit Fournisseur</p>
              <p className="text-xs text-gray-500 mt-1">
                {displayStats.currentDebt > 0 ? 'Dû au fournisseur' : 'À jour'}
              </p>
            </div>
            
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                displayStats.currentDebt > 0 ? 'bg-red-100' : 
                displayStats.availableCredit > 0 ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  displayStats.currentDebt > 0 ? 'bg-red-500' : 
                  displayStats.availableCredit > 0 ? 'bg-green-500' : 'bg-gray-500'
                }`}>
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                </div>
              </div>
              <p className={`text-lg font-bold ${
                displayStats.currentDebt > 0 ? 'text-red-600' : 
                displayStats.availableCredit > 0 ? 'text-green-600' : 'text-gray-600'
              }`}>
                {displayStats.currentDebt > 0 ? 'Crédit Actif' : 
                 displayStats.availableCredit > 0 ? 'Avance Active' : 'Équilibré'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {displayStats.currentDebt > 0 ? 'Paiement requis' : 
                 displayStats.availableCredit > 0 ? 'Fonds disponibles' : 'Aucune dette'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
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
                <strong>{filteredPurchaseOrders.length}</strong> commande(s) et <strong>{filteredPayments.length}</strong> paiement(s) trouvé(s)
                {dateFilters.dateFrom && dateFilters.dateTo && ` du ${new Date(dateFilters.dateFrom).toLocaleDateString('fr-FR')} au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`}
                {dateFilters.dateFrom && !dateFilters.dateTo && ` à partir du ${new Date(dateFilters.dateFrom).toLocaleDateString('fr-FR')}`}
                {!dateFilters.dateFrom && dateFilters.dateTo && ` jusqu'au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`}
              </p>
              <p className="text-sm font-medium text-blue-900">
                Montant filtré: {formatPrice(displayStats?.totalAmount || 0)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Purchase Orders Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Historique des Bons de Commande</h2>
            {hasActiveFilters() && (
              <span className="text-sm text-gray-600">
                {filteredPurchaseOrders.length} commande(s) trouvée(s)
              </span>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Numéro BC
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentPurchaseOrders.length > 0 ? (
                currentPurchaseOrders.map((order) => (
                  <tr 
                    key={order.id}
                    onClick={() => onNavigateToPurchaseOrder(order)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {order.numero_commande}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(order.date_commande).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(order.statut)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.items.length} produit{order.items.length > 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(order.total_ht)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {order.notes || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <FileText className="w-8 h-8 text-gray-300 mb-2" />
                      <p>Aucune commande pour ce fournisseur</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase Orders Pagination */}
      {ordersTotalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Affichage de {ordersStartIndex + 1} à {Math.min(ordersEndIndex, filteredPurchaseOrders.length)} sur {filteredPurchaseOrders.length} commandes
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOrdersPrevPage}
              disabled={ordersCurrentPage === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            {Array.from({ length: ordersTotalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handleOrdersPageChange(page)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  ordersCurrentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={handleOrdersNextPage}
              disabled={ordersCurrentPage === ordersTotalPages}
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Historique des Paiements</h2>
            {hasActiveFilters() && (
              <span className="text-sm text-gray-600">
                {filteredPayments.length} paiement(s) trouvé(s)
              </span>
            )}
          </div>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
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
                      <p>Aucun paiement enregistré pour ce fournisseur</p>
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
              <p className="text-sm text-gray-600 mt-1">Fournisseur: {fournisseur.societe}</p>
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

export default FournisseurDetails;