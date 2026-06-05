import React from 'react';
import { CheckCircle2, CircleDollarSign, Package, UserRound } from 'lucide-react';

export function HeroMockup() {
    return (
        <div className="landing-float relative mx-auto max-w-4xl rounded-[1.75rem] border border-white/70 bg-white/88 p-4 shadow-2xl shadow-slate-900/16 backdrop-blur">
            <div className="flex items-center justify-between border-b border-[var(--landing-line)] pb-4">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--landing-cyan)]">Panel demo</p>
                    <p className="text-lg font-black text-[var(--landing-ink)]">Sucursal Centro</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Datos ficticios</span>
            </div>
            <div className="grid gap-4 pt-4 md:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl bg-[var(--landing-soft)] p-4">
                    <div className="flex items-center justify-between">
                        <p className="font-black text-[var(--landing-ink)]">Agenda y atencion</p>
                        <span className="text-sm font-bold text-[var(--landing-muted)]">Hoy</span>
                    </div>
                    {[
                        ['Andrea Morales', 'Consulta optometrica', '09:30'],
                        ['Luis Andrade', 'Entrega de lentes', '11:00'],
                        ['Sofia Rivera', 'Control visual', '15:20'],
                    ].map(([name, detail, time]) => (
                        <div key={name} className="mt-3 flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-[var(--landing-cyan)]"><UserRound size={19} /></span>
                                <span>
                                    <span className="block font-black text-[var(--landing-ink)]">{name}</span>
                                    <span className="block text-sm text-[var(--landing-muted)]">{detail}</span>
                                </span>
                            </div>
                            <span className="font-black text-[var(--landing-blue)]">{time}</span>
                        </div>
                    ))}
                </div>
                <div className="grid gap-4">
                    <div className="rounded-2xl bg-[var(--landing-navy)] p-4 text-white">
                        <p className="text-sm font-bold text-white/62">Ventas del mes</p>
                        <p className="mt-2 text-3xl font-black">$ 18.420</p>
                        <p className="mt-1 text-sm text-white/62">Cifra demostrativa para mockup</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--landing-line)] bg-white p-4">
                        <p className="font-black text-[var(--landing-ink)]">Orden ORD-1048</p>
                        <div className="mt-4 space-y-3">
                            {['Venta registrada', 'Pago parcial', 'En laboratorio'].map((item) => (
                                <div key={item} className="flex items-center gap-2 text-sm font-bold text-[var(--landing-muted)]">
                                    <CheckCircle2 size={17} className="text-emerald-600" />
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const mockupRows = {
    patient: [['Paciente', 'Andrea Morales'], ['Ultima consulta', 'Control visual'], ['Ventas asociadas', '3 registros']],
    clinical: [['OD esfera', '-1.25'], ['OI esfera', '-1.00'], ['Diagnostico', 'Miopia']],
    sales: [['Venta', 'V-2026-00108'], ['Saldo', '$ 48.00'], ['Estado', 'Pago parcial']],
    inventory: [['Producto', 'Armazon Clasico'], ['Stock', '18 unidades'], ['Bodega', 'Principal']],
    lab: [['Orden', 'LB-2026-00042'], ['Estado', 'En proceso'], ['Entrega estimada', 'Viernes']],
    reports: [['Ventas', '$ 18.420'], ['Ordenes pendientes', '12'], ['Bajo stock', '7 productos']],
};

export function ModuleMockup({ type }) {
    const rows = mockupRows[type] || mockupRows.patient;

    return (
        <div className="relative overflow-hidden rounded-3xl border border-[var(--landing-line)] bg-white p-5 shadow-xl shadow-slate-900/8">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-cyan-100 blur-2xl" />
            <div className="relative">
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--landing-cyan)]">Mockup demo</p>
                        <p className="text-xl font-black text-[var(--landing-ink)]">Vista operativa</p>
                    </div>
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--landing-soft)] text-[var(--landing-blue)]">
                        {type === 'inventory' ? <Package size={21} /> : type === 'sales' ? <CircleDollarSign size={21} /> : <CheckCircle2 size={21} />}
                    </span>
                </div>
                <div className="space-y-3">
                    {rows.map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-xl bg-[var(--landing-soft)] px-4 py-3">
                            <span className="text-sm font-bold text-[var(--landing-muted)]">{label}</span>
                            <span className="font-black text-[var(--landing-ink)]">{value}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-5 h-24 rounded-xl bg-[linear-gradient(135deg,var(--landing-blue),var(--landing-cyan))] p-4 text-white">
                    <p className="text-sm font-bold text-white/70">Indicador demostrativo</p>
                    <div className="mt-4 flex h-8 items-end gap-2">
                        {[35, 52, 46, 72, 58, 84].map((height, index) => (
                            <span key={index} className="w-full rounded-t bg-white/75" style={{ height: `${height}%` }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
