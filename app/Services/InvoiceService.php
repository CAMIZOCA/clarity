<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Sale;
use App\Models\Branch;
use App\Support\AppConfig;
use Illuminate\Support\Facades\Log;

/**
 * Servicio de Facturación Electrónica SRI Ecuador.
 *
 * Estado: STUB FUNCIONAL
 * - Genera estructura de factura y número secuencial
 * - Genera XML básico compatible con SRI (formato 1.0.0)
 * - La firma digital y envío al SRI requieren certificado .p12 y
 *   la librería de firma (pendiente de integración en producción)
 *
 * Para producción real: integrar con librería de firma XAdES-BES
 * y los web services del SRI (ambiente 1=pruebas, 2=producción)
 */
class InvoiceService extends BaseService
{
    private string $environment;

    public function __construct()
    {
        $this->environment = config('services.sri.environment', '1'); // 1=pruebas
    }

    /**
     * Crear factura desde una venta pagada.
     * Genera el número secuencial, datos del receptor y montos.
     */
    public function createFromSale(Sale $sale, int $createdBy): Invoice
    {
        return $this->transaction(function () use ($sale, $createdBy) {
            $branch = $sale->branch ?? Branch::where('is_main', true)->first();

            if (! $branch?->ruc) {
                throw new \Exception('La sucursal no tiene RUC configurado para facturación.');
            }

            $establishment = $branch->sri_establishment ?? '001';
            $sequential    = $this->getNextSequential($establishment, '001');

            $patient = $sale->patient;
            $buyerDoc = $patient?->cedula ?? '9999999999999'; // Consumidor final si no hay paciente

            $invoice = Invoice::create([
                'sale_id'          => $sale->id,
                'branch_id'        => $sale->branch_id,
                'created_by'       => $createdBy,
                'establishment'    => $establishment,
                'emission_point'   => '001',
                'sequential'       => $sequential,
                'issuer_ruc'       => $branch->ruc,
                'issuer_name'      => $branch->name,
                'issuer_address'   => $branch->address ?? '',
                'buyer_cedula_ruc' => $buyerDoc,
                'buyer_name'       => $patient?->nombre ?? 'CONSUMIDOR FINAL',
                'buyer_address'    => $patient?->direccion ?? '',
                'buyer_email'      => $patient?->email ?? '',
                'subtotal_0'       => $sale->tax_exempt_base,
                'subtotal_15'      => $sale->taxable_base,
                'iva_amount'       => $sale->tax_amount,
                'total'            => $sale->total,
                'iva_rate'         => AppConfig::IVA_RATE * 100, // 15
                'issue_date'       => now()->toDateString(),
                'status'           => 'draft',
                'type'             => 'factura',
            ]);

            // Actualizar número de factura en la venta
            $sale->update(['invoice_number' => $invoice->full_number]);

            $this->logActivity('invoice_created', $invoice, [
                'sale_id'    => $sale->id,
                'sequential' => $sequential,
            ]);

            return $invoice;
        });
    }

    /**
     * Generar XML de la factura (estructura básica SRI Ecuador).
     * NOTA: En producción debe firmarse con certificado digital .p12
     */
    public function generateXml(Invoice $invoice): string
    {
        $accessKey = $this->generateAccessKey($invoice);
        $invoice->update(['access_key' => $accessKey]);

        $xml = $this->buildXmlStructure($invoice, $accessKey);
        $invoice->update(['xml_content' => $xml, 'status' => 'signed']);

        Log::info("SRI XML generado para factura {$invoice->full_number} (STUB - sin firma real)");

        return $xml;
    }

    /**
     * Enviar al SRI (STUB - solo simula el envío en desarrollo).
     * En producción: usar los web services del SRI con SOAP.
     */
    public function sendToSri(Invoice $invoice): array
    {
        if ($this->environment === '1') {
            // Ambiente de pruebas: simular autorización
            Log::info("SRI STUB [PRUEBAS] → Factura {$invoice->full_number} enviada (simulado)");
            $invoice->update([
                'status'               => 'authorized',
                'authorization_number' => $invoice->access_key,
                'authorized_at'        => now(),
            ]);
            return ['authorized' => true, 'message' => 'Autorizado (ambiente de pruebas)'];
        }

        // Producción: requiere implementación real con SOAP
        throw new \Exception('Envío a SRI producción no implementado. Configure el certificado digital .p12 del SRI.');
    }

    /**
     * Obtener el próximo número secuencial disponible.
     */
    private function getNextSequential(string $establishment, string $emissionPoint): string
    {
        $last = Invoice::where('establishment', $establishment)
            ->where('emission_point', $emissionPoint)
            ->whereYear('created_at', now()->year)
            ->max('sequential');

        $next = $last ? ((int) $last + 1) : 1;
        return str_pad($next, 9, '0', STR_PAD_LEFT);
    }

    /**
     * Generar clave de acceso SRI (49 dígitos).
     */
    private function generateAccessKey(Invoice $invoice): string
    {
        $date       = now()->format('dmY'); // ddMMYYYY
        $voucher    = '01'; // Factura
        $ruc        = $invoice->issuer_ruc;
        $env        = $this->environment;
        $series     = $invoice->establishment . $invoice->emission_point;
        $sequential = $invoice->sequential;
        $code       = str_pad(random_int(1, 99999999), 8, '0', STR_PAD_LEFT);
        $type       = '1'; // Normal

        $base     = $date . $voucher . $ruc . $env . $series . $sequential . $code . $type;
        $verifier = $this->calculateVerifierDigit($base);

        return $base . $verifier;
    }

    private function calculateVerifierDigit(string $key): string
    {
        $weights  = [2, 3, 4, 5, 6, 7];
        $sum      = 0;
        $reversed = strrev($key);
        for ($i = 0; $i < strlen($reversed); $i++) {
            $sum += (int) $reversed[$i] * $weights[$i % 6];
        }
        $mod    = $sum % 11;
        $digit  = match ($mod) {
            0       => 0,
            1       => 1,
            default => 11 - $mod,
        };
        return (string) $digit;
    }

    private function buildXmlStructure(Invoice $invoice, string $accessKey): string
    {
        $issueDate = $invoice->issue_date instanceof \Carbon\Carbon
            ? $invoice->issue_date->format('d/m/Y')
            : $invoice->issue_date;

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" .
               "<factura id=\"comprobante\" version=\"1.0.0\">\n" .
               "  <infoTributaria>\n" .
               "    <ambiente>{$this->environment}</ambiente>\n" .
               "    <tipoEmision>1</tipoEmision>\n" .
               "    <razonSocial>" . htmlspecialchars($invoice->issuer_name) . "</razonSocial>\n" .
               "    <ruc>{$invoice->issuer_ruc}</ruc>\n" .
               "    <claveAcceso>{$accessKey}</claveAcceso>\n" .
               "    <codDoc>01</codDoc>\n" .
               "    <estab>{$invoice->establishment}</estab>\n" .
               "    <ptoEmi>{$invoice->emission_point}</ptoEmi>\n" .
               "    <secuencial>{$invoice->sequential}</secuencial>\n" .
               "    <dirMatriz>" . htmlspecialchars($invoice->issuer_address ?? '') . "</dirMatriz>\n" .
               "  </infoTributaria>\n" .
               "  <!-- STUB: Completar con detalles de items y totales -->\n" .
               "  <infoFactura>\n" .
               "    <fechaEmision>{$issueDate}</fechaEmision>\n" .
               "    <totalSinImpuestos>{$invoice->subtotal_15}</totalSinImpuestos>\n" .
               "    <totalDescuento>0.00</totalDescuento>\n" .
               "    <importeTotal>{$invoice->total}</importeTotal>\n" .
               "  </infoFactura>\n" .
               "</factura>";
    }
}
