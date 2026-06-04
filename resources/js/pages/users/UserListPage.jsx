import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, User, Shield } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';

export default function UserListPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const { addToast } = useToast();
    const { isAdmin, user: me } = useAuth();
    const navigate = useNavigate();

    const fetch = async () => {
        setLoading(true);
        try {
            const res = await client.get('/users');
            setUsers(res.data.data ?? res.data);
        } catch {
            addToast('Error al cargar usuarios', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetch(); }, []);

    const askDelete = (u) => { setToDelete(u); setConfirmOpen(true); };

    const handleDelete = async () => {
        try {
            await client.delete(`/users/${toDelete.id}`);
            addToast('Usuario eliminado', 'success');
            setConfirmOpen(false);
            setToDelete(null);
            fetch();
        } catch {
            addToast('Error al eliminar', 'error');
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
                    <p className="text-gray-500 mt-1">Gestión de personal y accesos</p>
                </div>
                {isAdmin() && (
                    <Link to="/usuarios/nuevo">
                        <Button size="lg"><Plus size={20} /> Nuevo Usuario</Button>
                    </Link>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-[#1a2a4a] text-white">
                            <th className="px-6 py-4 text-left text-sm font-semibold">Usuario</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Rol</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Código</th>
                            <th className="px-6 py-4 text-left text-sm font-semibold">Senescyt</th>
                            {isAdmin() && <th className="px-6 py-4 text-center text-sm font-semibold">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="py-16 text-center">
                                <div className="animate-spin h-8 w-8 border-4 border-[#1a2a4a] border-t-transparent rounded-full mx-auto" />
                            </td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={5} className="py-16 text-center">
                                <User size={48} className="mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500">Sin usuarios registrados</p>
                            </td></tr>
                        ) : users.map((u, i) => (
                            <tr key={u.id} className={`border-t border-gray-100 hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-[#1a2a4a]/10 flex items-center justify-center">
                                            {u.roles?.includes('admin') ? <Shield size={16} className="text-[#1a2a4a]" /> : <User size={16} className="text-[#1a2a4a]" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{u.name}</p>
                                            <p className="text-sm text-gray-500">{u.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {u.roles?.map(r => {
                                        const name = typeof r === 'string' ? r : r.name;
                                        return <Badge key={name} label={name} />;
                                    })}
                                </td>
                                <td className="px-6 py-4 text-gray-700 font-mono text-sm">{u.codigo || '—'}</td>
                                <td className="px-6 py-4 text-gray-700 text-sm">{u.registro_senescyt || '—'}</td>
                                {isAdmin() && (
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => navigate(`/usuarios/${u.id}/editar`)}
                                                className="p-2 rounded-lg hover:bg-yellow-100 text-yellow-600" title="Editar">
                                                <Edit2 size={18} />
                                            </button>
                                            {u.id !== me?.id && (
                                                <button onClick={() => askDelete(u)}
                                                    className="p-2 rounded-lg hover:bg-red-100 text-red-500" title="Eliminar">
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmModal
                open={confirmOpen}
                title={`¿Eliminar a ${toDelete?.name}?`}
                message="El usuario no podrá iniciar sesión. Esta acción no se puede deshacer."
                confirmLabel="Eliminar usuario"
                onConfirm={handleDelete}
                onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
            />
        </div>
    );
}
