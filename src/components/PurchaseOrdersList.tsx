import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Eye, 
  FileText, 
  Truck, 
  Download, 
  Printer, 
  X, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PurchaseOrder {
  id: string;
  numero_commande: string;
  date_commande: string;
  statut: string;
  total_ht: number;
  client?: {
    nom: string;
    prenom: string;
    societe: string;
  } | null;
  fournisseur: {
    nom: string;
    prenom: string;
    societe: string;
  };
}

interface PurchaseOrdersListProps {
  onNavigateToAdd: () => void;
  onNavigateToEdit: (order: PurchaseOrder) => void;
  onConvertToDelivery: (order: PurchaseOrder) => void;
}

const PurchaseOrdersList: React.FC<PurchaseOrdersListProps> = ({ onNavigateToAdd, onNavigateToEdit, onConvertToDelivery }) => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [dateFilters, setDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Fetch purchase orders from Supabase
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('bon_de_commande')
        .select(`
          *,
          client:clients(nom, prenom, societe),
          fournisseur:fournisseurs(nom, prenom, societe)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setOrders(data || []);
    } catch (err: any) {
      console.error('Error fetching purchase orders:', err);
      setError('Erreur lors du chargement des bons de commande');
    } finally {
      setLoading(false);
    }
  };

  // Load orders on component mount
  React.useEffect(() => {
    fetchOrders();
  }, []);

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
    setSelectedStatus('');
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return searchTerm || 
           dateFilters.dateFrom || 
           dateFilters.dateTo ||
           selectedStatus;
  };

  // Filter by date range
  const filterByDateRange = (date: string) => {
    if (!dateFilters.dateFrom && !dateFilters.dateTo) return true;
    
    const itemDate = date;
    const fromMatch = !dateFilters.dateFrom || itemDate >= dateFilters.dateFrom;
    const toMatch = !dateFilters.dateTo || itemDate <= dateFilters.dateTo;
    
    return fromMatch && toMatch;
  };

  // Filter orders based on search term
  const searchFilteredOrders = orders.filter(order =>
    order.numero_commande.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.fournisseur.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.fournisseur.societe.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.fournisseur.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${order.fournisseur.prenom} ${order.fournisseur.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.client && (
      order.client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client.societe.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${order.client.prenom} ${order.client.nom}`.toLowerCase().includes(searchTerm.toLowerCase())
    ))
  );

  // Apply all filters to search results
  const filteredOrders = searchFilteredOrders.filter(order => 
    filterByDateRange(order.date_commande) &&
    (!selectedStatus || order.statut === selectedStatus)
  );

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

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
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const exportToCSV = () => {
    const csvHeaders = [
      'Numéro BC',
      'Date Commande',
      'Fournisseur',
      'Client',
      'Statut',
      'Total HT (DH)',
      'Notes'
    ];

    const csvData = filteredOrders.map(order => [
      order.numero_commande,
      new Date(order.date_commande).toLocaleDateString('fr-FR'),
      order.fournisseur.societe || `${order.fournisseur.prenom} ${order.fournisseur.nom}`,
      order.client ? (order.client.societe || `${order.client.prenom} ${order.client.nom}`) : 'Non assigné',
      order.statut === 'brouillon' ? 'Brouillon' :
      order.statut === 'envoyee' ? 'Envoyée' :
      order.statut === 'confirmee' ? 'Confirmée' :
      order.statut === 'livree' ? 'Livrée' :
      order.statut === 'annulee' ? 'Annulée' : order.statut,
      order.total_ht.toFixed(2),
      (order as any).notes || ''
    ]);

    // Add totals row
    csvData.push([
      `TOTAUX (${filteredOrders.length} commandes)`,
      '', // Date
      '', // Fournisseur
      '', // Client
      '', // Statut
      totals.totalAmount.toFixed(2),
      '' // Notes
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bons_commande_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate totals for filtered data
  const calculateTotals = () => {
    const confirmedOrders = filteredOrders.filter(o => o.statut === 'confirmee');
    const deliveredOrders = filteredOrders.filter(o => o.statut === 'livree');
    const sentOrders = filteredOrders.filter(o => o.statut === 'envoyee');
    const draftOrders = filteredOrders.filter(o => o.statut === 'brouillon');

    return {
      totalAmount: filteredOrders.reduce((sum, o) => sum + o.total_ht, 0),
      confirmedTotal: confirmedOrders.reduce((sum, o) => sum + o.total_ht, 0),
      deliveredTotal: deliveredOrders.reduce((sum, o) => sum + o.total_ht, 0),
      sentTotal: sentOrders.reduce((sum, o) => sum + o.total_ht, 0),
      count: filteredOrders.length,
      confirmedCount: confirmedOrders.length,
      deliveredCount: deliveredOrders.length,
      sentCount: sentOrders.length,
      draftCount: draftOrders.length
    };
  };

  const totals = calculateTotals();

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
          <p className="text-gray-500">Chargement des bons de commande...</p>
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
            onClick={fetchOrders}
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
          <h1 className="text-3xl font-bold text-gray-900">Bons de commande</h1>
          <p className="text-gray-600 mt-1">Gérez vos commandes fournisseurs</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            Exporter CSV ({filteredOrders.length})
          </button>
          <button
            onClick={() => window.print()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Printer className="w-4 h-4" />
            Imprimer ({filteredOrders.length})
          </button>
          <button
            onClick={onNavigateToAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors duration-200 shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Créer un bon de commande
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Commandes</p>
              <p className="text-2xl font-bold text-gray-900">{totals.count}</p>
              <p className="text-sm font-medium text-blue-600">{formatPrice(totals.totalAmount)}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Confirmées</p>
              <p className="text-2xl font-bold text-green-600">{totals.confirmedCount}</p>
              <p className="text-sm font-medium text-green-600">{formatPrice(totals.confirmedTotal)}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Livrées</p>
              <p className="text-2xl font-bold text-purple-600">{totals.deliveredCount}</p>
              <p className="text-sm font-medium text-purple-600">{formatPrice(totals.deliveredTotal)}</p>
            </div>
            <Truck className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Envoyées</p>
              <p className="text-2xl font-bold text-blue-600">{totals.sentCount}</p>
              <p className="text-sm font-medium text-blue-600">{formatPrice(totals.sentTotal)}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par numéro, fournisseur ou client..."
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Statut
            </label>
            <select
              id="status-filter"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">Tous les statuts</option>
              <option value="brouillon">Brouillon</option>
              <option value="envoyee">Envoyée</option>
              <option value="confirmee">Confirmée</option>
              <option value="livree">Livrée</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>
        </div>
        
        {hasActiveFilters() && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800">
                <strong>{filteredOrders.length}</strong> bon(s) de commande trouvé(s) avec les filtres actifs
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
                  Numéro
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Fournisseur
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentOrders.length > 0 ? (
                currentOrders.map((order) => (
                  <tr 
                    key={order.id} 
                    onClick={() => onNavigateToEdit(order)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {order.numero_commande}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.fournisseur.societe}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.fournisseur.prenom} {order.fournisseur.nom}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {order.client ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {order.client.societe}
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.client.prenom} {order.client.nom}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm italic">Non assigné</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(order.date_commande).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(order.statut)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(order.total_ht)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToEdit(order);
                          }}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Voir
                        </button>
                        {(order.statut === 'confirmee' || order.statut === 'envoyee') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onConvertToDelivery(order);
                            }}
                            className="text-green-600 hover:text-green-900 flex items-center gap-1"
                          >
                            <Truck className="w-4 h-4" />
                            Livrer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <FileText className="w-8 h-8 text-gray-300 mb-2" />
                      <p>{searchTerm ? 'Aucun bon de commande trouvé' : 'Aucun bon de commande disponible'}</p>
                      {!searchTerm && (
                        <button
                          onClick={onNavigateToAdd}
                          className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Créer votre premier bon de commande
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
              Affichage de {startIndex + 1} à {Math.min(endIndex, filteredOrders.length)} sur {filteredOrders.length} bons de commande
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Éléments par page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={20}>20</option>
                <option value={60}>60</option>
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

      {/* Print-only content */}
      <div className="hidden print:block fixed inset-0 bg-white p-8">
        {/* Print Header */}
        <div className="relative text-center border-b-2 border-gray-800 pb-6 mb-8">
          <img 
            src="https://pub-237d2da54b564d23aaa1c3826e1d4e65.r2.dev/ANTURGOOD/logo2.png" 
            alt="ANTURGOOD Logo" 
            className="absolute top-0 left-0 h-24 w-auto"
          />
          <p className="text-lg text-gray-700 mt-2">LISTE DES BONS DE COMMANDE</p>
          <p className="text-sm text-gray-600 mt-2">
            Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')} | 
            {filteredOrders.length} commande(s) | Total: {formatPrice(totals.totalAmount)}
          </p>
        </div>

        {/* Print Table */}
        <table className="w-full border-collapse border border-gray-800">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">N° BC</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Date</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Fournisseur</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Client</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Statut</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td className="border border-gray-800 px-3 py-2 text-sm">{order.numero_commande}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm">
                  {new Date(order.date_commande).toLocaleDateString('fr-FR')}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm">
                  {order.fournisseur.societe || `${order.fournisseur.prenom} ${order.fournisseur.nom}`}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm">
                  {order.client ? (order.client.societe || `${order.client.prenom} ${order.client.nom}`) : 'Non assigné'}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm">
                  {order.statut === 'brouillon' ? 'Brouillon' :
                   order.statut === 'envoyee' ? 'Envoyée' :
                   order.statut === 'confirmee' ? 'Confirmée' :
                   order.statut === 'livree' ? 'Livrée' :
                   order.statut === 'annulee' ? 'Annulée' : order.statut}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm text-right font-medium">
                  {formatPrice(order.total_ht)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td className="border border-gray-800 px-3 py-3 font-bold text-sm" colSpan={5}>
                TOTAUX ({filteredOrders.length} commandes)
              </td>
              <td className="border border-gray-800 px-3 py-3 text-right font-bold text-sm">
                {formatPrice(totals.totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Print Footer */}
        <div className="absolute bottom-8 left-8 right-8 text-center text-xs text-gray-500 border-t border-gray-300 pt-4">
          <p>ANTURGOOD - Système de gestion | Document généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          @page {
            margin: 1cm;
            size: A4 portrait;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
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
            padding: 1cm !important;
            background: white !important;
            color: black !important;
            font-size: 12pt !important;
            line-height: 1.4 !important;
          }
          
          /* Table styling for print */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 10pt !important;
          }
          
          th, td {
            border: 1px solid #000 !important;
            padding: 4px !important;
          }
          
          /* Page breaks */
          tbody tr {
            page-break-inside: avoid;
          }
          
          thead {
            display: table-header-group;
          }
          
          tfoot {
            display: table-footer-group;
            page-break-inside: avoid;
          }
          
          /* Hide any remaining UI elements */
          nav, aside, button:not(.print\\:block button), .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PurchaseOrdersList;