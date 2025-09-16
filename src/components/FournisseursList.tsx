import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Download, 
  Printer, 
  X,
  Building2,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
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
  total_commandes: number;
  total_paiements: number;
  current_debt: number;
  available_credit: number;
  created_at: string;
}

interface FournisseursListProps {
  onNavigateToAdd: () => void;
  onNavigateToEdit: (fournisseur: Fournisseur) => void;
  onNavigateToDetails: (fournisseur: Fournisseur) => void;
}

const FournisseursList: React.FC<FournisseursListProps> = ({ onNavigateToAdd, onNavigateToEdit, onNavigateToDetails }) => {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [dateFilters, setDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });

  // Fetch fournisseurs from Supabase
  const fetchFournisseurs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('fournisseurs')
        .select(`
          id,
          numero_fournisseur,
          nom,
          prenom,
          societe,
          ice,
          email,
          telephone,
          created_at,
          updated_at
        `)
        .order('societe', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      const fournisseursWithFinances = await Promise.all(
        (data || []).map(async (fournisseur) => {
          // Get total orders amount (excluding cancelled orders)
          const { data: ordersData, error: ordersError } = await supabase
            .from('bon_de_commande')
            .select('total_ht')
            .eq('fournisseur_id', fournisseur.id)
            .neq('statut', 'annulee'); // Exclude cancelled orders

          if (ordersError) {
            console.error('Error fetching orders for supplier:', fournisseur.id, ordersError);
          }

          // Get total payments amount
          const { data: paymentsData, error: paymentsError } = await supabase
            .from('paiements_fournisseurs')
            .select('montant')
            .eq('fournisseur_id', fournisseur.id);

          if (paymentsError) {
            console.error('Error fetching payments for supplier:', fournisseur.id, paymentsError);
          }

          const totalCommandes = (ordersData || []).reduce((sum, order) => sum + (order.total_ht || 0), 0);
          const totalPaiements = (paymentsData || []).reduce((sum, payment) => sum + (payment.montant || 0), 0);
          const ourDebt = totalCommandes - totalPaiements;
          const currentDebt = Math.max(0, ourDebt); // Amount we owe to supplier
          const availableCredit = Math.max(0, -ourDebt); // Advance supplier has received

          return {
            ...fournisseur,
            total_commandes: totalCommandes,
            total_paiements: totalPaiements,
            current_debt: currentDebt,
            available_credit: availableCredit
          };
        })
      );

      // Sort by debt descending (highest amounts owed first), then by available credit descending
      fournisseursWithFinances.sort((a, b) => {
        const debtDiff = (b.current_debt || 0) - (a.current_debt || 0);
        if (debtDiff !== 0) return debtDiff;
        return (b.available_credit || 0) - (a.available_credit || 0);
      });
      
      setFournisseurs(fournisseursWithFinances);
    } catch (err: any) {
      console.error('Error fetching fournisseurs:', err);
      setError('Erreur lors du chargement des fournisseurs');
    } finally {
      setLoading(false);
    }
  };

  // Load fournisseurs on component mount
  React.useEffect(() => {
    fetchFournisseurs();
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

  // Filter by date range (supplier creation date)
  const filterByDateRange = (date: string) => {
    if (!dateFilters.dateFrom && !dateFilters.dateTo) return true;
    
    const itemDate = date.split('T')[0]; // Extract date part
    const fromMatch = !dateFilters.dateFrom || itemDate >= dateFilters.dateFrom;
    const toMatch = !dateFilters.dateTo || itemDate <= dateFilters.dateTo;
    
    return fromMatch && toMatch;
  };

  // Filter fournisseurs based on search term
  const searchFilteredFournisseurs = fournisseurs.filter(fournisseur =>
    fournisseur.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fournisseur.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fournisseur.societe.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fournisseur.numero_fournisseur.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fournisseur.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Apply date filter to search results
  const filteredFournisseurs = searchFilteredFournisseurs.filter(fournisseur => 
    filterByDateRange(fournisseur.created_at)
  );

  // Calculate pagination
  const totalPages = Math.ceil(filteredFournisseurs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFournisseurs = filteredFournisseurs.slice(startIndex, endIndex);

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

  const handleFournisseurClick = (fournisseur: Fournisseur) => {
    onNavigateToEdit(fournisseur);
  };

  const exportToCSV = () => {
    const csvHeaders = [
      'Numéro Fournisseur',
      'Nom',
      'Prénom',
      'Société',
      'ICE',
      'Email',
      'Téléphone',
      'Total Commandes (DH)',
      'Paiements (DH)',
      'Crédit (DH)',
      'Avance (DH)',
      'Date Création'
    ];

    const csvData = filteredFournisseurs.map(fournisseur => [
      fournisseur.numero_fournisseur,
      fournisseur.nom,
      fournisseur.prenom,
      fournisseur.societe,
      fournisseur.ice,
      fournisseur.email,
      fournisseur.telephone,
      fournisseur.total_commandes.toFixed(2),
      fournisseur.total_paiements.toFixed(2),
      fournisseur.current_debt.toFixed(2),
      fournisseur.available_credit.toFixed(2),
      new Date(fournisseur.created_at).toLocaleDateString('fr-FR')
    ]);

    // Add totals row
    const totals = calculateTotals();
    csvData.push([
      `TOTAUX (${filteredFournisseurs.length} fournisseurs)`,
      '', // Nom
      '', // Prénom
      '', // Société
      '', // ICE
      '', // Email
      '', // Téléphone
      totals.totalCommandes.toFixed(2),
      totals.totalPaiements.toFixed(2),
      totals.totalCredit.toFixed(2),
      totals.totalAvance.toFixed(2),
      '' // Date
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fournisseurs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate totals for filtered data
  const calculateTotals = () => {
    return {
      totalCommandes: filteredFournisseurs.reduce((sum, f) => sum + (f.total_commandes || 0), 0),
      totalPaiements: filteredFournisseurs.reduce((sum, f) => sum + (f.total_paiements || 0), 0),
      totalCredit: filteredFournisseurs.reduce((sum, f) => sum + (f.current_debt || 0), 0),
      totalAvance: filteredFournisseurs.reduce((sum, f) => sum + (f.available_credit || 0), 0),
      count: filteredFournisseurs.length
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
          <p className="text-gray-500">Chargement des fournisseurs...</p>
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
            onClick={fetchFournisseurs}
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
          <h1 className="text-3xl font-bold text-gray-900">Fournisseurs</h1>
          <p className="text-gray-600 mt-1">Gérez vos fournisseurs et leurs informations</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            Exporter CSV ({filteredFournisseurs.length})
          </button>
          <button
            onClick={() => window.print()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Printer className="w-4 h-4" />
            Imprimer ({filteredFournisseurs.length})
          </button>
          <button
            onClick={onNavigateToAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors duration-200"
          >
            <Plus className="w-5 h-5" />
            Ajouter un fournisseur
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Commandes</p>
              <p className="text-2xl font-bold text-blue-600">{formatPrice(totals.totalCommandes)}</p>
              <p className="text-xs text-gray-500">Montant commandé</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paiements</p>
              <p className="text-2xl font-bold text-green-600">{formatPrice(totals.totalPaiements)}</p>
              <p className="text-xs text-gray-500">Total payé</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Crédit Fournisseur</p>
              <p className="text-2xl font-bold text-red-600">{formatPrice(totals.totalCredit)}</p>
              <p className="text-xs text-gray-500">Dû aux fournisseurs</p>
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
            placeholder="Rechercher un fournisseur..."
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
              Fournisseur depuis (début)
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
              Fournisseur depuis (fin)
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
                <strong>{filteredFournisseurs.length}</strong> fournisseur(s) trouvé(s) avec les filtres actifs
              </p>
              <p className="text-sm font-medium text-blue-900">
                Total commandes: {formatPrice(totals.totalCommandes)}
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
                  Numéro Fournisseur
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
                  Total Commandes
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Paiements
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Crédit Fournisseur
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
              {currentFournisseurs.length > 0 ? (
                currentFournisseurs.map((fournisseur) => (
                  <tr 
                    key={fournisseur.id} 
                    onClick={() => onNavigateToDetails(fournisseur)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {fournisseur.numero_fournisseur}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {fournisseur.prenom} {fournisseur.nom}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {fournisseur.societe}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {fournisseur.telephone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(fournisseur.total_commandes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatPrice(fournisseur.total_paiements)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                      {formatPrice(fournisseur.current_debt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-600">
                      {formatPrice(fournisseur.available_credit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFournisseurClick(fournisseur);
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
                      <p>{searchTerm ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur disponible'}</p>
                      {!searchTerm && (
                        <button
                          onClick={onNavigateToAdd}
                          className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Ajouter votre premier fournisseur
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
              Affichage de {startIndex + 1} à {Math.min(endIndex, filteredFournisseurs.length)} sur {filteredFournisseurs.length} fournisseurs
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
          <p className="text-lg text-gray-700 mt-2">LISTE DES FOURNISSEURS</p>
          <p className="text-sm text-gray-600 mt-2">
            Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')} | 
            {filteredFournisseurs.length} fournisseur(s)
          </p>
        </div>

        {/* Print Table */}
        <table className="w-full border-collapse border border-gray-800">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">N° Fournisseur</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Nom & Prénom</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Société</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Téléphone</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Commandes (DH)</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Paiements (DH)</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Crédit (DH)</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Avance (DH)</th>
            </tr>
          </thead>
          <tbody>
            {filteredFournisseurs.map((fournisseur) => (
              <tr key={fournisseur.id}>
                <td className="border border-gray-800 px-3 py-2 text-sm">{fournisseur.numero_fournisseur}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm">{fournisseur.prenom} {fournisseur.nom}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm">{fournisseur.societe}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm">{fournisseur.telephone}</td>
                <td className="border border-gray-800 px-3 py-2 text-sm text-right font-medium">
                  {formatPrice(fournisseur.total_commandes)}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm text-right font-medium">
                  {formatPrice(fournisseur.total_paiements)}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm text-right font-medium">
                  {formatPrice(fournisseur.current_debt)}
                </td>
                <td className="border border-gray-800 px-3 py-2 text-sm text-right font-medium">
                  {formatPrice(fournisseur.available_credit)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td className="border border-gray-800 px-3 py-3 font-bold text-sm" colSpan={4}>
                TOTAUX ({filteredFournisseurs.length} fournisseurs)
              </td>
              <td className="border border-gray-800 px-3 py-3 text-right font-bold text-sm">
                {formatPrice(totals.totalCommandes)}
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

export default FournisseursList;