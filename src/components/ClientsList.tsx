import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Download, 
  Printer, 
  X,
  Users,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
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
  total_margin: number;
  created_at: string;
}

interface ClientsListProps {
  onNavigateToAdd: () => void;
  onNavigateToEdit: (client: Client) => void;
  onNavigateToDetails: (client: Client) => void;
}

const ClientsList: React.FC<ClientsListProps> = ({ onNavigateToAdd, onNavigateToEdit, onNavigateToDetails }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [dateFilters, setDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });

  // Fetch clients from Supabase
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
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
        .order('societe', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      const clientsData = data || [];

      // Sort by debt descending (highest unpaid amounts first)
      clientsData.sort((a, b) => (b.current_debt || 0) - (a.current_debt || 0));
      
      setClients(clientsData);
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setError('Erreur lors du chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  // Load clients on component mount
  React.useEffect(() => {
    fetchClients();
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
    setCurrentPage(1);
  };

  const hasActiveFilters = () => {
    return searchTerm || dateFilters.dateFrom || dateFilters.dateTo;
  };

  // Filter by date range (client creation date)
  const filterByDateRange = (date: string) => {
    if (!dateFilters.dateFrom && !dateFilters.dateTo) return true;
    
    const itemDate = date.split('T')[0]; // Extract date part
    const fromMatch = !dateFilters.dateFrom || itemDate >= dateFilters.dateFrom;
    const toMatch = !dateFilters.dateTo || itemDate <= dateFilters.dateTo;
    
    return fromMatch && toMatch;
  };

  // Filter clients based on search term and date range
  const searchFilteredClients = clients.filter(client =>
    client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.societe.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.numero_client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Apply date filter to search results
  const filteredClients = searchFilteredClients.filter(client => 
    filterByDateRange(client.created_at)
  );

  // Calculate pagination
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClients = filteredClients.slice(startIndex, endIndex);

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

  const handleClientClick = (client: Client) => {
    onNavigateToEdit(client);
  };

  const exportToCSV = () => {
    const csvHeaders = [
      'Numéro Client',
      'Nom',
      'Prénom',
      'Société',
      'ICE',
      'Email',
      'Téléphone',
      'Chiffre d\'Affaires (DH)',
      'Paiements (DH)',
      'Crédit (DH)',
      'Avance (DH)',
      'Marge (DH)',
      'Date Création'
    ];

    const csvData = filteredClients.map(client => [
      client.numero_client,
      client.nom,
      client.prenom,
      client.societe,
      client.ice,
      client.email,
      client.telephone,
      client.chiffre_affaires.toFixed(2),
      client.total_paiements.toFixed(2),
      client.current_debt.toFixed(2),
      client.available_credit.toFixed(2),
      client.total_margin.toFixed(2),
      new Date(client.created_at).toLocaleDateString('fr-FR')
    ]);

    // Add totals row
    const totals = calculateTotals();
    csvData.push([
      `TOTAUX (${filteredClients.length} clients)`,
      '', // Nom
      '', // Prénom
      '', // Société
      '', // ICE
      '', // Email
      '', // Téléphone
      totals.totalChiffreAffaires.toFixed(2),
      totals.totalPaiements.toFixed(2),
      totals.totalCredit.toFixed(2),
      totals.totalAvance.toFixed(2),
      totals.totalMarge.toFixed(2),
      '' // Date
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clients_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate totals for filtered data
  const calculateTotals = () => {
    return {
      totalChiffreAffaires: filteredClients.reduce((sum, c) => sum + (c.chiffre_affaires || 0), 0),
      totalPaiements: filteredClients.reduce((sum, c) => sum + (c.total_paiements || 0), 0),
      totalCredit: filteredClients.reduce((sum, c) => sum + (c.current_debt || 0), 0),
      totalAvance: filteredClients.reduce((sum, c) => sum + (c.available_credit || 0), 0),
      totalMarge: filteredClients.reduce((sum, c) => sum + (c.total_margin || 0), 0),
      count: filteredClients.length
    };
  };

  const totals = calculateTotals();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-MA', {
      minimumFractionDigits: 2,
      useGrouping: false
    }).format(price) + ' DH';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Chargement des clients...</p>
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
            onClick={fetchClients}
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
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">Gérez vos clients et leurs informations</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            Exporter CSV ({filteredClients.length})
          </button>
          <button
            onClick={() => window.print()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Printer className="w-4 h-4" />
            Imprimer ({filteredClients.length})
          </button>
          <button
            onClick={onNavigateToAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors duration-200"
          >
            <Plus className="w-5 h-5" />
            Ajouter un client
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold text-blue-600">{formatPrice(totals.totalChiffreAffaires)}</p>
              <p className="text-xs text-gray-500">Total CA clients</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paiements</p>
              <p className="text-2xl font-bold text-green-600">{formatPrice(totals.totalPaiements)}</p>
              <p className="text-xs text-gray-500">Total encaissé</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Crédit</p>
              <p className="text-2xl font-bold text-red-600">{formatPrice(totals.totalCredit)}</p>
              <p className="text-xs text-gray-500">Dû par clients</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avance à consommer</p>
              <p className="text-2xl font-bold text-purple-600">{formatPrice(totals.totalAvance)}</p>
              <p className="text-xs text-gray-500">Crédit disponible</p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un client..."
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-1">
              Client depuis (début)
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
              Client depuis (fin)
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
              onClick={clearAllFilters}
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
                <strong>{filteredClients.length}</strong> client(s) trouvé(s) avec les filtres actifs
              </p>
              <p className="text-sm font-medium text-blue-900">
                CA total: {formatPrice(totals.totalChiffreAffaires)}
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
                  Numéro Client
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Nom & Prénom
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Société
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Chiffre d'Affaires
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Paiements
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Crédit
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Avance à consommer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentClients.length > 0 ? (
                currentClients.map((client) => (
                  <tr 
                    key={client.id} 
                    onClick={() => onNavigateToDetails(client)}
                    className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {client.numero_client}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {client.prenom} {client.nom}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {client.societe}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {client.telephone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(client.chiffre_affaires)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {formatPrice(client.total_paiements)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                      {formatPrice(client.current_debt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                      {formatPrice(client.available_credit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClientClick(client);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Search className="w-8 h-8 text-gray-300 mb-2" />
                      <p>{searchTerm ? 'Aucun client trouvé' : 'Aucun client disponible'}</p>
                      {!searchTerm && (
                        <button
                          onClick={onNavigateToAdd}
                          className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Ajouter votre premier client
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
              Affichage de {startIndex + 1} à {Math.min(endIndex, filteredClients.length)} sur {filteredClients.length} clients
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

      {/* Print-only content */}
      <div className="hidden print:block fixed inset-0 bg-white p-8">
        {/* Print Header */}
        <div className="relative text-center border-b-2 border-gray-800 pb-6 mb-8">
          <img 
            src="https://pub-237d2da54b564d23aaa1c3826e1d4e65.r2.dev/ANTURGOOD/logo2.png" 
            alt="ANTURGOOD Logo" 
            className="absolute top-0 left-0 h-24 w-auto"
          />
          <p className="text-lg text-gray-700 mt-2">LISTE DES CLIENTS</p>
          <p className="text-sm text-gray-600 mt-2">
            Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')} | 
            {filteredClients.length} client(s)
          </p>
        </div>

        {/* Print Table */}
        <table className="w-full border-collapse border border-gray-800">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">N° Client</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Nom & Prénom</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Société</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Téléphone</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">CA (DH)</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Paiements (DH)</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Crédit (DH)</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Avance (DH)</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => (
              <tr key={client.id}>
                <td className="border border-gray-800 px-3 py-2 text-sm">{client.numero_client}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm">{client.prenom} {client.nom}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm">{client.societe}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm">{client.telephone}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm text-right font-medium">
                  {formatPrice(client.chiffre_affaires)}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm text-right font-medium">
                  {formatPrice(client.total_paiements)}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm text-right font-medium">
                  {formatPrice(client.current_debt)}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm text-right font-medium">
                  {formatPrice(client.available_credit)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td className="border border-gray-800 px-3 py-3 font-bold text-sm" colSpan={4}>
                TOTAUX ({filteredClients.length} clients)
              </td>
              <td className="border border-gray-800 px-3 py-3 text-right font-bold text-sm">
                {formatPrice(totals.totalChiffreAffaires)}
              </td>
              <td className="border border-gray-800 px-3 py-3 text-right font-bold text-sm">
                {formatPrice(totals.totalPaiements)}
              </td>
              <td className="border border-gray-800 px-3 py-3 text-right font-bold text-sm">
                {formatPrice(totals.totalCredit)}
              </td>
              <td className="border border-gray-800 px-3 py-3 text-right font-bold text-sm">
                {formatPrice(totals.totalAvance)}
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

export default ClientsList;