import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Building2, 
  Package, 
  Truck, 
  FileText, 
  DollarSign, 
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Target
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  // Totals
  totalClients: number;
  totalFournisseurs: number;
  totalChauffeurs: number;
  totalProducts: number;
  
  // Current month stats
  currentMonth: {
    // Clients
    clientsRevenue: number;
    clientsPayments: number;
    clientsDebt: number;
    clientsCredit: number;
    clientsMargin: number;
    
    // Suppliers
    suppliersOrdered: number;
    suppliersPayments: number;
    suppliersDebt: number;
    
    // Operations
    deliveriesCount: number;
    deliveriesCompleted: number;
    deliveriesPending: number;
    ordersCount: number;
    ordersConfirmed: number;
    ordersDelivered: number;
  };
  
  // Top performers
  topClients: Array<{
    id: string;
    nom: string;
    prenom: string;
    societe: string;
    revenue: number;
    margin: number;
  }>;
  
  topSuppliers: Array<{
    id: string;
    societe: string;
    ordered: number;
    debt: number;
  }>;
  
  // Recent activity
  recentDeliveries: Array<{
    numero_livraison: string;
    client_societe: string;
    total_ht: number;
    date_livraison: string;
  }>;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilters, setDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchDashboardStats();
  }, [dateFilters]);

  const handleDateFilterChange = (field: 'dateFrom' | 'dateTo', value: string) => {
    setDateFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearDateFilters = () => {
    setDateFilters({
      dateFrom: '',
      dateTo: ''
    });
  };

  const hasActiveFilters = () => {
    return dateFilters.dateFrom || dateFilters.dateTo;
  };
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get date range based on filters or default to current month
      const now = new Date();
      
      let firstDay: Date;
      let lastDay: Date;
      
      if (dateFilters.dateFrom && dateFilters.dateTo) {
        // Both dates specified
        firstDay = new Date(dateFilters.dateFrom);
        lastDay = new Date(dateFilters.dateTo);
      } else if (dateFilters.dateFrom && !dateFilters.dateTo) {
        // Only start date specified - go from start date to end of current month
        firstDay = new Date(dateFilters.dateFrom);
        lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (!dateFilters.dateFrom && dateFilters.dateTo) {
        // Only end date specified - go from start of month to end date
        firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        lastDay = new Date(dateFilters.dateTo);
      } else {
        // No dates specified - default to current month
        firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
      
      const firstDayISO = firstDay.toISOString().split('T')[0];
      const lastDayISO = lastDay.toISOString().split('T')[0];

      // Fetch total counts
      const [clientsResult, fournisseursResult, chauffeursResult, productsResult] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('fournisseurs').select('*', { count: 'exact', head: true }),
        supabase.from('chauffeurs').select('*', { count: 'exact', head: true }),
        supabase.from('produits').select('*', { count: 'exact', head: true })
      ]);

      // Fetch deliveries for the selected period
      const { data: monthDeliveries, error: deliveriesError } = await supabase
        .from('bon_de_livraison')
        .select(`
          *,
          client:clients(id, nom, prenom, societe),
          items:bon_de_livraison_items(
            quantite_livree,
            prix_unitaire,
            total_ligne,
            produit:produits(prix_achat, prix_vente)
          )
        `)
        .gte('date_livraison', firstDayISO)
        .lte('date_livraison', lastDayISO)
        .neq('statut', 'annulee') // Exclude cancelled delivery notes
        .order('date_livraison', { ascending: false });

      if (deliveriesError) throw deliveriesError;

      // Fetch orders for the selected period
      const { data: monthOrders, error: ordersError } = await supabase
        .from('bon_de_commande')
        .select('*')
        .gte('date_commande', firstDayISO)
        .lte('date_commande', lastDayISO)
        .neq('statut', 'annulee'); // Exclude cancelled orders

      if (ordersError) throw ordersError;

      // Fetch client payments for the selected period
      const { data: monthClientPayments, error: clientPaymentsError } = await supabase
        .from('paiements_clients')
        .select('client_id, montant')
        .gte('date_paiement', firstDayISO)
        .lte('date_paiement', lastDayISO);

      if (clientPaymentsError) throw clientPaymentsError;

      // Fetch supplier payments for the selected period
      const { data: monthSupplierPayments, error: supplierPaymentsError } = await supabase
        .from('paiements_fournisseurs')
        .select('fournisseur_id, montant')
        .gte('date_paiement', firstDayISO)
        .lte('date_paiement', lastDayISO);

      if (supplierPaymentsError) throw supplierPaymentsError;

      // Calculate period-based stats
      const monthDeliveriesData = monthDeliveries || [];
      const monthOrdersData = monthOrders || [];
      const monthClientPaymentsData = monthClientPayments || [];
      const monthSupplierPaymentsData = monthSupplierPayments || [];

      // Calculate clients stats from filtered deliveries
      const clientsRevenue = monthDeliveriesData.reduce((sum, delivery) => sum + (delivery.total_ht || 0), 0);
      const clientsPayments = monthClientPaymentsData.reduce((sum, payment) => sum + (payment.montant || 0), 0);
      const clientsDebt = clientsRevenue - clientsPayments;
      const clientsCredit = Math.max(0, clientsPayments - clientsRevenue); // Advance only if payments > revenue
      
      // Calculate margin from delivery items
      const clientsMargin = monthDeliveriesData.reduce((sum, delivery) => {
        return sum + (delivery.items || []).reduce((itemSum, item) => {
          const margin = (item.prix_unitaire - (item.produit?.prix_achat || 0)) * item.quantite_livree;
          return itemSum + margin;
        }, 0);
      }, 0);

      // Group deliveries by client for top clients calculation
      const clientStats = new Map();
      monthDeliveriesData.forEach(delivery => {
        const clientId = delivery.client.id;
        const existingStat = clientStats.get(clientId) || {
          id: clientId,
          nom: delivery.client.nom,
          prenom: delivery.client.prenom,
          societe: delivery.client.societe,
          revenue: 0,
          margin: 0
        };
        
        existingStat.revenue += delivery.total_ht || 0;
        existingStat.margin += (delivery.items || []).reduce((itemSum, item) => {
          const margin = (item.prix_unitaire - (item.produit?.prix_achat || 0)) * item.quantite_livree;
          return itemSum + margin;
        }, 0);
        
        clientStats.set(clientId, existingStat);
      });

      // Convert to array and sort by revenue
      const topClientsArray = Array.from(clientStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Calculate suppliers stats from filtered orders and payments
      const suppliersOrdered = monthOrdersData.reduce((sum, order) => sum + (order.total_ht || 0), 0);
      const suppliersPayments = monthSupplierPaymentsData.reduce((sum, payment) => sum + (payment.montant || 0), 0);
      const suppliersDebt = suppliersOrdered - suppliersPayments;

      // Group orders by supplier for top suppliers calculation
      const supplierStats = new Map();
      monthOrdersData.filter(order => order.statut !== 'annulee').forEach(order => {
        const supplierId = order.fournisseur_id;
        const existingStat = supplierStats.get(supplierId) || {
          id: supplierId,
          ordered: 0,
          payments: 0
        };
        
        existingStat.ordered += order.total_ht || 0;
        supplierStats.set(supplierId, existingStat);
      });

      // Add payments to supplier stats
      monthSupplierPaymentsData.forEach(payment => {
        const supplierId = payment.fournisseur_id;
        const existingStat = supplierStats.get(supplierId) || {
          id: supplierId,
          ordered: 0,
          payments: 0
        };
        
        existingStat.payments += payment.montant || 0;
        supplierStats.set(supplierId, existingStat);
      });

      // Fetch supplier names and create top suppliers array
      const supplierIds = Array.from(supplierStats.keys());
      const { data: suppliersData } = await supabase
        .from('fournisseurs')
        .select('id, societe')
        .in('id', supplierIds);

      const topSuppliersArray = Array.from(supplierStats.entries())
        .map(([supplierId, stats]) => {
          const supplier = (suppliersData || []).find(s => s.id === supplierId);
          return {
            id: supplierId,
            societe: supplier?.societe || 'Fournisseur inconnu',
            ordered: stats.ordered,
            debt: stats.ordered - stats.payments
          };
        })
        .sort((a, b) => b.ordered - a.ordered)
        .slice(0, 5);

      // Operations stats
      const deliveriesCompleted = monthDeliveriesData.filter(d => d.statut === 'livree').length;
      const deliveriesPending = monthDeliveriesData.filter(d => d.statut !== 'livree' && d.statut !== 'annulee').length;
      const ordersConfirmed = monthOrdersData.filter(o => o.statut === 'confirmee').length;
      const ordersDelivered = monthOrdersData.filter(o => o.statut === 'livree').length;

      // Recent deliveries (last 5)
      const recentDeliveries = monthDeliveriesData
        .slice(0, 5)
        .map(delivery => ({
          numero_livraison: delivery.numero_livraison,
          client_societe: delivery.client.societe,
          total_ht: delivery.total_ht,
          date_livraison: delivery.date_livraison
        }));

      const dashboardStats: DashboardStats = {
        totalClients: clientsResult.count || 0,
        totalFournisseurs: fournisseursResult.count || 0,
        totalChauffeurs: chauffeursResult.count || 0,
        totalProducts: productsResult.count || 0,
        currentMonth: {
          clientsRevenue,
          clientsPayments,
          clientsDebt,
          clientsCredit,
          clientsMargin,
          suppliersOrdered,
          suppliersPayments,
          suppliersDebt,
          deliveriesCount: monthDeliveriesData.length,
          deliveriesCompleted,
          deliveriesPending,
          ordersCount: monthOrdersData.length,
          ordersConfirmed,
          ordersDelivered
        },
        topClients: topClientsArray,
        topSuppliers: topSuppliersArray,
        recentDeliveries
      };

      setStats(dashboardStats);
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-MA', {
      minimumFractionDigits: 2,
      useGrouping: false
    }).format(price) + ' DH';
  };

  const formatPriceShort = (price: number) => {
    if (price >= 1000000) {
      return (price / 1000000).toFixed(1) + 'M DH';
    } else if (price >= 1000) {
      return (price / 1000).toFixed(1) + 'K DH';
    }
    return formatPrice(price);
  };

  const getCurrentPeriodName = () => {
    if (dateFilters.dateFrom && dateFilters.dateTo) {
      return `Du ${new Date(dateFilters.dateFrom).toLocaleDateString('fr-FR')} au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`;
    } else if (dateFilters.dateFrom && !dateFilters.dateTo) {
      return `À partir du ${new Date(dateFilters.dateFrom).toLocaleDateString('fr-FR')}`;
    } else if (!dateFilters.dateFrom && dateFilters.dateTo) {
      return `Jusqu'au ${new Date(dateFilters.dateTo).toLocaleDateString('fr-FR')}`;
    } else {
      return new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Chargement du tableau de bord...</p>
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
            onClick={fetchDashboardStats}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="h-full flex flex-col space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Tableau de bord
          </h1>
          <p className="text-gray-600 mt-1">Vue d'ensemble des performances - {getCurrentPeriodName()}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchDashboardStats}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors duration-200"
          >
            <Calendar className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Date Filter Controls */}
      <div className="bg-white/70 backdrop-blur-sm rounded-lg border border-gray-200/50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtrer par période</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <label htmlFor="date-from" className="text-xs text-gray-600 font-medium">
                Date début
              </label>
              <input
                type="date"
                id="date-from"
                value={dateFilters.dateFrom}
                onChange={(e) => handleDateFilterChange('dateFrom', e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/90"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <label htmlFor="date-to" className="text-xs text-gray-600 font-medium">
                Date fin
              </label>
              <input
                type="date"
                id="date-to"
                value={dateFilters.dateTo}
                onChange={(e) => handleDateFilterChange('dateTo', e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/90"
              />
            </div>
            
            {hasActiveFilters() && (
              <button
                onClick={() => {
                  clearDateFilters();
                }}
                className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors duration-200"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
        
        {hasActiveFilters() && (
          <div className="mt-3 pt-3 border-t border-gray-200/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-blue-700 font-medium">
                Période active: {getCurrentPeriodName()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Global Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Clients</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Fournisseurs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalFournisseurs}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Chauffeurs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalChauffeurs}</p>
            </div>
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Produits</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Main KPIs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Clients KPIs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Performance Clients
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Chiffre d'Affaires</span>
              </div>
              <p className="text-xl font-bold text-blue-900">{formatPrice(stats.currentMonth.clientsRevenue)}</p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Paiements Reçus</span>
              </div>
              <p className="text-xl font-bold text-green-900">{formatPrice(stats.currentMonth.clientsPayments)}</p>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Crédit Clients</span>
              </div>
              <p className="text-xl font-bold text-red-900">{formatPrice(stats.currentMonth.clientsDebt)}</p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">Marge Totale</span>
              </div>
              <p className="text-xl font-bold text-purple-900">{formatPrice(stats.currentMonth.clientsMargin)}</p>
            </div>
          </div>

          {stats.currentMonth.clientsCredit > 0 && (
            <div className="mt-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Avance à Consommer</span>
              </div>
              <p className="text-xl font-bold text-yellow-900">{formatPrice(stats.currentMonth.clientsCredit)}</p>
            </div>
          )}
        </div>

        {/* Suppliers KPIs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-orange-600" />
            Performance Fournisseurs
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Total Commandé</span>
              </div>
              <p className="text-xl font-bold text-orange-900">{formatPrice(stats.currentMonth.suppliersOrdered)}</p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Total Payé</span>
              </div>
              <p className="text-xl font-bold text-green-900">{formatPrice(stats.currentMonth.suppliersPayments)}</p>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200 md:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Crédit Fournisseurs</span>
              </div>
              <p className="text-xl font-bold text-red-900">{formatPrice(stats.currentMonth.suppliersDebt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Operations Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Deliveries Stats */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Truck className="w-6 h-6 text-green-600" />
            Livraisons du Mois
          </h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.currentMonth.deliveriesCount}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900">{stats.currentMonth.deliveriesCompleted}</p>
              <p className="text-sm text-gray-600">Terminées</p>
            </div>

            <div className="text-center">
              <div className="bg-yellow-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-yellow-900">{stats.currentMonth.deliveriesPending}</p>
              <p className="text-sm text-gray-600">En cours</p>
            </div>
          </div>
        </div>

        {/* Orders Stats */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-600" />
            Commandes du Mois
          </h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.currentMonth.ordersCount}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900">{stats.currentMonth.ordersConfirmed}</p>
              <p className="text-sm text-gray-600">Confirmées</p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                <Truck className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-900">{stats.currentMonth.ordersDelivered}</p>
              <p className="text-sm text-gray-600">Livrées</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Clients */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Top 5 Clients
          </h2>
          
          <div className="space-y-4">
            {stats.topClients.slice(0, 5).map((client, index) => (
              <div key={client.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {client.societe || `${client.nom} ${client.prenom}`}
                    </p>
                    <p className="text-sm text-gray-600">Marge: {formatPrice(client.margin)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatPrice(client.revenue)}</p>
                </div>
              </div>
            ))}
            {stats.topClients.length === 0 && (
              <p className="text-center text-gray-500 py-8">Aucun client avec chiffre d'affaires</p>
            )}
          </div>
        </div>

        {/* Top Suppliers */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-orange-600" />
            Top 5 Fournisseurs
          </h2>
          
          <div className="space-y-4">
            {stats.topSuppliers.slice(0, 5).map((supplier, index) => (
              <div key={supplier.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{supplier.societe}</p>
                    <p className={`text-sm ${supplier.debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Crédit: {formatPrice(supplier.debt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatPrice(supplier.ordered)}</p>
                </div>
              </div>
            ))}
            {stats.topSuppliers.length === 0 && (
              <p className="text-center text-gray-500 py-8">Aucun fournisseur avec commandes</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <Clock className="w-6 h-6 text-green-600" />
          Livraisons Récentes
        </h2>
        
        {stats.recentDeliveries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">N° BL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentDeliveries.map((delivery, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">
                      {delivery.numero_livraison}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {delivery.client_societe}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatPrice(delivery.total_ht)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(delivery.date_livraison).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">Aucune livraison récente</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;