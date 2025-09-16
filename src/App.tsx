import React from 'react';
import { useEffect, useState } from 'react';
import { Users, Building2, Package, FileText, Truck, UserCheck, BarChart3, LogOut, ChevronRight } from 'lucide-react';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import ClientsList from './components/ClientsList';
import ClientAdd from './components/ClientAdd';
import ClientEdit from './components/ClientEdit';
import FournisseursList from './components/FournisseursList';
import FournisseurAdd from './components/FournisseurAdd';
import FournisseurEdit from './components/FournisseurEdit';
import ProductsList from './components/ProductsList';
import ProductAdd from './components/ProductAdd';
import ProductEdit from './components/ProductEdit';
import PurchaseOrdersList from './components/PurchaseOrdersList';
import PurchaseOrderAdd from './components/PurchaseOrderAdd';
import PurchaseOrderEdit from './components/PurchaseOrderEdit';
import ChauffeursList from './components/ChauffeursList';
import ChauffeurAdd from './components/ChauffeurAdd';
import ChauffeurEdit from './components/ChauffeurEdit';
import DeliveryNotesList from './components/DeliveryNotesList';
import DeliveryNoteAdd from './components/DeliveryNoteAdd';
import DeliveryNoteEdit from './components/DeliveryNoteEdit';
import ClientDetails from './components/ClientDetails';
import FournisseurDetails from './components/FournisseurDetails';
import ChauffeurDetails from './components/ChauffeurDetails';
import Dashboard from './components/Dashboard';
import SupplierReports from './components/SupplierReports';
import ClientReports from './components/ClientReports';
import ChauffeurReports from './components/ChauffeurReports';
import PaymentsList from './components/PaymentsList';
import PasswordChange from './components/PasswordChange';
import { DollarSign, Lock } from 'lucide-react';

interface Client {
  id: string;
  numero_client: string;
  nom: string;
  prenom: string;
  societe: string;
  ice: string;
  email: string;
  telephone: string;
  total_margin: number;
}

interface Fournisseur {
  id: string;
  numero_fournisseur: string;
  nom: string;
  prenom: string;
  societe: string;
  ice: string;
  email: string;
  telephone: string;
  available_credit: number;
}

interface Product {
  id: string;
  nom_produit: string;
  prix_achat: number;
  prix_vente: number;
}

interface PurchaseOrder {
  id: string;
  numero_commande: string;
  date_commande: string;
  statut: string;
  total_ht: number;
  notes: string;
  fournisseur: {
    nom: string;
    prenom: string;
    societe: string;
    numero_fournisseur: string;
  };
}

interface Chauffeur {
  id: string;
  numero_chauffeur: string;
  nom: string;
  prenom: string;
  telephone: string;
  immatricule: string;
  type_chauffeur: string;
}

interface DeliveryNote {
  id: string;
  numero_livraison: string;
  date_livraison: string;
  statut: string;
  total_ht: number;
  notes: string;
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = React.useState('clients-list');
  const [activeMenuItem, setActiveMenuItem] = React.useState('Clients');
  const [activeSubmenu, setActiveSubmenu] = React.useState<string | null>(null);
  const [expandedMenu, setExpandedMenu] = React.useState<string | null>(null);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [selectedFournisseur, setSelectedFournisseur] = React.useState<Fournisseur | null>(null);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = React.useState<PurchaseOrder | null>(null);
  const [selectedChauffeur, setSelectedChauffeur] = React.useState<Chauffeur | null>(null);
  const [selectedDeliveryNote, setSelectedDeliveryNote] = React.useState<DeliveryNote | null>(null);
  const [clientForDetails, setClientForDetails] = React.useState<Client | null>(null);
  const [preSelectedPurchaseOrder, setPreSelectedPurchaseOrder] = React.useState<PurchaseOrder | null>(null);
  const [fournisseurForDetails, setFournisseurForDetails] = React.useState<Fournisseur | null>(null);
  const [chauffeurForDetails, setChauffeurForDetails] = React.useState<Chauffeur | null>(null);

