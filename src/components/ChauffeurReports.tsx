import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Calendar, 
  Printer, 
  Download,
  FileText,
  DollarSign,
  Search,
  ArrowLeft,
  TrendingUp,
  AlertCircle,
  Users,
  Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Chauffeur {
  id: string;
  numero_chauffeur: string;
  nom: string;
  prenom: string;
  telephone: string;
  immatricule: string;
  type_chauffeur: string;
}

interface DeliveryReport {
  id: string;
  numero_livraison: string;
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

interface Payment {
  id: string;
  montant: number;
  mode_paiement: string;
  date_paiement: string;
}

const ChauffeurReports: React.FC = () => {
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([]);
  const [selectedChauffeur, setSelectedChauffeur] = useState<Chauffeur | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryReport[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [dateFilters, setDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });

  // Local state for date inputs to prevent immediate re-renders
  const [localDateFilters, setLocalDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchChauffeurs();
  }, []);

  useEffect(() => {
    if (selectedChauffeur) {
      fetchChauffeurDeliveries();
    }
  }, [selectedChauffeur, dateFilters]);

  const fetchChauffeurs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: chauffeursData, error: chauffeursError } = await supabase
        .from('chauffeurs')
        .select('*')
        .order('nom', { ascending: true });

      if (chauffeursError) throw chauffeursError;
      setChauffeurs(chauffeursData || []);
    } catch (err: any) {
      console.error('Error fetching chauffeurs:', err);
      setError('Erreur lors du chargement des chauffeurs');
    } finally {
      setLoading(false);
    }
  };

  const fetchChauffeurDeliveries = async () => {
    if (!selectedChauffeur) return;

    try {
      setLoading(true);
      setError(null);

      // Build date filters for deliveries
      let deliveriesQuery = supabase
        .from('bon_de_livraison')
        .select(`
          *,
          client:clients(nom, prenom, societe, numero_client),
          bon_commande:bon_de_commande(
            numero_commande,
            fournisseur:fournisseurs(nom, prenom, societe, numero_fournisseur)
          )
        `)
        .eq('chauffeur_id', selectedChauffeur.id)
        .neq('statut', 'annulee') // Exclude cancelled delivery notes
        .order('date_livraison', { ascending: false });

      if (dateFilters.dateFrom) {
        deliveriesQuery = deliveriesQuery.gte('date_livraison', dateFilters.dateFrom);
      }
      if (dateFilters.dateTo) {
        deliveriesQuery = deliveriesQuery.lte('date_livraison', dateFilters.dateTo);
      }

      const { data: deliveriesData, error: deliveriesError } = await deliveriesQuery;
      if (deliveriesError) throw deliveriesError;

      setDeliveries(deliveriesData || []);

      // Get payments for this chauffeur in the selected period
      let paymentsQuery = supabase
        .from('paiements_chauffeurs')
        .select('*')
        .eq('chauffeur_id', selectedChauffeur.id);

      if (dateFilters.dateFrom) {
        paymentsQuery = paymentsQuery.gte('date_paiement', dateFilters.dateFrom);
      }
      if (dateFilters.dateTo) {
        paymentsQuery = paymentsQuery.lte('date_paiement', dateFilters.dateTo);
      }

      const { data: paymentsData } = await paymentsQuery;
      setPayments(paymentsData || []);
    } catch (err: any) {
      console.error('Error fetching chauffeur deliveries:', err);
      setError('Erreur lors du chargement des livraisons');
    } finally {
      setLoading(false);
    }
  };

  const handleChauffeurSelect = (chauffeur: Chauffeur) => {
    setSelectedChauffeur(chauffeur);
    setSearchTerm('');
  };

  // Handle local date input changes (doesn't trigger re-render)
  const handleLocalDateChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    setLocalDateFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Apply filters when user finishes date selection (onBlur)
  const handleDateFilterApply = (field: 'dateFrom' | 'dateTo', value: string) => {
    setDateFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setDateFilters({
      dateFrom: '',
      dateTo: ''
    });
    setLocalDateFilters({
      dateFrom: '',
      dateTo: ''
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = () => {
    if (!selectedChauffeur) return;

    const csvHeaders = [
      'Date',
      'BL number', 
      'Supplier',
      'Client',
      'Total'
    ];

    const csvData = deliveries.map(delivery => [
      new Date(delivery.date_livraison).toLocaleDateString('fr-FR'),
      delivery.numero_livraison,
      delivery.numero_livraison,
      delivery.bon_commande?.fournisseur?.societe || 
        `${delivery.bon_commande?.fournisseur?.prenom || ''} ${delivery.bon_commande?.fournisseur?.nom || ''}`.trim() || 'Non spécifié',
      delivery.client?.societe || `${delivery.client?.prenom || ''} ${delivery.client?.nom || ''}`.trim() || 'Non spécifié',
      delivery.total_ht.toFixed(2)
    ]);

    // Add totals row
    csvData.push([
      '', // Client
      '',
      `TOTAUX (${deliveries.length} livraisons)`,
      totals.totalDeliveries.toFixed(2)
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `livraisons_chauffeur_${selectedChauffeur.prenom}_${selectedChauffeur.nom}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter chauffeurs based on search term
  const filteredChauffeurs = chauffeurs.filter(chauffeur =>
    chauffeur.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chauffeur.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chauffeur.numero_chauffeur.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chauffeur.telephone.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  // Calculate totals for selected period
  const calculateTotals = () => {
    const totalDeliveries = deliveries.reduce((sum, delivery) => sum + delivery.total_ht, 0);
    const totalPaymentsAmount = payments.reduce((sum, payment) => sum + payment.montant, 0);
    const deliveriesCount = deliveries.length;
    const completedDeliveries = deliveries.filter(d => d.statut === 'livree').length;
    
    return {
      totalDeliveries,
      totalPayments: totalPaymentsAmount,
      deliveriesCount,
      completedDeliveries
    };
  };

  const totals = calculateTotals();

  const getDateRangeText = () => {
    if (dateFilters.dateFrom && dateFilters.dateTo) {
      return `Du ${new Date(dateFilters.dateFrom).toLocaleDateString('fr-FR')} au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`;
    } else if (dateFilters.dateFrom) {
      return `À partir du ${new Date(dateFilters.dateFrom).toLocaleDateString('fr-FR')}`;
    } else if (dateFilters.dateTo) {
      return `Jusqu'au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`;
    }
    return 'Toutes les périodes';
  };

  // Sync local state with filters when they change externally (like clear filters)
  useEffect(() => {
    setLocalDateFilters(dateFilters);
  }, [dateFilters]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Chargement...</p>
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
            onClick={() => selectedChauffeur ? fetchChauffeurDeliveries() : fetchChauffeurs()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // If no chauffeur is selected, show chauffeur selection
  if (!selectedChauffeur) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-600" />
              Rapport Chauffeurs
            </h1>
            <p className="text-gray-600 mt-1">Sélectionnez un chauffeur pour voir ses livraisons</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un chauffeur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Chauffeurs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredChauffeurs.map((chauffeur) => (
            <div
              key={chauffeur.id}
              onClick={() => handleChauffeurSelect(chauffeur)}
              className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <Truck className="w-8 h-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{chauffeur.prenom} {chauffeur.nom}</h3>
                  <p className="text-sm text-gray-600">{chauffeur.numero_chauffeur}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-900 font-mono">{chauffeur.immatricule}</p>
                <p className="text-sm text-gray-600">{chauffeur.telephone}</p>
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
          ))}
        </div>

        {filteredChauffeurs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Truck className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>Aucun chauffeur trouvé</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header - Hidden in print */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedChauffeur(null)}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-600" />
              Livraisons - {selectedChauffeur.prenom} {selectedChauffeur.nom}
            </h1>
            <p className="text-gray-600 mt-1">{selectedChauffeur.numero_chauffeur} - {selectedChauffeur.immatricule}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
          <button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
        </div>
      </div>

      {/* Print Header - Only visible in print */}
      <div className="hidden print:block mb-8">
        <div className="relative text-center border-b-2 border-gray-300 pb-4">
          <img 
            src="https://pub-237d2da54b564d23aaa1c3826e1d4e65.r2.dev/ANTURGOOD/logo2.png" 
            alt="ANTURGOOD Logo" 
            className="absolute top-0 left-0 h-24 w-auto"
          />
          <h2 className="text-xl font-semibold text-gray-700 mt-2">Rapport Livraisons Chauffeur - {selectedChauffeur?.prenom} {selectedChauffeur?.nom}</h2>
        </div>
      </div>

      {/* Filters - Hidden in print */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 print:hidden">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Filtres de période
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-2">
              Date début
            </label>
            <input
              type="date"
              id="date-from"
              value={localDateFilters.dateFrom}
              onChange={(e) => handleLocalDateChange('dateFrom', e.target.value)}
              onBlur={(e) => handleDateFilterApply('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-2">
              Date fin
            </label>
            <input
              type="date"
              id="date-to"
              value={localDateFilters.dateTo}
              onChange={(e) => handleLocalDateChange('dateTo', e.target.value)}
              onBlur={(e) => handleDateFilterApply('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Effacer les filtres
            </button>
          </div>
        </div>
        
        {(dateFilters.dateFrom || dateFilters.dateTo) && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Période active:</strong> {getDateRangeText()}
            </p>
          </div>
        )}
      </div>

      {/* Summary Cards - Hidden in print */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 print:hidden">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Livraisons</p>
              <p className="text-2xl font-bold text-gray-900">{totals.deliveriesCount}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Terminées</p>
              <p className="text-2xl font-bold text-green-600">{totals.completedDeliveries}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold text-blue-600">{formatPrice(totals.totalDeliveries)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paiements Reçus</p>
              <p className="text-2xl font-bold text-green-600">{formatPrice(totals.totalPayments)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Rapport livraisons chauffeur</h2>
            <span className="text-sm text-gray-600">
              {deliveries.length} livraison(s)
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full print:text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  BL number
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deliveries.length > 0 ? (
                deliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(delivery.date_livraison).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{delivery.numero_livraison}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {delivery.bon_commande?.fournisseur?.societe || 
                       `${delivery.bon_commande?.fournisseur?.prenom || ''} ${delivery.bon_commande?.fournisseur?.nom || ''}`.trim() || 'Non spécifié'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {delivery.client?.societe || `${delivery.client?.prenom || ''} ${delivery.client?.nom || ''}`.trim() || 'Non spécifié'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(delivery.total_ht)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <FileText className="w-8 h-8 text-gray-300 mb-2" />
                      <p>Aucune livraison pour la période sélectionnée</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            
            {/* Totals Footer */}
            {deliveries.length > 0 && (
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr className="font-semibold">
                  <td className="px-4 py-4 text-sm font-bold text-gray-900" colSpan={4}>
                    TOTAUX ({totals.deliveriesCount} livraisons)
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-blue-600">
                    {formatPrice(totals.totalDeliveries)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          @page {
            margin: 15px;
            size: A4 portrait;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
          
          /* Hide everything except the table container and its content */
          * {
            visibility: hidden;
          }
          
          /* Show only the main content container and table */
          .h-full,
          .flex-1:last-child,
          .flex-1:last-child *,
          .hidden.print\\:block,
          .hidden.print\\:block * {
            visibility: visible;
          }
          
          /* Reset layout for print */
          .h-full {
            height: auto !important;
            display: block !important;
            position: static !important;
          }
          
          .flex-1:last-child {
            width: 100% !important;
            margin: 0 !important;
            padding: 15px !important;
            background: white !important;
            color: black !important;
          }
          
          /* Table styling for print */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 20px !important;
          }
          
          th, td {
            border: 1px solid #000 !important;
            padding: 8px !important;
            text-align: left !important;
          }
          
          th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
          }
          
          tr {
            page-break-inside: avoid;
          }
          
          thead {
            display: table-header-group;
          }
          
          tfoot {
            display: table-footer-group;
            page-break-inside: avoid;
            font-weight: bold !important;
          }
          
          /* Hide any remaining layout elements */
          nav, aside, button, .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ChauffeurReports;