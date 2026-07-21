<?php

namespace App\Mail;

use App\Models\Certificate;
use App\Models\Setting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CertificateMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Certificate $certificate) {}

    public function envelope(): Envelope
    {
        $clinic = Setting::get('clinic_name', 'Óptica');
        $subject = $this->certificate->subject
            ?: "Certificado Visual - {$clinic}";

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        $this->certificate->loadMissing('patient');

        return new Content(
            view: 'emails.certificate',
            with: [
                'clinicName' => Setting::get('clinic_name', 'Óptica'),
                'patientName' => $this->certificate->patient?->nombre,
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        $filename = 'certificado_'.($this->certificate->numero_consulta ?: $this->certificate->id).'.pdf';

        return [
            Attachment::fromStorageDisk('public', $this->certificate->pdf_path)
                ->as($filename)
                ->withMime('application/pdf'),
        ];
    }
}