  useEffect(() => {
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };

  const sidebarItems = [
    { name: 'Tableau de bord', icon: BarChart3 },
    { name: 'Clients', icon: Users },
    { name: 'Fournisseurs', icon: Building2 }, 
    { name: 'Produits', icon: Package },
    { name: 'Bon de commande', icon: FileText },
    { name: 'Paiements', icon: DollarSign },
    { name: 'Bon de livraison', icon: Truck },
    { name: 'Chauffeurs', icon: UserCheck },
    { 
      name: 'Rapports', 
      icon: BarChart3,
      submenu: [
        { name: 'Fournisseurs', path: 'supplier-reports' },
        { name: 'Clients', path: 'client-reports' },
        { name: 'Chauffeurs', path: 'chauffeur-reports' }
      ]
    },
    { name: 'Paramètres', icon: Lock }
  ];

  const handleMenuClick = (itemName: string) => {
    const menuItem = sidebarItems.find(item => item.name === itemName);
    
    if (menuItem?.submenu) {
      // Toggle submenu
      if (expandedMenu === itemName) {
        setExpandedMenu(null);
      } else {
        setExpandedMenu(itemName);
      }
    } else {
      // Regular menu item
      setActiveMenuItem(itemName);
      setActiveSubmenu(null);
      setExpandedMenu(null);
      
      if (itemName === 'Tableau de bord') {
        setCurrentPage('dashboard');
      } else if (itemName === 'Clients') {
        setCurrentPage('clients-list');
      } else if (itemName === 'Fournisseurs') {
        setCurrentPage('fournisseurs-list');
      } else if (itemName === 'Produits') {
        setCurrentPage('products-list');
      } else if (itemName === 'Bon de commande') {
        setCurrentPage('purchase-orders-list');
      } else if (itemName === 'Paiements') {
        setCurrentPage('payments-list');
      } else if (itemName === 'Chauffeurs') {
        setCurrentPage('chauffeurs-list');
      } else if (itemName === 'Bon de livraison') {
        setCurrentPage('delivery-notes-list');
      } else if (itemName === 'Paramètres') {
        setCurrentPage('password-change');
      } else {
        setCurrentPage('default');
      }
    }
  };

  const handleSubmenuClick = (parentName: string, submenuPath: string, submenuName: string) => {
    setActiveMenuItem(parentName);
    setActiveSubmenu(submenuName);
    setExpandedMenu(null);
    setCurrentPage(submenuPath);
  };
  const handleNavigateToAddClient = () => {
    setCurrentPage('clients-add');
  };

  const handleNavigateToEditClient = (client: Client) => {
    setSelectedClient(client);
    setCurrentPage('clients-edit');
  };

  const handleNavigateToClientDetails = (client: Client) => {
    setClientForDetails(client);
    setCurrentPage('clients-details');
  };

  const handleNavigateToFournisseurDetails = (fournisseur: Fournisseur) => {
    setFournisseurForDetails(fournisseur);
    setCurrentPage('fournisseurs-details');
  };

  const handleNavigateFromClientDetailsToDelivery = (note: DeliveryNote) => {
    setSelectedDeliveryNote(note);
    setCurrentPage('delivery-notes-edit');
  };

  const handleNavigateBackToList = () => {
    if (activeSubmenu) {
      // If we're in a submenu, go back to the submenu page
      if (activeMenuItem === 'Rapports' && activeSubmenu === 'Fournisseurs') {
        setCurrentPage('supplier-reports');
      } else if (activeMenuItem === 'Rapports' && activeSubmenu === 'Clients') {
        setCurrentPage('client-reports');
      } else if (activeMenuItem === 'Rapports' && activeSubmenu === 'Chauffeurs') {
        setCurrentPage('chauffeur-reports');
      }
    } else {
      // Regular menu navigation
      if (activeMenuItem === 'Tableau de bord') {
        setCurrentPage('dashboard');
      } else if (activeMenuItem === 'Clients') {
        setCurrentPage('clients-list');
      } else if (activeMenuItem === 'Fournisseurs') {
        setCurrentPage('fournisseurs-list');
      } else if (activeMenuItem === 'Produits') {
        setCurrentPage('products-list');
      } else if (activeMenuItem === 'Bon de commande') {
        setCurrentPage('purchase-orders-list');
      } else if (activeMenuItem === 'Paiements') {
        setCurrentPage('payments-list');
      } else if (activeMenuItem === 'Chauffeurs') {
        setCurrentPage('chauffeurs-list');
      } else if (activeMenuItem === 'Bon de livraison') {
        setCurrentPage('delivery-notes-list');
      } else if (activeMenuItem === 'Paramètres') {
        setCurrentPage('password-change');
      }
    }
    setSelectedClient(null);
    setSelectedFournisseur(null);
    setSelectedProduct(null);
    setSelectedPurchaseOrder(null);
    setSelectedChauffeur(null);
    setSelectedDeliveryNote(null);
    setClientForDetails(null);
    setPreSelectedPurchaseOrder(null);
    setFournisseurForDetails(null);
    setChauffeurForDetails(null);
    // Trigger a re-render to refresh the client list
    window.location.hash = Math.random().toString();
  };

  const handleNavigateToAddFournisseur = () => {
    setCurrentPage('fournisseurs-add');
  };

  const handleNavigateToEditFournisseur = (fournisseur: Fournisseur) => {
    setSelectedFournisseur(fournisseur);
    setCurrentPage('fournisseurs-edit');
  };

  const handleNavigateToAddProduct = () => {
    setCurrentPage('products-add');
  };

  const handleNavigateToEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setCurrentPage('products-edit');
  };

