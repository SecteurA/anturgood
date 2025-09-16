import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, Truck, Eye } from 'lucide-react';
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

interface ChauffeursListProps {
  onNavigateToAdd: () => void;
  onNavigateToEdit: (chauffeur: Chauffeur) => void;
  onNavigateToDetails?: (chauffeur: Chauffeur) => void;
}

const ChauffeursList: React.FC<ChauffeursListProps> = ({ onNavigateToAdd, onNavigateToEdit, onNavigateToDetails }) => {
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;

  // Fetch chauffeurs from Supabase
  const fetchChauffeurs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('chauffeurs')
        .select(`
          id,
          numero_chauffeur,
          nom,
          prenom,
          telephone,
          immatricule,
          type_chauffeur,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setChauffeurs(data || []);
    } catch (err: any) {
      console.error('Error fetching chauffeurs:', err);
      setError('Erreur lors du chargement des chauffeurs');
    } finally {
      setLoading(false);
    }
  };

  // Load chauffeurs on component mount
  React.useEffect(() => {
    fetchChauffeurs();
  }, []);

  // Filter chauffeurs based on search term
  const filteredChauffeurs = chauffeurs.filter(chauffeur =>
    chauffeur.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chauffeur.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chauffeur.numero_chauffeur.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chauffeur.telephone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chauffeur.immatricule.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate pagination
  const totalPages = Math.ceil(filteredChauffeurs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentChauffeurs = filteredChauffeurs.slice(startIndex, endIndex);

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

  const handleChauffeurClick = (chauffeur: Chauffeur) => {
    onNavigateToEdit(chauffeur);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Chargement des chauffeurs...</p>
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
            onClick={fetchChauffeurs}
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
          <h1 className="text-3xl font-bold text-gray-900">Chauffeurs</h1>
          <p className="text-gray-600 mt-1">Gérez vos chauffeurs et leurs véhicules assignés</p>
        </div>
        <button
          onClick={onNavigateToAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors duration-200 shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Ajouter un chauffeur
        </button>
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

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Numéro Chauffeur
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Nom & Prénom
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Véhicule Assigné
                </th>
               <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                 Type
               </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentChauffeurs.length > 0 ? (
                currentChauffeurs.map((chauffeur) => (
                  <tr 
                    key={chauffeur.id} 
                    onClick={() => onNavigateToDetails?.(chauffeur)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {chauffeur.numero_chauffeur}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Truck className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {chauffeur.prenom} {chauffeur.nom}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {chauffeur.telephone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-full font-mono">
                          {chauffeur.immatricule}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        chauffeur.type_chauffeur === 'interne' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {chauffeur.type_chauffeur === 'interne' ? 'Interne' : 'Externe'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToDetails?.(chauffeur);
                          }}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Voir
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleChauffeurClick(chauffeur);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors duration-200"
                        >
                          Modifier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Truck className="w-8 h-8 text-gray-300 mb-2" />
                      <p>{searchTerm ? 'Aucun chauffeur trouvé' : 'Aucun chauffeur disponible'}</p>
                      {!searchTerm && (
                        <button
                          onClick={onNavigateToAdd}
                          className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Ajouter votre premier chauffeur
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
            Affichage de {startIndex + 1} à {Math.min(endIndex, filteredChauffeurs.length)} sur {filteredChauffeurs.length} chauffeurs
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

export default ChauffeursList;