import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, Truck, FileText, Eye, Download, Printer, X, DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DeliveryNote {
  id: string;
  numero_livraison: string;
  date_livraison: string;
  statut: string;
  total_ht: number;
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
}

interface DeliveryNotesListProps {
  onNavigateToAdd: () => void;
  onNavigateToEdit: (note: DeliveryNote) => void;
}

const DeliveryNotesList: React.FC<DeliveryNotesListProps> = ({ onNavigateToAdd, onNavigateToEdit }) => {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
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
  const [selectedChauffeur, setSelectedChauffeur] = useState<string>('');
  const [chauffeurs, setChauffeurs] = useState<Array<{id: string, nom: string, prenom: string}>>([]);

  // Fetch delivery notes from Supabase
  const fetchDeliveryNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('bon_de_livraison')
        .select(`
          *,
          client:clients(nom, prenom, societe),
          chauffeur:chauffeurs(nom, prenom),
          bon_commande:bon_de_commande(numero_commande, fournisseur:fournisseurs(nom, prenom, societe))
        `)
        .neq('statut', 'annulee') // Exclude cancelled delivery notes from list
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setDeliveryNotes(data || []);

      // Extract unique chauffeurs for filter dropdown
      const uniqueChauffeurs = Array.from(
        new Map(
          (data || []).map(note => [
            note.chauffeur.nom + note.chauffeur.prenom,
            {
              id: note.chauffeur.nom + note.chauffeur.prenom,
              nom: note.chauffeur.nom,
              prenom: note.chauffeur.prenom
            }
          ])
        ).values()
      );
      setChauffeurs(uniqueChauffeurs);
    } catch (err: any) {
      console.error('Error fetching delivery notes:', err);
      setError('Erreur lors du chargement des bons de livraison');
    } finally {
      setLoading(false);
    }
  };

  // Load delivery notes on component mount
  React.useEffect(() => {
    fetchDeliveryNotes();
  }, []);

  const handleDateFilterChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    setDateFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setDateFilters({ dateFrom: '', dateTo: '' });
    setSelectedStatus('');
    setSelectedChauffeur('');
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return dateFilters.dateFrom || 
           dateFilters.dateTo || 
           selectedStatus || 
           selectedChauffeur;
  };

  // Filter by date range
  const filterByDateRange = (date: string) => {
    if (!dateFilters.dateFrom && !dateFilters.dateTo) return true;
    
    const itemDate = date;
    const fromMatch = !dateFilters.dateFrom || itemDate >= dateFilters.dateFrom;
    const toMatch = !dateFilters.dateTo || itemDate <= dateFilters.dateTo;
    
    return fromMatch && toMatch;
  };

  // Filter delivery notes based on search term
  const searchFilteredDeliveryNotes = deliveryNotes.filter(note =>
    {
      const search = searchTerm.toLowerCase();
      return (
        // Search in delivery note number
        note.numero_livraison.toLowerCase().includes(search) ||
        // Search in purchase order number
        note.bon_commande.numero_commande.toLowerCase().includes(search) ||
        // Search in client information
        note.client.nom.toLowerCase().includes(search) ||
        note.client.prenom.toLowerCase().includes(search) ||
        note.client.societe.toLowerCase().includes(search) ||
        // Full client name combinations
        `${note.client.prenom} ${note.client.nom}`.toLowerCase().includes(search) ||
        `${note.client.nom} ${note.client.prenom}`.toLowerCase().includes(search) ||
        // Search in chauffeur information
        note.chauffeur.nom.toLowerCase().includes(search) ||
        note.chauffeur.prenom.toLowerCase().includes(search) ||
        // Full chauffeur name combinations
        `${note.chauffeur.prenom} ${note.chauffeur.nom}`.toLowerCase().includes(search) ||
        `${note.chauffeur.nom} ${note.chauffeur.prenom}`.toLowerCase().includes(search) ||
        // Search in supplier (fournisseur) information
        (note.bon_commande.fournisseur?.nom || '').toLowerCase().includes(search) ||
        (note.bon_commande.fournisseur?.prenom || '').toLowerCase().includes(search) ||
        (note.bon_commande.fournisseur?.societe || '').toLowerCase().includes(search) ||
        (note.bon_commande.fournisseur?.numero_fournisseur || '').toLowerCase().includes(search) ||
        // Full supplier name combinations
        `${note.bon_commande.fournisseur?.prenom || ''} ${note.bon_commande.fournisseur?.nom || ''}`.toLowerCase().includes(search) ||
        `${note.bon_commande.fournisseur?.nom || ''} ${note.bon_commande.fournisseur?.prenom || ''}`.toLowerCase().includes(search)
      );
    }
  );

  // Apply all filters to search results
  const filteredDeliveryNotes = searchFilteredDeliveryNotes.filter(note => {
    const dateMatch = filterByDateRange(note.date_livraison);
    const statusMatch = !selectedStatus || note.statut === selectedStatus;
    const chauffeurMatch = !selectedChauffeur || 
      (note.chauffeur.nom + note.chauffeur.prenom) === selectedChauffeur;
    
    return dateMatch && statusMatch && chauffeurMatch;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredDeliveryNotes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDeliveryNotes = filteredDeliveryNotes.slice(startIndex, endIndex);

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
      'Numéro BL',
      'BC Source',
      'Date Livraison',
      'Fournisseur',
      'Client',
      'Chauffeur',
      'Statut',
      'Total (DH)',
      'Notes'
    ];

    const csvData = filteredDeliveryNotes.map(note => [
      note.numero_livraison,
      note.bon_commande.numero_commande,
      new Date(note.date_livraison).toLocaleDateString('fr-FR'),
      note.bon_commande.fournisseur?.societe || 
        `${note.bon_commande.fournisseur?.prenom || ''} ${note.bon_commande.fournisseur?.nom || ''}`.trim() || 'Non spécifié',
      note.client.societe || `${note.client.prenom} ${note.client.nom}`,
      `${note.chauffeur.prenom} ${note.chauffeur.nom}`,
      note.statut === 'en_preparation' ? 'En préparation' :
      note.statut === 'en_cours' ? 'En cours' :
      note.statut === 'livree' ? 'Livrée' :
      note.statut === 'annulee' ? 'Annulée' : note.statut,
      note.total_ht.toFixed(2),
      note.notes || ''
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Add totals row
    csvData.push([
      `TOTAUX (${filteredDeliveryNotes.length} livraisons)`,
      '', // BC Source
      '', // Date
      '', // Fournisseur
      '', // Client
      '', // Chauffeur
      '', // Statut
      totals.totalAmount.toFixed(2),
      '' // Notes
    ]);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bons_livraison_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate totals for filtered data
  const calculateTotals = () => {
    const deliveredNotes = filteredDeliveryNotes.filter(n => n.statut === 'livree');
    const pendingNotes = filteredDeliveryNotes.filter(n => n.statut !== 'livree' && n.statut !== 'annulee');
    const preparationNotes = filteredDeliveryNotes.filter(n => n.statut === 'en_preparation');
    const inProgressNotes = filteredDeliveryNotes.filter(n => n.statut === 'en_cours');

    return {
      totalAmount: filteredDeliveryNotes.reduce((sum, n) => sum + n.total_ht, 0),
      deliveredTotal: deliveredNotes.reduce((sum, n) => sum + n.total_ht, 0),
      pendingTotal: pendingNotes.reduce((sum, n) => sum + n.total_ht, 0),
      count: filteredDeliveryNotes.length,
      deliveredCount: deliveredNotes.length,
      pendingCount: pendingNotes.length,
      preparationCount: preparationNotes.length,
      inProgressCount: inProgressNotes.length
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
          <p className="text-gray-500">Chargement des bons de livraison...</p>
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
            onClick={fetchDeliveryNotes}
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
          <h1 className="text-3xl font-bold text-gray-900">Bons de livraison</h1>
          <p className="text-gray-600 mt-1">Gérez vos livraisons clients</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            Exporter CSV ({filteredDeliveryNotes.length})
          </button>
          <button
            onClick={() => window.print()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Printer className="w-4 h-4" />
            Imprimer ({filteredDeliveryNotes.length})
          </button>
          <button
            onClick={onNavigateToAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors duration-200 shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Créer un bon de livraison
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Livraisons</p>
              <p className="text-2xl font-bold text-gray-900">{totals.count}</p>
              <p className="text-sm font-medium text-blue-600">{formatPrice(totals.totalAmount)}</p>
            </div>
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Livrées</p>
              <p className="text-2xl font-bold text-green-600">{totals.deliveredCount}</p>
              <p className="text-sm font-medium text-green-600">{formatPrice(totals.deliveredTotal)}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En Cours</p>
              <p className="text-2xl font-bold text-blue-600">{totals.pendingCount}</p>
              <p className="text-sm font-medium text-blue-600">{formatPrice(totals.pendingTotal)}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En Préparation</p>
              <p className="text-2xl font-bold text-yellow-600">{totals.preparationCount}</p>
              <p className="text-sm font-medium text-yellow-600">À traiter</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par numéro, client ou chauffeur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Filter Controls */}
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
              <option value="en_preparation">En préparation</option>
              <option value="en_cours">En cours</option>
              <option value="livree">Livrée</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>

          <div>
            <label htmlFor="chauffeur-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Chauffeur
            </label>
            <select
              id="chauffeur-filter"
              value={selectedChauffeur}
              onChange={(e) => {
                setSelectedChauffeur(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">Tous les chauffeurs</option>
              {chauffeurs.map((chauffeur) => (
                <option key={chauffeur.id} value={chauffeur.id}>
                  {chauffeur.prenom} {chauffeur.nom}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {hasActiveFilters() && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800">
                <strong>{filteredDeliveryNotes.length}</strong> bon(s) de livraison trouvé(s) avec les filtres actifs
              </p>
              <p className="text-sm font-medium text-blue-900">
                Total filtré: {formatPrice(filteredDeliveryNotes.reduce((sum, note) => sum + note.total_ht, 0))}
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
                  Numéro BL
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Bon de commande
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Fournisseur
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Client
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
                  Total
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentDeliveryNotes.length > 0 ? (
                currentDeliveryNotes.map((note) => (
                  <tr 
                    key={note.id} 
                    onClick={() => onNavigateToEdit(note)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {note.numero_livraison}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {note.bon_commande.numero_commande}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {note.bon_commande.fournisseur?.societe || `${note.bon_commande.fournisseur?.prenom} ${note.bon_commande.fournisseur?.nom}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {note.client.societe}
                      </div>
                      <div className="text-sm text-gray-500">
                        {note.client.prenom} {note.client.nom}
                      </div>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(note.total_ht)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToEdit(note);
                        }}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Voir
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Truck className="w-8 h-8 text-gray-300 mb-2" />
                      <p>{searchTerm ? 'Aucun bon de livraison trouvé' : 'Aucun bon de livraison disponible'}</p>
                      {!searchTerm && (
                        <button
                          onClick={onNavigateToAdd}
                          className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Créer votre premier bon de livraison
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
              Affichage de {startIndex + 1} à {Math.min(endIndex, filteredDeliveryNotes.length)} sur {filteredDeliveryNotes.length} bons de livraison
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
          <p className="text-lg text-gray-700 mt-2">LISTE DES BONS DE LIVRAISON</p>
          <p className="text-sm text-gray-600 mt-2">
            Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')} | 
            {filteredDeliveryNotes.length} livraison(s) | Total: {formatPrice(totals.totalAmount)}
          </p>
        </div>

        {/* Print Table */}
        <table className="w-full border-collapse border border-gray-800">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">N° BL</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">BC Source</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Fournisseur</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Client</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Chauffeur</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Date</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Statut</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeliveryNotes.map((note) => (
              <tr key={note.id}>
                <td className="border border-gray-800 px-3 py-2 text-sm">{note.numero_livraison}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm font-mono">{note.bon_commande.numero_commande}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm">
                  {note.bon_commande.fournisseur?.societe || 
                   `${note.bon_commande.fournisseur?.prenom || ''} ${note.bon_commande.fournisseur?.nom || ''}`.trim() || 'Non spécifié'}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm">
                  {note.client.societe || `${note.client.prenom} ${note.client.nom}`}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm">
                  {note.chauffeur.prenom} {note.chauffeur.nom}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm">
                  {new Date(note.date_livraison).toLocaleDateString('fr-FR')}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm">
                  {note.statut === 'en_preparation' ? 'En préparation' :
                   note.statut === 'en_cours' ? 'En cours' :
                   note.statut === 'livree' ? 'Livrée' :
                   note.statut === 'annulee' ? 'Annulée' : note.statut}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm text-right font-medium">
                  {formatPrice(note.total_ht)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td className="border border-gray-800 px-3 py-3 font-bold text-sm" colSpan={7}>
                TOTAUX ({filteredDeliveryNotes.length} livraisons)
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

export default DeliveryNotesList;