  const handleNavigateToAddPurchaseOrder = () => {
    setCurrentPage('purchase-orders-add');
  };

  const handleNavigateToEditPurchaseOrder = (order: PurchaseOrder) => {
    setSelectedPurchaseOrder(order);
    setCurrentPage('purchase-orders-edit');
  };

  const handleNavigateToAddChauffeur = () => {
    setCurrentPage('chauffeurs-add');
  };

  const handleNavigateToEditChauffeur = (chauffeur: Chauffeur) => {
    setSelectedChauffeur(chauffeur);
    setCurrentPage('chauffeurs-edit');
  };

  const handleNavigateToAddDeliveryNote = () => {
    setCurrentPage('delivery-notes-add');
    setPreSelectedPurchaseOrder(null); // Clear any pre-selected order for manual creation
  };

  const handleNavigateToEditDeliveryNote = (note: DeliveryNote) => {
    setSelectedDeliveryNote(note);
    setCurrentPage('delivery-notes-edit');
  };

  const handleConvertPurchaseOrderToDelivery = (order: PurchaseOrder) => {
    setPreSelectedPurchaseOrder(order);
    setCurrentPage('delivery-notes-add');
  };

  const handleNavigateToChauffeurDetails = (chauffeur: Chauffeur) => {
    setChauffeurForDetails(chauffeur);
    setCurrentPage('chauffeurs-details');
  };

