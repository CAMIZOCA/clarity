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
    }, [id, isEdit, reset]);

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
        <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-24">
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

            <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Nombre completo"
                        required
                        error={errors.nombre?.message}
                        nextFieldId="cedula"
                        {...register('nombre', { required: 'Requerido' })}
                    />
                    <Input
                        label="CÃ©dula / RUC"
                        required
                        error={errors.cedula?.message}
                        inputMode="numeric"
                        nextFieldId="fecha_nacimiento"
                        {...register('cedula', { required: 'Requerido' })}
                    />
                    <Input
                        id="fecha_nacimiento"
                        label="Fecha de nacimiento"
                        type="date"
                        required
                        error={errors.fecha_nacimiento?.message}
                        nextFieldId="ocupacion"
                        {...register('fecha_nacimiento', { required: 'Requerido' })}
                    />
                    <Input
                        label="OcupaciÃ³n"
                        nextFieldId="telefono"
                        {...register('ocupacion')}
                    />
                    <Input
                        label="TelÃ©fono"
                        type="tel"
                        nextFieldId="email"
                        {...register('telefono')}
                    />
                    <Input
                        label="Email"
                        type="email"
                        nextFieldId="direccion"
                        {...register('email')}
                    />
                    <div className="md:col-span-2">
                        <Input
                            label="DirecciÃ³n"
                            nextFieldId="antecedentes"
                            {...register('direccion')}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Antecedentes mÃ©dicos oculares
                        </label>
                        <textarea
                            id="antecedentes"
                            rows={4}
                            className="w-full px-3 py-2.5 text-base rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a] focus:bg-[#fef08a]/20 resize-none"
                            placeholder="Historial de enfermedades oculares, cirugÃ­as, alergias..."
                            {...register('antecedentes')}
                        />
                    </div>
                </div>

                <div className="mobile-sticky-actions -mx-5 px-5 py-4 sm:-mx-8 sm:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button type="submit" size="lg" loading={loading} className="w-full justify-center sm:flex-1">
                            <Save size={20} />
                            {isEdit ? 'Actualizar' : 'Registrar Paciente'}
                        </Button>
                        <Button type="button" variant="secondary" size="lg" onClick={() => navigate(-1)} className="w-full justify-center sm:flex-1">
                            Cancelar
                        </Button>
                    </div>
                </div>

                <div className="hidden gap-3 pt-4 border-t border-gray-100 sm:flex">
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
