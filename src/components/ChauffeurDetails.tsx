import React, { useState, useEffect } from 'react';
import { ArrowLeft, Truck, Calendar, MapPin, TrendingUp, ShoppingBag, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Chauffeur {
  id: string;
  numero_chauffeur: string;
  nom: string;
  prenom: string;
  telephone: string;
  immatricule: string;
  type_chauffeur: string;
  created_at: string;
}

interface DeliveryNote {
  id: string;
  numero_livraision: string;
  date_livraison: string;
  statut: string;
  total_ht: number;
  notes: string | null;
  immatricule_utilise: string;
  client: {
    nom: string;
    prenom: string;
    societe: string;
    numero_client: string;
  };
  bon_commande: {
    numero_commande: string;
    fournisseur: {
      nom: string;
      prenom: string;
      societe: string;
      numero_fournisseur: string;
    };
  };
}

interface ChauffeurStats {
  totalDeliveries: number;
  deliveredCount: number;
  pendingCount: number;
  totalRevenue: number;
}

interface ChauffeurDetailsProps {
  chauffeur: Chauffeur;
  onNavigateBack: () => void;
}

const ChauffeurDetails: React.FC<ChauffeurDetailsProps> = ({ chauffeur, onNavigateBack }) => {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [stats, setStats] = useState<ChauffeurStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilters, setDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchChauffeurData();
  }, [chauffeur.id]);

  const fetchChauffeurData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch delivery notes for this chauffeur
      const { data: deliveries, error: deliveryError } = await supabase
        .from('bon_de_livraison')
        .select(`
          *,
          client:clients(nom, prenom, societe, numero_client),
          bon_commande:bon_de_commande(
            numero_commande,
            fournisseur:fournisseurs(nom, prenom, societe, numero_fournisseur)
          )
        `)
        .eq('chauffeur_id', chauffeur.id)
        .neq('statut', 'annulee') // Exclude cancelled delivery notes
        .order('date_livraison', { ascending: false });

      if (deliveryError) {
        throw deliveryError;
      }

      setDeliveryNotes(deliveries || []);

      // Calculate statistics
      const deliveriesData = deliveries || [];
      
      const totalDeliveries = deliveriesData.length;
      const deliveredCount = deliveriesData.filter(d => d.statut === 'livree').length;
      const pendingCount = deliveriesData.filter(d => d.statut !== 'livree' && d.statut !== 'annulee').length;
      const totalRevenue = deliveriesData.reduce((sum, delivery) => sum + (delivery.total_ht || 0), 0);
      
      setStats({
        totalDeliveries,
        deliveredCount,
        pendingCount,
        totalRevenue
      });

    } catch (err: any) {
      console.error('Error fetching chauffeur data:', err);
      setError('Erreur lors du chargement des données chauffeur');
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
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return searchTerm || dateFilters.dateFrom || dateFilters.dateTo;
  };

  // Filter functions
  const filterByDateRange = (date: string) => {
    if (!dateFilters.dateFrom && !dateFilters.dateTo) return true;
    
    const itemDate = date;
    const fromMatch = !dateFilters.dateFrom || itemDate >= dateFilters.dateFrom;
    const toMatch = !dateFilters.dateTo || itemDate <= dateFilters.dateTo;
    
    return fromMatch && toMatch;
  };

  const filterBySearch = (delivery: DeliveryNote) => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      // Search in client info
      (delivery.client?.nom || '').toLowerCase().includes(search) ||
      (delivery.client?.prenom || '').toLowerCase().includes(search) ||
      (delivery.client?.societe || '').toLowerCase().includes(search) ||
      (delivery.client?.numero_client || '').toLowerCase().includes(search) ||
      `${delivery.client?.prenom || ''} ${delivery.client?.nom || ''}`.toLowerCase().includes(search) ||
      `${delivery.client?.nom || ''} ${delivery.client?.prenom || ''}`.toLowerCase().includes(search) ||
      (delivery.bon_commande?.fournisseur?.nom || '').toLowerCase().includes(search) ||
      (delivery.bon_commande?.fournisseur?.prenom || '').toLowerCase().includes(search) ||
      (delivery.bon_commande?.fournisseur?.societe || '').toLowerCase().includes(search) ||
      (delivery.bon_commande?.fournisseur?.numero_fournisseur || '').toLowerCase().includes(search) ||
      `${delivery.bon_commande?.fournisseur?.prenom || ''} ${delivery.bon_commande?.fournisseur?.nom || ''}`.toLowerCase().includes(search) ||
      `${delivery.bon_commande?.fournisseur?.nom || ''} ${delivery.bon_commande?.fournisseur?.prenom || ''}`.toLowerCase().includes(search) ||
      (delivery.numero_livraison || '').toLowerCase().includes(search) ||
      (delivery.bon_commande?.numero_commande || '').toLowerCase().includes(search)
    );
  };

  // Apply all filters
  const getFilteredDeliveries = () => {
    return deliveryNotes.filter(delivery => {
      return filterByDateRange(delivery.date_livraison) && filterBySearch(delivery);
    });
  };

  const filteredDeliveries = getFilteredDeliveries();

  // Calculate pagination
  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDeliveries = filteredDeliveries.slice(startIndex, endIndex);

  // Pagination functions
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
          <p className="text-gray-500">Chargement des données chauffeur...</p>
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
            onClick={fetchChauffeurData}
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
            <Truck className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {chauffeur.prenom} {chauffeur.nom}
              </h1>
              <p className="text-gray-600">{chauffeur.numero_chauffeur} - {chauffeur.immatricule}</p>
            </div>
          </div>
          
          {/* Chauffeur Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Contact</span>
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900">{chauffeur.telephone}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Véhicule assigné</span>
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900 font-mono">{chauffeur.immatricule}</p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Type</span>
              </div>
              <div className="mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  chauffeur.type_chauffeur === 'interne' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {chauffeur.type_chauffeur === 'interne' ? 'Interne' : 'Externe'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Livraisons</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDeliveries}</p>
              </div>
              <Truck className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Livrées</p>
                <p className="text-2xl font-bold text-green-600">{stats.deliveredCount}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En cours</p>
                <p className="text-2xl font-bold text-blue-600">{stats.pendingCount}</p>
              </div>
              <ShoppingBag className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Chiffre d'affaires</p>
                <p className="text-2xl font-bold text-purple-600">{formatPrice(stats.totalRevenue)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recherche et filtres</h3>
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
          {/* Text Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Rechercher client ou fournisseur
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                id="search"
                placeholder="Client, fournisseur, numéro..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Date From */}
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
          
          {/* Date To */}
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
        </div>
        
        {hasActiveFilters() && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800">
                <strong>{filteredDeliveries.length}</strong> livraison(s) trouvée(s) avec les filtres actifs
              </p>
              <p className="text-sm font-medium text-blue-900">
                Total filtré: {formatPrice(filteredDeliveries.reduce((sum, delivery) => sum + delivery.total_ht, 0))}
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
            <span className="text-sm text-gray-600">
              {filteredDeliveries.length} livraison(s)
              {hasActiveFilters() && ' (filtrées)'}
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Numéro BL
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  BC Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Fournisseur
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Date Livraison
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Véhicule
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentDeliveries.length > 0 ? (
                currentDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                      {delivery.numero_livraison}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {delivery.bon_commande?.numero_commande || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-orange-600">
                        {delivery.bon_commande?.fournisseur?.societe || 
                         `${delivery.bon_commande?.fournisseur?.prenom || ''} ${delivery.bon_commande?.fournisseur?.nom || ''}`.trim() || 'Non spécifié'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {delivery.bon_commande?.fournisseur?.numero_fournisseur || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {delivery.client?.societe || `${delivery.client?.prenom || ''} ${delivery.client?.nom || ''}`.trim() || 'Non spécifié'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {delivery.client?.numero_client || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(delivery.date_livraison).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded font-mono text-center">
                        {delivery.immatricule_utilise}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(delivery.statut)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(delivery.total_ht)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Truck className="w-8 h-8 text-gray-300 mb-2" />
                      <p>
                        {hasActiveFilters() 
                          ? 'Aucune livraison trouvée avec ces filtres' 
                          : 'Aucune livraison effectuée par ce chauffeur'
                        }
                      </p>
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
          <div className="text-sm text-gray-600">
            Affichage de {startIndex + 1} à {Math.min(endIndex, filteredDeliveries.length)} sur {filteredDeliveries.length} livraisons
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
    </div>
  );
};

export default ChauffeurDetails;