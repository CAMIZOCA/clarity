<?php

namespace App\Mail;

use App\Models\Certificate;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class CertificateMail extends ClinicMailable
{
    public function __construct(public Certificate $certificate) {}

    public function envelope(): Envelope
    {
        $clinic = self::brand()['name'];
        $subject = $this->certificate->subject
            ?: "Certificado Visual - {$clinic}";

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        $this->certificate->loadMissing('patient:id,nombre,apellido');

        return new Content(
            view: 'emails.certificate',
            text: 'emails.certificate-text',
            with: [
                'brand' => self::brand(),
                'patientName' => $this->certificate->patient?->nombre_completo,
                'filename' => $this->filename(),
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [
            Attachment::fromStorageDisk('public', $this->certificate->pdf_path)
                ->as($this->filename())
                ->withMime('application/pdf'),
        ];
    }

    private function filename(): string
    {
        return 'certificado_'.($this->certificate->numero_consulta ?: $this->certificate->id).'.pdf';
    }
}
