import { useState, useEffect } from 'react';
import { getEventi, getPiloti } from '../services/api';

function Dashboard() {
  const [stats, setStats] = useState({
    eventi: 0,
    piloti: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [eventiRes, pilotiRes] = await Promise.all([
          getEventi(),
          getPiloti()
        ]);
        setStats({
          eventi: eventiRes.data.length,
          piloti: pilotiRes.data.length,
        });
      } catch (error) {
        console.error('Errore caricamento statistiche:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Dashboard Organizzatore
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Eventi Totali</p>
              <p className="text-3xl font-bold text-blue-600">{stats.eventi}</p>
            </div>
            <div className="text-4xl">📅</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Piloti Registrati</p>
              <p className="text-3xl font-bold text-green-600">{stats.piloti}</p>
            </div>
            <div className="text-4xl">🏍️</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Sistema</p>
              <p className="text-lg font-bold text-green-600">Operativo</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
