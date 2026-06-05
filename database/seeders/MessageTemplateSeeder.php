<?php

namespace Database\Seeders;

use App\Models\MessageTemplate;
use Illuminate\Database\Seeder;

class MessageTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $templates = [
            [
                'name'      => 'Recordatorio de Cita',
                'type'      => 'appointment_reminder',
                'channel'   => 'whatsapp',
                'body'      => 'Hola {nombre}, le recordamos su cita en {optica} el {fecha}. ¡Le esperamos!',
                'variables' => ['{nombre}', '{optica}', '{fecha}'],
                'is_active' => true,
            ],
            [
                'name'      => 'Orden de Laboratorio Lista',
                'type'      => 'lab_ready',
                'channel'   => 'whatsapp',
                'body'      => 'Estimado {nombre}, sus lentes están listos para retiro en {optica}. Horario: Lun-Sab 9h-19h.',
                'variables' => ['{nombre}', '{optica}'],
                'is_active' => true,
            ],
            [
                'name'      => 'Felicitación de Cumpleaños',
                'type'      => 'birthday',
                'channel'   => 'whatsapp',
                'body'      => '¡Feliz cumpleaños {nombre}! En {optica} le deseamos un excelente día. Visítenos y obtenga un 10% en su próxima compra.',
                'variables' => ['{nombre}', '{optica}'],
                'is_active' => true,
            ],
            [
                'name'      => 'Recordatorio Control Visual',
                'type'      => 'custom',
                'channel'   => 'whatsapp',
                'body'      => 'Hola {nombre}, han pasado 12 meses desde su último control visual. Le recomendamos agendar su cita en {optica}.',
                'variables' => ['{nombre}', '{optica}'],
                'is_active' => true,
            ],
            [
                'name'      => 'Recordatorio de Saldo Pendiente',
                'type'      => 'balance_reminder',
                'channel'   => 'whatsapp',
                'body'      => 'Estimado {nombre}, tiene un saldo pendiente de ${monto} en {optica}. Contáctenos para coordinar el pago.',
                'variables' => ['{nombre}', '{monto}', '{optica}'],
                'is_active' => true,
            ],
            [
                'name'      => 'Reorden Lentes de Contacto',
                'type'      => 'reorder',
                'channel'   => 'whatsapp',
                'body'      => 'Hola {nombre}, es momento de renovar sus lentes de contacto. Comuníquese con {optica}.',
                'variables' => ['{nombre}', '{optica}'],
                'is_active' => true,
            ],
        ];

        foreach ($templates as $data) {
            MessageTemplate::firstOrCreate(
                ['name' => $data['name'], 'type' => $data['type']],
                $data
            );
        }
    }
}
