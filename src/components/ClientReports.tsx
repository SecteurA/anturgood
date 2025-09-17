import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Printer, 
  Download,
  FileText,
  DollarSign,
  Search,
  ArrowLeft,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Client {
  id: string;
  numero_client: string;
  nom: string;
  prenom: string;
  societe: string;
  email: string;
  telephone: string;
}

interface DeliveryReport {
  id: string;
  numero_livraison: string;
  date_livraison: string;
  statut: string;
  total_ht: number;
  notes: string | null;
  items: Array<{
    id: string;
    quantite_livree: number;
    quantite_pieces: number;
    quantite_unitaire: number;
    prix_unitaire: number;
    total_ligne: number;
    produit: {
      nom_produit: string;
      prix_achat: number;
      unite: string;
    };
  }>;
  bon_commande: {
    numero_commande: string;
    fournisseur: {
      nom: string;
      prenom: string;
      societe: string;
    };
  };
}

const ClientReports: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryReport[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [totalPayments, setTotalPayments] = useState<number>(0);
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

  // New state for last payment filtering
  const [lastPaymentDate, setLastPaymentDate] = useState<string | null>(null);
  const [showFromLastPayment, setShowFromLastPayment] = useState(false);
  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchClientDeliveries();
    }
  }, [selectedClient, dateFilters]);

  const fetchLastPaymentDate = async (clientId: string) => {
    try {
      const { data: lastPaymentData, error: lastPaymentError } = await supabase
        .from('paiements_clients')
        .select('date_paiement')
        .eq('client_id', clientId)
        .order('date_paiement', { ascending: false })
        .limit(1);

      if (lastPaymentError) {
        console.error('Error fetching last payment:', lastPaymentError);
        return null;
      }

      if (lastPaymentData && lastPaymentData.length > 0) {
        return lastPaymentData[0].date_paiement;
      }

      return null;
    } catch (error) {
      console.error('Error in fetchLastPaymentDate:', error);
      return null;
    }
  };

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('societe', { ascending: true });

      if (clientsError) throw clientsError;
      setClients(clientsData || []);
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setError('Erreur lors du chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientDeliveries = async () => {
    if (!selectedClient) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch last payment date for this client
      const lastPayment = await fetchLastPaymentDate(selectedClient.id);
      setLastPaymentDate(lastPayment);

      // If "show from last payment" is enabled and we have a last payment date,
      // automatically set the start date to the day after the last payment
      let effectiveDateFrom = dateFilters.dateFrom;
      if (showFromLastPayment && lastPayment) {
        const dayAfterLastPayment = new Date(lastPayment);
        dayAfterLastPayment.setDate(dayAfterLastPayment.getDate() + 1);
        effectiveDateFrom = dayAfterLastPayment.toISOString().split('T')[0];
      }

      // Build date filters for deliveries
      let deliveriesQuery = supabase
        .from('bon_de_livraison')
        .select(`
          *,
          items:bon_de_livraison_items(
            id,
            quantite_pieces,
            quantite_unitaire,
            quantite_livree,
            prix_unitaire,
            total_ligne,
            produit:produits(nom_produit, prix_achat, unite)
          ),
          bon_commande:bon_de_commande(
            numero_commande,
            fournisseur:fournisseurs(nom, prenom, societe)
          )
        `)
        .eq('client_id', selectedClient.id)
        .neq('statut', 'annulee') // Exclude cancelled delivery notes
        .order('date_livraison', { ascending: false });

      if (effectiveDateFrom) {
        deliveriesQuery = deliveriesQuery.gte('date_livraison', effectiveDateFrom);
      }
      if (dateFilters.dateTo) {
        deliveriesQuery = deliveriesQuery.lte('date_livraison', dateFilters.dateTo);
      }

      const { data: deliveriesData, error: deliveriesError } = await deliveriesQuery;
      if (deliveriesError) throw deliveriesError;

      setDeliveries(deliveriesData || []);

      // Get total payments for the client in the selected period
      let paymentsQuery = supabase
        .from('paiements_clients')
        .select('*')
        .eq('client_id', selectedClient.id);

      if (effectiveDateFrom) {
        paymentsQuery = paymentsQuery.gte('date_paiement', effectiveDateFrom);
      }
      if (dateFilters.dateTo) {
        paymentsQuery = paymentsQuery.lte('date_paiement', dateFilters.dateTo);
      }

      const { data: paymentsData } = await paymentsQuery;
      setPayments(paymentsData || []);

      const totalPaidAmount = (paymentsData || []).reduce((sum, p) => sum + p.montant, 0);
      setTotalPayments(totalPaidAmount);
    } catch (err: any) {
      console.error('Error fetching client deliveries:', err);
      setError('Erreur lors du chargement des livraisons');
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setSearchTerm('');
    // Reset the toggle when selecting a new client
    setShowFromLastPayment(false);
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
    setShowFromLastPayment(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = () => {
    if (!selectedClient) return;

    const csvHeaders = [
      'Date Livraison',
      'BC Source',
      'Numéro Livraison',
      'Total HT (DH)',
      'Statut',
      'Notes'
    ];

    const csvData = deliveries.map(delivery => {
      return [
        new Date(delivery.date_livraison).toLocaleDateString('fr-FR'),
        delivery.bon_commande?.numero_commande || '',
        delivery.numero_livraison,
        delivery.total_ht.toFixed(2),
        delivery.statut === 'en_preparation' ? 'En préparation' :
        delivery.statut === 'en_cours' ? 'En cours' :
        delivery.statut === 'livree' ? 'Livrée' :
        delivery.statut === 'annulee' ? 'Annulée' : delivery.statut,
        delivery.notes || ''
      ];
    });

    // Add totals row
    csvData.push([
      '', // Date
      '', // BC Source
      `TOTAUX (${deliveries.length} livraisons)`,
      totals.totalDeliveries.toFixed(2),
      '', // Statut
      '' // Notes
    ]);

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `livraisons_${selectedClient.societe.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.societe.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.numero_client.toLowerCase().includes(searchTerm.toLowerCase())
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

  const getDateRangeText = () => {
    if (showFromLastPayment && lastPaymentDate) {
      const dayAfterLastPayment = new Date(lastPaymentDate);
      dayAfterLastPayment.setDate(dayAfterLastPayment.getDate() + 1);
      const startText = `À partir du ${dayAfterLastPayment.toLocaleDateString('fr-FR')} (après dernier paiement)`;
      
      if (dateFilters.dateTo) {
        return `${startText} jusqu'au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`;
      }
      return startText;
    }
    
    if (dateFilters.dateFrom && dateFilters.dateTo) {
      return `Du ${new Date(dateFilters.dateFrom).toLocaleDateString('fr-FR')} au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`;
    } else if (dateFilters.dateFrom) {
      return `À partir du ${new Date(dateFilters.dateFrom).toLocaleDateString('fr-FR')}`;
    } else if (dateFilters.dateTo) {
      return `Jusqu'au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`;
    }
    return 'Toutes les périodes';
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

  const requiresDualInput = (unite: string) => {
    return ['ml', 'm2', 'kg', 'l', 'cm', 'm', 'g', 't'].includes(unite);
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

  // Sync local state with filters when they change externally (like clear filters)
  useEffect(() => {
    setLocalDateFilters(dateFilters);
  }, [dateFilters]);

  // Define filtering functions first
  const getFilteredDeliveries = () => {
    let effectiveDateFrom = dateFilters.dateFrom;
    
    if (showFromLastPayment && lastPaymentDate) {
      const dayAfterLastPayment = new Date(lastPaymentDate);
      dayAfterLastPayment.setDate(dayAfterLastPayment.getDate() + 1);
      effectiveDateFrom = dayAfterLastPayment.toISOString().split('T')[0];
    }
    
    return deliveries.filter(delivery => {
      const dateMatch = (!effectiveDateFrom || delivery.date_livraison >= effectiveDateFrom) &&
                      (!dateFilters.dateTo || delivery.date_livraison <= dateFilters.dateTo);
      return dateMatch;
    });
  };

  const getFilteredPayments = () => {
    let effectiveDateFrom = dateFilters.dateFrom;
    
    if (showFromLastPayment && lastPaymentDate) {
      const dayAfterLastPayment = new Date(lastPaymentDate);
      dayAfterLastPayment.setDate(dayAfterLastPayment.getDate() + 1);
      effectiveDateFrom = dayAfterLastPayment.toISOString().split('T')[0];
    }
    
    return payments.filter(payment => {
      const dateMatch = (!effectiveDateFrom || payment.date_paiement >= effectiveDateFrom) &&
                      (!dateFilters.dateTo || payment.date_paiement <= dateFilters.dateTo);
      return dateMatch;
    });
  };

  // Use filtered data for calculations and display
  const filteredDeliveries = getFilteredDeliveries();
  const filteredPayments = getFilteredPayments();

  // Calculate totals for selected period
  const calculateTotals = () => {
    const totalDeliveries = filteredDeliveries.reduce((sum, delivery) => sum + delivery.total_ht, 0);
    const filteredPaymentsTotal = filteredPayments.reduce((sum, payment) => sum + payment.montant, 0);
    const totalBalance = totalDeliveries - filteredPaymentsTotal;
    
    return {
      totalDeliveries,
      totalPaid: filteredPaymentsTotal,
      totalBalance,
      deliveriesCount: filteredDeliveries.length
    };
  };

  const totals = calculateTotals();

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
            onClick={() => selectedClient ? fetchClientDeliveries() : fetchClients()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // If no client is selected, show client selection
  if (!selectedClient) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Rapport Clients
            </h1>
            <p className="text-gray-600 mt-1">Sélectionnez un client pour voir ses livraisons</p>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              onClick={() => handleClientSelect(client)}
              className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{client.societe}</h3>
                  <p className="text-sm text-gray-600">{client.numero_client}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-900">{client.prenom} {client.nom}</p>
                <p className="text-sm text-gray-600">{client.email}</p>
                <p className="text-sm text-gray-600">{client.telephone}</p>
              </div>
            </div>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>Aucun client trouvé</p>
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
            onClick={() => setSelectedClient(null)}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Livraisons - {selectedClient.societe}
            </h1>
            <p className="text-gray-600 mt-1">{selectedClient.prenom} {selectedClient.nom} - {selectedClient.numero_client}</p>
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
        <div className="relative text-center border-b-2 border-gray-800 pb-6">
          <img 
            src="https://pub-237d2da54b564d23aaa1c3826e1d4e65.r2.dev/ANTURGOOD/logo2.png" 
            alt="ANTURGOOD Logo" 
            className="absolute top-0 left-0 h-32 w-auto"
          />
          <div className="text-center mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">RAPPORT DÉTAILLÉ CLIENT</h2>
            <p className="text-lg font-semibold text-gray-700">{selectedClient?.societe}</p>
            <p className="text-sm text-gray-600">{selectedClient?.prenom} {selectedClient?.nom} - {selectedClient?.numero_client}</p>
            <p className="text-sm text-gray-600 mt-2">
              Période: {getDateRangeText()} | 
              Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters - Hidden in print */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 print:hidden">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Filtres de période
        </h3>
        
        {/* Show from last payment toggle */}
        {lastPaymentDate && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="show-from-last-payment"
                checked={showFromLastPayment}
                onChange={(e) => setShowFromLastPayment(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="show-from-last-payment" className="text-sm font-medium text-blue-800">
                Afficher à partir du dernier paiement
              </label>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Dernier paiement: {new Date(lastPaymentDate).toLocaleDateString('fr-FR')}
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-2">
              Date début
            </label>
            <input
              type="date"
              id="date-from"
              disabled={showFromLastPayment}
              value={localDateFilters.dateFrom}
              onChange={(e) => handleLocalDateChange('dateFrom', e.target.value)}
              onBlur={(e) => handleDateFilterApply('dateFrom', e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                showFromLastPayment ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            />
            {showFromLastPayment && (
              <p className="text-xs text-gray-500 mt-1">
                Déterminé automatiquement par le dernier paiement
              </p>
            )}
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
              <p className="text-sm text-gray-600">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold text-blue-600">{formatPrice(totals.totalDeliveries)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Payé</p>
              <p className="text-2xl font-bold text-green-600">{formatPrice(totals.totalPaid)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Solde</p>
              <p className={`text-2xl font-bold ${totals.totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatPrice(totals.totalBalance)}
              </p>
            </div>
            <AlertCircle className={`w-8 h-8 ${totals.totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`} />
          </div>
        </div>
      </div>

      {/* Financial Summary - Print only */}
      <div className="hidden print:block mb-8">
        <div className="grid grid-cols-3 gap-8 mb-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Chiffre d'Affaires</h3>
            <p className="text-2xl font-bold text-blue-600">{formatPrice(totals.totalDeliveries)}</p>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Payé</h3>
            <p className="text-2xl font-bold text-green-600">{formatPrice(totals.totalPaid)}</p>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Crédit Client</h3>
            <p className={`text-2xl font-bold ${totals.totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatPrice(totals.totalBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Products Table - Print only */}
      <div className="hidden print:block mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Détail des Produits Livrés</h3>
        <table className="w-full border-collapse border border-gray-800 mb-8">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Date</th>
              <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Produit</th>
              <th className="border border-gray-800 px-3 py-2 text-center font-semibold text-sm">Quantité</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Prix Unit.</th>
              <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeliveries.map((delivery) => 
              delivery.items.map((item, itemIndex) => (
                <tr key={`${delivery.id}-${item.id}`}>
                  {itemIndex === 0 && (
                      <td className="border border-gray-800 px-3 py-2 text-sm" rowSpan={delivery.items.length}>
                        {new Date(delivery.date_livraison).toLocaleDateString('fr-FR')}
                      </td>
                  )}
                  <td className="border border-gray-800 px-3 py-2 text-sm">
                    {item.produit.nom_produit}
                  </td>
                  <td className="border border-gray-800 px-3 py-2 text-center text-sm">
                    {requiresDualInput(item.produit.unite) ? (
                      <div>
                        <div>{item.quantite_pieces || Math.round(item.quantite_livree)} pièces</div>
                        <div className="text-xs text-gray-600">
                          {item.quantite_unitaire || 1} {getUnitLabel(item.produit.unite)}/pièce
                        </div>
                        <div className="font-medium">
                          {item.quantite_livree} {getUnitLabel(item.produit.unite)}
                        </div>
                      </div>
                    ) : (
                      `${item.quantite_livree} ${getUnitLabel(item.produit.unite)}`
                    )}
                  </td>
                  <td className="border border-gray-800 px-3 py-2 text-right text-sm">
                    {formatPrice(item.prix_unitaire)}
                  </td>
                  <td className="border border-gray-800 px-3 py-2 text-right text-sm font-medium">
                    {formatPrice(item.total_ligne)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td className="border border-gray-800 px-3 py-3 font-bold text-sm" colSpan={4}>
                TOTAL GÉNÉRAL
              </td>
              <td className="border border-gray-800 px-3 py-3 text-right font-bold text-sm">
                {formatPrice(totals.totalDeliveries)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment History - Print only */}
      <div className="hidden print:block mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Historique des Paiements</h3>
        {filteredPayments.length > 0 ? (
          <table className="w-full border-collapse border border-gray-800 mb-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Date</th>
                <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Mode</th>
                <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Référence</th>
                <th className="border border-gray-800 px-3 py-2 text-left font-semibold text-sm">Émetteur</th>
                <th className="border border-gray-800 px-3 py-2 text-right font-semibold text-sm">Montant</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="border border-gray-800 px-3 py-2 text-sm">
                    {new Date(payment.date_paiement).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="border border-gray-800 px-3 py-2 text-sm">
                    {getPaymentMethodLabel(payment.mode_paiement)}
                  </td>
                  <td className="border border-gray-800 px-3 py-2 text-sm font-mono">
                    {payment.reference || '-'}
                  </td>
                  <td className="border border-gray-800 px-3 py-2 text-sm">
                    {payment.issuer || '-'}
                  </td>
                  <td className="border border-gray-800 px-3 py-2 text-right text-sm font-medium">
                    {formatPrice(payment.montant)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr>
                <td className="border border-gray-800 px-3 py-3 font-bold text-sm" colSpan={4}>
                  TOTAL PAIEMENTS
                </td>
                <td className="border border-gray-800 px-3 py-3 text-right font-bold text-sm">
                  {formatPrice(totals.totalPaid)}
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <div className="text-center py-4 text-gray-500 border border-gray-300 rounded">
            <p>Aucun paiement enregistré</p>
          </div>
        )}
      </div>

      {/* Summary Table - Print only */}
      <div className="hidden print:block mb-8">
        <table className="w-full border-collapse border border-gray-800">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-800 px-4 py-3 text-left font-bold">RÉCAPITULATIF FINANCIER</th>
              <th className="border border-gray-800 px-4 py-3 text-right font-bold">MONTANT (DH)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-800 px-4 py-2 font-medium">Chiffre d'Affaires Total</td>
              <td className="border border-gray-800 px-4 py-2 text-right font-medium text-blue-600">
                {formatPrice(totals.totalDeliveries)}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-800 px-4 py-2 font-medium">Total Payé</td>
              <td className="border border-gray-800 px-4 py-2 text-right font-medium text-green-600">
                {formatPrice(totals.totalPaid)}
              </td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-800 px-4 py-3 font-bold">CRÉDIT CLIENT</td>
              <td className={`border border-gray-800 px-4 py-3 text-right font-bold ${
                totals.totalBalance > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatPrice(totals.totalBalance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Deliveries Table - Screen only */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Rapport bon de livraison</h2>
            <span className="text-sm text-gray-600">
              {deliveries.length} livraison(s)
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full print:hidden">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  BC Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  N° Livraison
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Total HT
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDeliveries.length > 0 ? (
                filteredDeliveries.map((delivery) => {
                  return (
                    <tr key={delivery.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(delivery.date_livraison).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {delivery.bon_commande?.numero_commande || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">{delivery.numero_livraison}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatPrice(delivery.total_ht)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getStatusBadge(delivery.statut)}
                      </td>
                    </tr>
                  );
                })
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
            {filteredDeliveries.length > 0 && (
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

      {/* Print Footer */}
      <div className="hidden print:block absolute bottom-8 left-8 right-8 text-center text-xs text-gray-500 border-t border-gray-300 pt-4">
        <p>ANTURGOOD - Système de gestion | Rapport généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</p>
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
          
          /* Hide everything except the table container and its content */
          * {
            visibility: hidden;
          }
          
          /* Show only the main content container and table */
          .print\\:block,
          .print\\:block *,
          .h-full,
          .h-full *,
          body {
            visibility: visible;
          }
          
          /* Reset layout for print */
          .h-full {
            height: auto !important;
            display: block !important;
            position: static !important;
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
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
          
          /* Hide navigation and other UI elements */
          nav, aside, .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ClientReports;