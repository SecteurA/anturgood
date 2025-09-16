import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  X,
  DollarSign,
  Calendar,
  FileText,
  Building2,
  Users,
  Truck,
  Save,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Payment {
  id: string;
  montant: number;
  mode_paiement: string;
  reference: string | null;
  issuer: string | null;
  date_paiement: string;
  notes: string | null;
  type: 'client' | 'fournisseur' | 'chauffeur';
  entity: {
    id: string;
    nom: string;
    prenom: string;
    societe?: string;
    numero_client?: string;
    numero_fournisseur?: string;
    numero_chauffeur?: string;
  };
}

const PaymentsList: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [dateFilters, setDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });

  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    montant: '',
    mode_paiement: 'cash',
    reference: '',
    issuer: '',
    date_paiement: '',
    notes: ''
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch client payments
      const { data: clientPayments, error: clientError } = await supabase
        .from('paiements_clients')
        .select(`
          *,
          client:clients(id, nom, prenom, societe, numero_client)
        `)
        .order('date_paiement', { ascending: false });

      if (clientError) throw clientError;

      // Fetch supplier payments
      const { data: supplierPayments, error: supplierError } = await supabase
        .from('paiements_fournisseurs')
        .select(`
          *,
          fournisseur:fournisseurs(id, nom, prenom, societe, numero_fournisseur)
        `)
        .order('date_paiement', { ascending: false });

      if (supplierError) throw supplierError;

      // Fetch chauffeur payments
      const { data: chauffeurPayments, error: chauffeurError } = await supabase
        .from('paiements_chauffeurs')
        .select(`
          *,
          chauffeur:chauffeurs(id, nom, prenom, numero_chauffeur)
        `)
        .order('date_paiement', { ascending: false });

      if (chauffeurError) throw chauffeurError;

      // Combine and format all payments
      const allPayments: Payment[] = [
        ...(clientPayments || []).map(p => ({
          ...p,
          type: 'client' as const,
          entity: {
            id: p.client.id,
            nom: p.client.nom,
            prenom: p.client.prenom,
            societe: p.client.societe,
            numero_client: p.client.numero_client
          }
        })),
        ...(supplierPayments || []).map(p => ({
          ...p,
          type: 'fournisseur' as const,
          entity: {
            id: p.fournisseur.id,
            nom: p.fournisseur.nom,
            prenom: p.fournisseur.prenom,
            societe: p.fournisseur.societe,
            numero_fournisseur: p.fournisseur.numero_fournisseur
          }
        })),
        ...(chauffeurPayments || []).map(p => ({
          ...p,
          type: 'chauffeur' as const,
          entity: {
            id: p.chauffeur.id,
            nom: p.chauffeur.nom,
            prenom: p.chauffeur.prenom,
            numero_chauffeur: p.chauffeur.numero_chauffeur
          }
        }))
      ];

      // Sort by date descending
      allPayments.sort((a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime());

      setPayments(allPayments);
    } catch (err: any) {
      console.error('Error fetching payments:', err);
      setError('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    setDateFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setDateFilters({ dateFrom: '', dateTo: '' });
    setSelectedType('');
    setSelectedPaymentMethod('');
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return searchTerm || 
           dateFilters.dateFrom || 
           dateFilters.dateTo ||
           selectedType ||
           selectedPaymentMethod;
  };

  // Filter by date range
  const filterByDateRange = (date: string) => {
    if (!dateFilters.dateFrom && !dateFilters.dateTo) return true;
    
    const itemDate = date;
    const fromMatch = !dateFilters.dateFrom || itemDate >= dateFilters.dateFrom;
    const toMatch = !dateFilters.dateTo || itemDate <= dateFilters.dateTo;
    
    return fromMatch && toMatch;
  };

  // Filter payments based on all criteria
  const searchFilteredPayments = payments.filter(payment => {
    const search = searchTerm.toLowerCase();
    return (
      // Search in payment reference
      (payment.reference || '').toLowerCase().includes(search) ||
      // Search in issuer
      (payment.issuer || '').toLowerCase().includes(search) ||
      // Search in entity name
      payment.entity.nom.toLowerCase().includes(search) ||
      payment.entity.prenom.toLowerCase().includes(search) ||
      (payment.entity.societe || '').toLowerCase().includes(search) ||
      // Search in entity numbers
      (payment.entity.numero_client || '').toLowerCase().includes(search) ||
      (payment.entity.numero_fournisseur || '').toLowerCase().includes(search) ||
      (payment.entity.numero_chauffeur || '').toLowerCase().includes(search) ||
      // Search in full names
      `${payment.entity.prenom} ${payment.entity.nom}`.toLowerCase().includes(search) ||
      `${payment.entity.nom} ${payment.entity.prenom}`.toLowerCase().includes(search)
    );
  });

  // Apply all filters
  const filteredPayments = searchFilteredPayments.filter(payment => {
    const dateMatch = filterByDateRange(payment.date_paiement);
    const typeMatch = !selectedType || payment.type === selectedType;
    const methodMatch = !selectedPaymentMethod || payment.mode_paiement === selectedPaymentMethod;
    
    return dateMatch && typeMatch && methodMatch;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPayments = filteredPayments.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const openPaymentModal = (payment: Payment, editMode: boolean = false) => {
    setSelectedPayment(payment);
    setIsEditMode(editMode);
    
    if (editMode) {
      setEditForm({
        montant: payment.montant.toString(),
        mode_paiement: payment.mode_paiement,
        reference: payment.reference || '',
        issuer: payment.issuer || '',
        date_paiement: payment.date_paiement,
        notes: payment.notes || ''
      });
    }
    
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedPayment(null);
    setIsEditMode(false);
    setEditForm({
      montant: '',
      mode_paiement: 'cash',
      reference: '',
      issuer: '',
      date_paiement: '',
      notes: ''
    });
    setError(null);
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPayment) return;
    
    if (!editForm.montant || Number(editForm.montant) <= 0) {
      setError('Le montant doit être supérieur à 0');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const tableName = selectedPayment.type === 'client' ? 'paiements_clients' :
                       selectedPayment.type === 'fournisseur' ? 'paiements_fournisseurs' :
                       'paiements_chauffeurs';

      const { error } = await supabase
        .from(tableName)
        .update({
          montant: Number(editForm.montant),
          mode_paiement: editForm.mode_paiement,
          reference: editForm.reference.trim() || null,
          issuer: editForm.issuer.trim() || null,
          date_paiement: editForm.date_paiement,
          notes: editForm.notes.trim() || null
        })
        .eq('id', selectedPayment.id);

      if (error) throw error;

      console.log('Payment updated successfully');
      closePaymentModal();
      await fetchPayments(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating payment:', error);
      setError('Erreur lors de la modification du paiement. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!selectedPayment) return;

    setIsDeleting(true);
    setError(null);

    try {
      const tableName = selectedPayment.type === 'client' ? 'paiements_clients' :
                       selectedPayment.type === 'fournisseur' ? 'paiements_fournisseurs' :
                       'paiements_chauffeurs';

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', selectedPayment.id);

      if (error) throw error;

      console.log('Payment deleted successfully');
      setShowDeleteModal(false);
      closePaymentModal();
      await fetchPayments(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      setError('Erreur lors de la suppression du paiement. Veuillez réessayer.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-MA', {
      minimumFractionDigits: 2,
      useGrouping: false
    }).format(price) + ' DH';
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods = {
      cash: 'Espèces',
      cheque: 'Chèque',
      effet: 'Effet',
      virement: 'Virement'
    };
    return methods[method as keyof typeof methods] || method;
  };

  const getTypeLabel = (type: string) => {
    const types = {
      client: 'Client',
      fournisseur: 'Fournisseur',
      chauffeur: 'Chauffeur'
    };
    return types[type as keyof typeof types] || type;
  };

  const getTypeBadge = (type: string) => {
    const typeConfig = {
      client: 'bg-blue-100 text-blue-800',
      fournisseur: 'bg-orange-100 text-orange-800',
      chauffeur: 'bg-green-100 text-green-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        typeConfig[type as keyof typeof typeConfig] || typeConfig.client
      }`}>
        {getTypeLabel(type)}
      </span>
    );
  };

  const getMethodBadge = (method: string) => {
    const methodConfig = {
      cash: 'bg-green-100 text-green-800',
      cheque: 'bg-blue-100 text-blue-800',
      effet: 'bg-purple-100 text-purple-800',
      virement: 'bg-indigo-100 text-indigo-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        methodConfig[method as keyof typeof methodConfig] || methodConfig.cash
      }`}>
        {getPaymentMethodLabel(method)}
      </span>
    );
  };

  // Calculate totals for filtered data
  const calculateTotals = () => {
    const clientPayments = filteredPayments.filter(p => p.type === 'client');
    const supplierPayments = filteredPayments.filter(p => p.type === 'fournisseur');
    const chauffeurPayments = filteredPayments.filter(p => p.type === 'chauffeur');

    return {
      totalAmount: filteredPayments.reduce((sum, p) => sum + p.montant, 0),
      clientTotal: clientPayments.reduce((sum, p) => sum + p.montant, 0),
      supplierTotal: supplierPayments.reduce((sum, p) => sum + p.montant, 0),
      chauffeurTotal: chauffeurPayments.reduce((sum, p) => sum + p.montant, 0),
      count: filteredPayments.length,
      clientCount: clientPayments.length,
      supplierCount: supplierPayments.length,
      chauffeurCount: chauffeurPayments.length
    };
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Chargement des paiements...</p>
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
            onClick={fetchPayments}
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paiements</h1>
          <p className="text-gray-600 mt-1">Gérez tous vos paiements clients, fournisseurs et chauffeurs</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Paiements</p>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(totals.totalAmount)}</p>
              <p className="text-xs text-gray-500">{totals.count} paiement(s)</p>
            </div>
            <DollarSign className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Clients</p>
              <p className="text-2xl font-bold text-blue-600">{formatPrice(totals.clientTotal)}</p>
              <p className="text-xs text-gray-500">{totals.clientCount} paiement(s)</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Fournisseurs</p>
              <p className="text-2xl font-bold text-orange-600">{formatPrice(totals.supplierTotal)}</p>
              <p className="text-xs text-gray-500">{totals.supplierCount} paiement(s)</p>
            </div>
            <Building2 className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chauffeurs</p>
              <p className="text-2xl font-bold text-green-600">{formatPrice(totals.chauffeurTotal)}</p>
              <p className="text-xs text-gray-500">{totals.chauffeurCount} paiement(s)</p>
            </div>
            <Truck className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, société, référence..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filtres avancés</h3>
          {hasActiveFilters() && (
            <button
              onClick={clearAllFilters}
              className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1 transition-colors duration-200"
            >
              <X className="w-4 h-4" />
              Effacer tous les filtres
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              id="type-filter"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">Tous les types</option>
              <option value="client">Clients</option>
              <option value="fournisseur">Fournisseurs</option>
              <option value="chauffeur">Chauffeurs</option>
            </select>
          </div>

          <div>
            <label htmlFor="method-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Mode de paiement
            </label>
            <select
              id="method-filter"
              value={selectedPaymentMethod}
              onChange={(e) => {
                setSelectedPaymentMethod(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">Tous les modes</option>
              <option value="cash">Espèces</option>
              <option value="cheque">Chèque</option>
              <option value="effet">Effet</option>
              <option value="virement">Virement</option>
            </select>
          </div>
        </div>
        
        {hasActiveFilters() && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800">
                <strong>{filteredPayments.length}</strong> paiement(s) trouvé(s) avec les filtres actifs
              </p>
              <p className="text-sm font-medium text-blue-900">
                Total filtré: {formatPrice(totals.totalAmount)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Bénéficiaire
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
                  Actions
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTypeBadge(payment.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.entity.societe || `${payment.entity.prenom} ${payment.entity.nom}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {payment.entity.numero_client || payment.entity.numero_fournisseur || payment.entity.numero_chauffeur}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span className={`${
                        payment.type === 'client' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {payment.type === 'client' ? '+' : '-'}{formatPrice(payment.montant)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getMethodBadge(payment.mode_paiement)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {payment.reference || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPaymentModal(payment, false)}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Voir
                        </button>
                        <button
                          onClick={() => openPaymentModal(payment, true)}
                          className="text-green-600 hover:text-green-900 flex items-center gap-1"
                        >
                          <Edit3 className="w-4 h-4" />
                          Modifier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <DollarSign className="w-8 h-8 text-gray-300 mb-2" />
                      <p>{searchTerm || hasActiveFilters() ? 'Aucun paiement trouvé' : 'Aucun paiement disponible'}</p>
                      {hasActiveFilters() && (
                        <button
                          onClick={clearAllFilters}
                          className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Effacer les filtres
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Affichage de {startIndex + 1} à {Math.min(endIndex, filteredPayments.length)} sur {filteredPayments.length} paiements
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Éléments par page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Payment Details/Edit Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {isEditMode ? 'Modifier le paiement' : 'Détails du paiement'}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {getTypeLabel(selectedPayment.type)}: {selectedPayment.entity.societe || `${selectedPayment.entity.prenom} ${selectedPayment.entity.nom}`}
                  </p>
                </div>
                <button
                  onClick={closePaymentModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {isEditMode ? (
              <form onSubmit={handleUpdatePayment} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="edit-montant" className="block text-sm font-medium text-gray-700 mb-1">
                      Montant (DH) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="edit-montant"
                      name="montant"
                      step="0.01"
                      min="0.01"
                      value={editForm.montant}
                      onChange={handleEditFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-mode_paiement" className="block text-sm font-medium text-gray-700 mb-1">
                      Mode de paiement <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="edit-mode_paiement"
                      name="mode_paiement"
                      value={editForm.mode_paiement}
                      onChange={handleEditFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="cash">Espèces</option>
                      <option value="cheque">Chèque</option>
                      <option value="effet">Effet</option>
                      <option value="virement">Virement bancaire</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit-reference" className="block text-sm font-medium text-gray-700 mb-1">
                      Référence
                    </label>
                    <input
                      type="text"
                      id="edit-reference"
                      name="reference"
                      value={editForm.reference}
                      onChange={handleEditFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="N° chèque, effet, virement..."
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-issuer" className="block text-sm font-medium text-gray-700 mb-1">
                      Émetteur
                    </label>
                    <input
                      type="text"
                      id="edit-issuer"
                      name="issuer"
                      value={editForm.issuer}
                      onChange={handleEditFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nom de la banque, émetteur..."
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-date_paiement" className="block text-sm font-medium text-gray-700 mb-1">
                      Date de paiement <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      id="edit-date_paiement"
                      name="date_paiement"
                      value={editForm.date_paiement}
                      onChange={handleEditFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-notes" className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      id="edit-notes"
                      name="notes"
                      rows={3}
                      value={editForm.notes}
                      onChange={handleEditFormChange}
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
                    onClick={closePaymentModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200"
                  >
                    Supprimer
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6">
                {/* View Mode */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Montant</label>
                      <p className="text-lg font-semibold text-gray-900">{formatPrice(selectedPayment.montant)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Mode de paiement</label>
                      <p className="text-sm text-gray-900 mt-1">{getMethodBadge(selectedPayment.mode_paiement)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Référence</label>
                      <p className="text-sm text-gray-900 font-mono">{selectedPayment.reference || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Émetteur</label>
                      <p className="text-sm text-gray-900">{selectedPayment.issuer || '-'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Date de paiement</label>
                    <p className="text-sm text-gray-900">{new Date(selectedPayment.date_paiement).toLocaleDateString('fr-FR')}</p>
                  </div>

                  {selectedPayment.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Notes</label>
                      <p className="text-sm text-gray-900 mt-1">{selectedPayment.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    onClick={closePaymentModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Modifier
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirmer la suppression</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Êtes-vous sûr de vouloir supprimer ce paiement de <strong>{formatPrice(selectedPayment.montant)}</strong> ?
              </p>
              <p className="text-sm text-gray-500">
                Cette action est irréversible et peut affecter les calculs financiers.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeletePayment}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsList;