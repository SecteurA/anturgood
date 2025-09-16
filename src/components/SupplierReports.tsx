import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Calendar, 
  Printer, 
  Download,
  FileText,
  DollarSign,
  Search,
  ArrowLeft,
  Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Supplier {
  id: string;
  numero_fournisseur: string;
  nom: string;
  prenom: string;
  societe: string;
  email: string;
  telephone: string;
}

interface OrderReport {
  id: string;
  numero_commande: string;
  date_commande: string;
  statut: string;
  total_ht: number;
  notes: string | null;
  items: Array<{
    id: string;
    quantite: number;
    prix_unitaire: number;
    total_ligne: number;
    produit: {
      nom_produit: string;
    };
  }>;
  payment_status: 'paid' | 'unpaid' | 'partial';
  paid_amount: number;
}

const SupplierReports: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [orders, setOrders] = useState<OrderReport[]>([]);
  const [totalPayments, setTotalPayments] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  
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
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      fetchSupplierOrders();
    }
  }, [selectedSupplier, dateFilters]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: suppliersData, error: suppliersError } = await supabase
        .from('fournisseurs')
        .select('*')
        .order('societe', { ascending: true });

      if (suppliersError) throw suppliersError;
      setSuppliers(suppliersData || []);
    } catch (err: any) {
      console.error('Error fetching suppliers:', err);
      setError('Erreur lors du chargement des fournisseurs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierOrders = async () => {
    if (!selectedSupplier) return;

    try {
      setLoading(true);
      setError(null);

      // Build date filters for orders
      let ordersQuery = supabase
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
        .eq('fournisseur_id', selectedSupplier.id)
        .neq('statut', 'annulee') // Exclude cancelled orders
        .order('date_commande', { ascending: false });

      if (dateFilters.dateFrom) {
        ordersQuery = ordersQuery.gte('date_commande', dateFilters.dateFrom);
      }
      if (dateFilters.dateTo) {
        ordersQuery = ordersQuery.lte('date_commande', dateFilters.dateTo);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      // For each order, calculate payment status
      const ordersWithPayments = await Promise.all(
        (ordersData || []).map(async (order) => {
          return {
            ...order,
            payment_status: 'unpaid' as const, // Orders don't track individual payments
            paid_amount: 0 // Payments are tracked at supplier level, not per order
          };
        })
      );

      // Get total payments for the supplier in the selected period (for summary only)
      let paymentsQuery = supabase
        .from('paiements_fournisseurs')
        .select('montant')
        .eq('fournisseur_id', selectedSupplier.id);

      if (dateFilters.dateFrom) {
        paymentsQuery = paymentsQuery.gte('date_paiement', dateFilters.dateFrom);
      }
      if (dateFilters.dateTo) {
        paymentsQuery = paymentsQuery.lte('date_paiement', dateFilters.dateTo);
      }

      const { data: paymentsData } = await paymentsQuery;
      const totalPaidAmount = (paymentsData || []).reduce((sum, p) => sum + p.montant, 0);

      setOrders(ordersWithPayments);
      
      // Store total payments for summary calculations
      setTotalPayments(totalPaidAmount);
    } catch (err: any) {
      console.error('Error fetching supplier orders:', err);
      setError('Erreur lors du chargement des commandes');
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierModal(false);
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
    if (!selectedSupplier) return;

    const csvHeaders = [
      'Numéro Commande',
      'Date Commande',
      'Statut',
      'Total HT (DH)', 
      'Total Payé (DH)',
      'Solde (DH)',
      'Notes'
    ];

    const csvData = orders.map(order => [
      order.numero_commande,
      new Date(order.date_commande).toLocaleDateString('fr-FR'),
      order.statut === 'brouillon' ? 'Brouillon' :
      order.statut === 'envoyee' ? 'Envoyée' :
      order.statut === 'confirmee' ? 'Confirmée' :
      order.statut === 'livree' ? 'Livrée' :
      order.statut === 'annulee' ? 'Annulée' : order.statut,
      order.total_ht.toFixed(2),
      '', // Empty for individual orders
      '', // Empty for individual orders
      order.notes || ''
    ]);

    // Add totals row
    csvData.push([
      `TOTAUX (${totals.ordersCount} commandes)`,
      '', // Empty date
      '', // Empty status
      totals.totalOrders.toFixed(2),
      totals.totalPaid.toFixed(2),
      totals.totalBalance.toFixed(2),
      '' // Empty notes
    ]);
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `commandes_${selectedSupplier.societe.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter suppliers based on search term
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.societe.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.numero_fournisseur.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const getPaymentStatusBadge = (status: 'paid' | 'unpaid' | 'partial') => {
    const statusConfig = {
      paid: 'bg-green-100 text-green-800',
      unpaid: 'bg-red-100 text-red-800',
      partial: 'bg-yellow-100 text-yellow-800'
    };

    const statusLabel = {
      paid: 'Payé',
      unpaid: 'Non payé',
      partial: 'Partiel'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusConfig[status]
      }`}>
        {statusLabel[status]}
      </span>
    );
  };

  // Calculate totals for selected period
  const calculateTotals = () => {
    const totalOrders = orders.reduce((sum, order) => sum + order.total_ht, 0);
    const totalPaid = totalPayments; // Use supplier-level total payments
    const totalBalance = totalOrders - totalPaid;
    
    return {
      totalOrders,
      totalPaid,
      totalBalance,
      ordersCount: orders.length
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
            onClick={() => selectedSupplier ? fetchSupplierOrders() : fetchSuppliers()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // If no supplier is selected, show supplier selection
  if (!selectedSupplier) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-600" />
              Rapport Fournisseurs
            </h1>
            <p className="text-gray-600 mt-1">Sélectionnez un fournisseur pour voir ses commandes</p>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Suppliers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              onClick={() => handleSupplierSelect(supplier)}
              className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="w-8 h-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{supplier.societe}</h3>
                  <p className="text-sm text-gray-600">{supplier.numero_fournisseur}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-900">{supplier.prenom} {supplier.nom}</p>
                <p className="text-sm text-gray-600">{supplier.email}</p>
                <p className="text-sm text-gray-600">{supplier.telephone}</p>
              </div>
            </div>
          ))}
        </div>

        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>Aucun fournisseur trouvé</p>
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
            onClick={() => setSelectedSupplier(null)}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-600" />
              Commandes - {selectedSupplier.societe}
            </h1>
            <p className="text-gray-600 mt-1">{selectedSupplier.prenom} {selectedSupplier.nom} - {selectedSupplier.numero_fournisseur}</p>
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
          <h2 className="text-xl font-semibold text-gray-700 mt-2">Rapport Commandes Fournisseur - {selectedSupplier?.societe || `${selectedSupplier?.prenom} ${selectedSupplier?.nom}`}</h2>
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
              <p className="text-sm text-gray-600">Commandes</p>
              <p className="text-2xl font-bold text-gray-900">{totals.ordersCount}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Commandes</p>
              <p className="text-2xl font-bold text-blue-600">{formatPrice(totals.totalOrders)}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
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
            <DollarSign className={`w-8 h-8 ${totals.totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`} />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Rapport bon de commandes</h2>
            <span className="text-sm text-gray-600">
              {orders.length} commande(s)
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full print:text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  N° Commande
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  TOTAL HT
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Payé
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Crédit
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.length > 0 ? (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{order.numero_commande}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(order.date_commande).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(order.statut)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPrice(order.total_ht)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatPrice(order.paid_amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <span className={`${
                        (order.total_ht - order.paid_amount) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatPrice(order.total_ht - order.paid_amount)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <FileText className="w-8 h-8 text-gray-300 mb-2" />
                      <p>Aucune commande pour la période sélectionnée</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            
            {/* Totals Footer */}
            {orders.length > 0 && (
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr className="font-semibold">
                  <td className="px-4 py-4 text-sm font-bold text-gray-900" colSpan={3}>
                    TOTAUX ({totals.ordersCount} commandes)
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-blue-600">
                    {formatPrice(totals.totalOrders)}
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-green-600">
                    {formatPrice(totals.totalPaid)}
                  </td>
                  <td className={`px-4 py-4 text-sm font-bold ${totals.totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatPrice(totals.totalBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Print Footer */}

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

export default SupplierReports;