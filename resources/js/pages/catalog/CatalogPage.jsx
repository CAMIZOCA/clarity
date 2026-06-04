import React, { useEffect, useState } from 'react';
import { Database, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';

function ItemRow({ item, onSave, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState(item.label);
    const [code, setCode] = useState(item.code ?? '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        await onSave(item.id, { label, code: code || null });
        setSaving(false);
        setEditing(false);
    };

    if (editing) {
        return (
            <tr className="bg-blue-50">
                <td className="px-4 py-2">
                    <input
                        autoFocus
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="Código"
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1a2a4a]"
                    />
                </td>
                <td className="px-4 py-2">
                    <input
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        placeholder="Nombre"
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1a2a4a]"
                    />
                </td>
                <td className="px-4 py-2 flex gap-2">
                    <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
                    <button onClick={() => { setEditing(false); setLabel(item.label); setCode(item.code ?? ''); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </td>
            </tr>
        );
    }

    return (
        <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-4 py-2 text-sm text-gray-500">{item.code || '—'}</td>
            <td className="px-4 py-2 text-sm text-gray-800">{item.label}</td>
            <td className="px-4 py-2 flex gap-2">
                <button onClick={() => setEditing(true)} className="text-blue-500 hover:text-blue-700"><Pencil size={15} /></button>
                <button onClick={() => onDelete(item)} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
            </td>
        </tr>
    );
}

function NewItemRow({ groupId, onCreated, onCancel }) {
    const [label, setLabel] = useState('');
    const [code, setCode] = useState('');
    const [saving, setSaving] = useState(false);
    const { addToast } = useToast();

    const save = async () => {
        if (!label.trim()) return;
        setSaving(true);
        try {
            const res = await client.post('/catalog-items', { group_id: groupId, label: label.trim(), code: code.trim() || null });
            onCreated(res.data);
            setLabel('');
            setCode('');
        } catch { addToast('Error al crear elemento', 'error'); }
        finally { setSaving(false); }
    };

    return (
        <tr className="bg-green-50">
            <td className="px-4 py-2">
                <input
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Código (opcional)"
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1a2a4a]"
                />
            </td>
            <td className="px-4 py-2">
                <input
                    autoFocus
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && save()}
                    placeholder="Nombre del elemento"
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1a2a4a]"
                />
            </td>
            <td className="px-4 py-2 flex gap-2">
                <button onClick={save} disabled={saving || !label.trim()} className="text-green-600 hover:text-green-800 disabled:opacity-40"><Check size={16} /></button>
                <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </td>
        </tr>
    );
}

function GroupPanel({ group, onUpdate }) {
    const [adding, setAdding] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const { addToast } = useToast();

    const handleSave = async (id, data) => {
        try {
            const res = await client.put(`/catalog-items/${id}`, data);
            onUpdate(group.id, group.items.map(it => it.id === id ? res.data : it));
            addToast('Guardado', 'success');
        } catch { addToast('Error al guardar', 'error'); }
    };

    const handleDelete = async () => {
        try {
            await client.delete(`/catalog-items/${toDelete.id}`);
            onUpdate(group.id, group.items.filter(it => it.id !== toDelete.id));
            addToast('Eliminado', 'success');
        } catch { addToast('Error al eliminar', 'error'); }
        finally { setToDelete(null); }
    };

    const handleCreated = (item) => {
        onUpdate(group.id, [...group.items, item]);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                    <h3 className="font-semibold text-gray-900">{group.name}</h3>
                    {group.description && <p className="text-xs text-gray-400 mt-0.5">{group.description}</p>}
                </div>
                <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                    <Plus size={14} /> Agregar
                </Button>
            </div>
            <table className="w-full">
                <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                        <th className="px-4 py-2 text-left w-28">Código</th>
                        <th className="px-4 py-2 text-left">Nombre</th>
                        <th className="px-4 py-2 w-20" />
                    </tr>
                </thead>
                <tbody>
                    {group.items.map(item => (
                        <ItemRow key={item.id} item={item} onSave={handleSave} onDelete={setToDelete} />
                    ))}
                    {adding && (
                        <NewItemRow
                            groupId={group.id}
                            onCreated={(item) => { handleCreated(item); setAdding(false); }}
                            onCancel={() => setAdding(false)}
                        />
                    )}
                    {group.items.length === 0 && !adding && (
                        <tr><td colSpan={3} className="px-4 py-4 text-sm text-gray-400 text-center">Sin elementos. Haz clic en Agregar.</td></tr>
                    )}
                </tbody>
            </table>
            <ConfirmModal
                open={!!toDelete}
                title="Eliminar elemento"
                message={`¿Eliminar "${toDelete?.label}"? Esta acción no se puede deshacer.`}
                onConfirm={handleDelete}
                onCancel={() => setToDelete(null)}
            />
        </div>
    );
}

export default function CatalogPage() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        client.get('/catalog-groups').then(r => setGroups(r.data)).finally(() => setLoading(false));
    }, []);

    const handleUpdate = (groupId, newItems) => {
        setGroups(gs => gs.map(g => g.id === groupId ? { ...g, items: newItems } : g));
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Database size={28} className="text-[#1a2a4a]" /> Catálogos del sistema
                </h1>
                <p className="text-gray-500 mt-1">Administra los valores disponibles en los formularios (materiales, diagnósticos, plantillas, etc.)</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin h-10 w-10 border-4 border-[#1a2a4a] border-t-transparent rounded-full" />
                </div>
            ) : (
                <div className="space-y-6">
                    {groups.map(group => (
                        <GroupPanel key={group.id} group={group} onUpdate={handleUpdate} />
                    ))}
                    {groups.length === 0 && (
                        <div className="text-center py-16 text-gray-400">No hay catálogos configurados en el sistema.</div>
                    )}
                </div>
            )}
        </div>
    );
}
