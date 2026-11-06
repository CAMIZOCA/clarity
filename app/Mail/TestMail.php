<?php

namespace App\Mail;

use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Correo de prueba de Configuracion → Correo: muestra el diseño real. */
class TestMail extends ClinicMailable
{
    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Prueba de correo - '.self::brand()['name']);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.test',
            text: 'emails.test-text',
            with: [
                'brand' => self::brand(),
                'sentAt' => now()->format('d/m/Y H:i'),
            ],
        );
    }
}
