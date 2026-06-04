import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save } from 'lucide-react';
import client from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

export default function PatientFormPage() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm();

    useEffect(() => {
        if (isEdit) {
            client.get(`/patients/${id}`).then(r => reset(r.data));
        }
    }, [id]);

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            if (isEdit) {
                await client.put(`/patients/${id}`, data);
                addToast('Paciente actualizado correctamente', 'success');
            } else {
                const res = await client.post('/patients', data);
                addToast('Paciente registrado correctamente', 'success');
                navigate(`/pacientes/${res.data.id}`);
                return;
            }
            navigate(`/pacientes/${id}`);
        } catch (err) {
            const msg = err.response?.data?.message || 'Error al guardar';
            addToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {isEdit ? 'Editar Paciente' : 'Nuevo Paciente'}
                    </h1>
                    <p className="text-gray-500">Complete todos los campos del paciente</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Nombre completo"
                        required
                        error={errors.nombre?.message}
                        {...register('nombre', { required: 'Requerido' })}
                    />
                    <Input
                        label="Cédula / RUC"
                        required
                        error={errors.cedula?.message}
                        {...register('cedula', { required: 'Requerido' })}
                    />
                    <Input
                        label="Fecha de nacimiento"
                        type="date"
                        required
                        error={errors.fecha_nacimiento?.message}
                        {...register('fecha_nacimiento', { required: 'Requerido' })}
                    />
                    <Input
                        label="Ocupación"
                        {...register('ocupacion')}
                    />
                    <Input
                        label="Teléfono"
                        type="tel"
                        {...register('telefono')}
                    />
                    <Input
                        label="Email"
                        type="email"
                        {...register('email')}
                    />
                    <div className="md:col-span-2">
                        <Input
                            label="Dirección"
                            {...register('direccion')}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Antecedentes médicos oculares
                        </label>
                        <textarea
                            rows={4}
                            className="w-full px-3 py-2.5 text-base rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] focus:bg-[#fef08a]/20 resize-none"
                            placeholder="Historial de enfermedades oculares, cirugías, alergias..."
                            {...register('antecedentes')}
                        />
                    </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <Button type="submit" size="lg" loading={loading}>
                        <Save size={20} />
                        {isEdit ? 'Actualizar' : 'Registrar Paciente'}
                    </Button>
                    <Button type="button" variant="secondary" size="lg" onClick={() => navigate(-1)}>
                        Cancelar
                    </Button>
                </div>
            </form>
        </div>
    );
}