  const renderMainContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'supplier-reports':
        return <SupplierReports />;
      case 'client-reports':
        return <ClientReports />;
      case 'chauffeur-reports':
        return <ChauffeurReports />;
      case 'clients-list':
        return <ClientsList onNavigateToAdd={handleNavigateToAddClient} onNavigateToEdit={handleNavigateToEditClient} onNavigateToDetails={handleNavigateToClientDetails} />;
      case 'password-change':
        return <PasswordChange onNavigateBack={handleNavigateBackToList} />;
      case 'clients-add':
        return <ClientAdd onNavigateBack={handleNavigateBackToList} />;
      case 'clients-edit':
        return selectedClient ? (
          <ClientEdit client={selectedClient} onNavigateBack={handleNavigateBackToList} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-lg">Client introuvable</p>
          </div>
        );
      case 'clients-details':
        return clientForDetails ? (
          <ClientDetails 
            client={clientForDetails} 
            onNavigateBack={handleNavigateBackToList}
            onNavigateToDelivery={handleNavigateFromClientDetailsToDelivery}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-lg">Client introuvable</p>
          </div>
        );
      case 'fournisseurs-details':
        return fournisseurForDetails ? (
          <FournisseurDetails 
            fournisseur={fournisseurForDetails} 
            onNavigateBack={handleNavigateBackToList}
            onNavigateToPurchaseOrder={handleNavigateToEditPurchaseOrder}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-lg">Fournisseur introuvable</p>
          </div>
        );
      case 'fournisseurs-list':
        return <FournisseursList onNavigateToAdd={handleNavigateToAddFournisseur} onNavigateToEdit={handleNavigateToEditFournisseur} onNavigateToDetails={handleNavigateToFournisseurDetails} />;
      case 'fournisseurs-add':
        return <FournisseurAdd onNavigateBack={handleNavigateBackToList} />;
      case 'fournisseurs-edit':
        return selectedFournisseur ? (
          <FournisseurEdit fournisseur={selectedFournisseur} onNavigateBack={handleNavigateBackToList} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-lg">Fournisseur introuvable</p>
          </div>
        );
      case 'products-list':
        return <ProductsList onNavigateToAdd={handleNavigateToAddProduct} onNavigateToEdit={handleNavigateToEditProduct} />;
      case 'products-add':
        return <ProductAdd onNavigateBack={handleNavigateBackToList} />;
      case 'products-edit':
        return selectedProduct ? (
          <ProductEdit product={selectedProduct} onNavigateBack={handleNavigateBackToList} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-lg">Produit introuvable</p>
          </div>
        );
      case 'purchase-orders-list':
        return <PurchaseOrdersList onNavigateToAdd={handleNavigateToAddPurchaseOrder} onNavigateToEdit={handleNavigateToEditPurchaseOrder} onConvertToDelivery={handleConvertPurchaseOrderToDelivery} />;
      case 'purchase-orders-add':
        return <PurchaseOrderAdd onNavigateBack={handleNavigateBackToList} />;
      case 'purchase-orders-edit':
        return selectedPurchaseOrder ? (
          <PurchaseOrderEdit order={selectedPurchaseOrder} onNavigateBack={handleNavigateBackToList} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-lg">Bon de commande introuvable</p>
          </div>
        );
      case 'payments-list':
        return <PaymentsList />;
      case 'chauffeurs-list':
        return <ChauffeursList onNavigateToAdd={handleNavigateToAddChauffeur} onNavigateToEdit={handleNavigateToEditChauffeur} onNavigateToDetails={handleNavigateToChauffeurDetails} />;
      case 'chauffeurs-add':
        return <ChauffeurAdd onNavigateBack={handleNavigateBackToList} />;
      case 'chauffeurs-edit':
        return selectedChauffeur ? (
          <ChauffeurEdit chauffeur={selectedChauffeur} onNavigateBack={handleNavigateBackToList} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-lg">Chauffeur introuvable</p>
          </div>
        );
      case 'chauffeurs-details':
        return chauffeurForDetails ? (
          <ChauffeurDetails 
            chauffeur={chauffeurForDetails} 
            onNavigateBack={handleNavigateBackToList}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-lg">Chauffeur introuvable</p>
          </div>
        );
      case 'delivery-notes-list':
        return <DeliveryNotesList onNavigateToAdd={handleNavigateToAddDeliveryNote} onNavigateToEdit={handleNavigateToEditDeliveryNote} />;
      case 'delivery-notes-add':
        return <DeliveryNoteAdd onNavigateBack={handleNavigateBackToList} preSelectedPurchaseOrder={preSelectedPurchaseOrder} />;
      case 'delivery-notes-edit':
        return selectedDeliveryNote ? (
          <DeliveryNoteEdit note={selectedDeliveryNote} onNavigateBack={handleNavigateBackToList} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-lg">Bon de livraison introuvable</p>
          </div>
        );
      default:
        return (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-lg">
              {(activeMenuItem === 'Tableau de bord' || activeMenuItem === 'Clients' || activeMenuItem === 'Fournisseurs' || activeMenuItem === 'Produits' || activeMenuItem === 'Bon de commande' || activeMenuItem === 'Chauffeurs')
                ? `Loading ${activeMenuItem.toLowerCase()}...` 
                : `Page ${activeMenuItem} en cours de développement`
              }
            </p>
          </div>
        );
    }
  };

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <img 
            src="https://pub-237d2da54b564d23aaa1c3826e1d4e65.r2.dev/ANTURGOOD/ANTURGOOD.svg" 
            alt="ANTURGOOD Logo" 
            className="h-8 mx-auto mb-4"
          />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Show main dashboard if authenticated
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <img 
            src="https://pub-237d2da54b564d23aaa1c3826e1d4e65.r2.dev/ANTURGOOD/ANTURGOOD.svg" 
            alt="ANTURGOOD Logo" 
            className="h-8"
          />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm border-r border-gray-200">
          <nav className="mt-8">
            <ul className="space-y-1 px-4">
              {sidebarItems.map((item, index) => {
                const IconComponent = item.icon;
                const hasSubmenu = item.submenu && item.submenu.length > 0;
                const isExpanded = expandedMenu === item.name;
                const isActive = activeMenuItem === item.name;
                
                return (
                  <li key={index}>
                    <div>
                      <button
                        onClick={() => handleMenuClick(item.name)}
                        className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-lg transition-colors duration-200 font-medium ${
                          isActive && !activeSubmenu
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center">
                          <IconComponent className="w-5 h-5 mr-3" />
                          {item.name}
                        </div>
                        {hasSubmenu && (
                          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded ? 'transform rotate-90' : ''
                          }`} />
                        )}
                      </button>
                      
                      {hasSubmenu && isExpanded && (
                        <ul className="mt-2 ml-8 space-y-1">
                          {item.submenu.map((subItem, subIndex) => (
                            <li key={subIndex}>
                              <button
                                onClick={() => handleSubmenuClick(item.name, subItem.path, subItem.name)}
                                className={`w-full text-left px-4 py-2 text-sm rounded-lg transition-colors duration-200 ${
                                  isActive && activeSubmenu === subItem.name
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                              >
                                {subItem.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-gray-50 p-8 overflow-auto">
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
}

export default App;