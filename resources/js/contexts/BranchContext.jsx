import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const BranchContext = createContext(null);

export const BranchProvider = ({ children }) => {
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar sucursales al inicio
    client.get('/branches').then(res => {
      const data = res.data?.data || res.data || [];
      setBranches(data);
      // Restaurar sucursal activa del localStorage
      const saved = localStorage.getItem('active_branch_id');
      const found = saved ? data.find(b => b.id === parseInt(saved)) : null;
      setActiveBranch(found || data[0] || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const switchBranch = (branch) => {
    setActiveBranch(branch);
    localStorage.setItem('active_branch_id', branch.id);
  };

  return (
    <BranchContext.Provider value={{ branches, activeBranch, switchBranch, loading }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be inside BranchProvider');
  return ctx;
};
