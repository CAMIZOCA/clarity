<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->onDelete('restrict');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->onDelete('set null');
            $table->foreignId('created_by')->constrained('users')->onDelete('restrict');

            // Numeración SRI
            $table->string('establishment', 3);       // 001
            $table->string('emission_point', 3);       // 001
            $table->string('sequential', 9);           // 000000001
            $table->string('access_key', 49)->unique()->nullable(); // Clave de acceso SRI (49 dígitos)
            $table->string('authorization_number', 49)->nullable();

            // Datos del emisor (snapshot al momento de emisión)
            $table->string('issuer_ruc', 13);
            $table->string('issuer_name', 300);
            $table->string('issuer_address', 300)->nullable();

            // Datos del receptor
            $table->string('buyer_cedula_ruc', 13);
            $table->string('buyer_name', 300);
            $table->string('buyer_address', 300)->nullable();
            $table->string('buyer_email', 150)->nullable();

            // Montos
            $table->decimal('subtotal_0', 10, 2)->default(0);    // Base imponible 0%
            $table->decimal('subtotal_12', 10, 2)->default(0);   // Base imponible 12% (o 15%)
            $table->decimal('subtotal_15', 10, 2)->default(0);   // Base imponible 15%
            $table->decimal('iva_amount', 10, 2)->default(0);
            $table->decimal('total', 10, 2);
            $table->decimal('iva_rate', 5, 2)->default(15.00);   // Tasa IVA al momento

            // Estado SRI
            $table->enum('status', [
                'draft',        // Borrador, no enviado
                'signed',       // Firmado digitalmente
                'sent',         // Enviado al SRI
                'authorized',   // Autorizado por SRI
                'rejected',     // Rechazado por SRI
                'cancelled',    // Anulado
            ])->default('draft');

            $table->enum('type', ['factura', 'nota_credito', 'recibo'])->default('factura');
            $table->date('issue_date');
            $table->timestamp('authorized_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('xml_content')->nullable();   // XML generado
            $table->string('pdf_path')->nullable();    // PDF guardado

            $table->timestamps();
            $table->softDeletes();

            $table->index(['establishment', 'emission_point', 'sequential']);
            $table->index('status');
            $table->index('issue_date');
            $table->index('buyer_cedula_ruc');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
