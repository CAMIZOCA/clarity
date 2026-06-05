<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Sale;
use App\Services\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    use ApiResponses;

    public function __construct(private InvoiceService $invoiceService) {}

    /**
     * Listar facturas con filtros.
     * GET /api/invoices
     */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value) &&
            ! $request->user()->can(Permission::SALES_VIEW->value)) {
            return $this->forbidden();
        }

        $query = Invoice::with(['sale.patient', 'branch', 'createdBy'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('issue_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('issue_date', '<=', $request->date_to);
        }
        if ($request->filled('buyer')) {
            $search = $request->buyer;
            $query->where(function ($q) use ($search) {
                $q->where('buyer_name', 'LIKE', "%{$search}%")
                  ->orWhere('buyer_cedula_ruc', 'LIKE', "%{$search}%");
            });
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $invoices = $query->paginate(20);

        return $this->ok($invoices);
    }

    /**
     * Crear factura desde una venta.
     * POST /api/invoices
     * Body: { sale_id: int }
     */
    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value) &&
            ! $request->user()->can(Permission::SALES_CREATE->value)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'sale_id' => 'required|integer|exists:sales,id',
        ]);

        $sale = Sale::with(['patient', 'branch'])->findOrFail($validated['sale_id']);

        // Verificar que no tenga factura ya creada
        if (Invoice::where('sale_id', $sale->id)->exists()) {
            return $this->error('Esta venta ya tiene una factura generada.', 422);
        }

        // Verificar que la venta esté pagada
        if (! in_array($sale->status, ['paid', 'partial', 'confirmed'])) {
            return $this->error('Solo se pueden facturar ventas confirmadas o pagadas.', 422);
        }

        try {
            $invoice = $this->invoiceService->createFromSale($sale, $request->user()->id);
            return $this->created($invoice->load(['sale', 'branch', 'createdBy']));
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    /**
     * Ver detalle de una factura.
     * GET /api/invoices/{invoice}
     */
    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value) &&
            ! $request->user()->can(Permission::SALES_VIEW->value)) {
            return $this->forbidden();
        }

        return $this->ok($invoice->load(['sale.items.product', 'sale.patient', 'branch', 'createdBy']));
    }

    /**
     * Generar XML de la factura.
     * POST /api/invoices/{invoice}/xml
     */
    public function generateXml(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value)) {
            return $this->forbidden();
        }

        if (! in_array($invoice->status, ['draft'])) {
            return $this->error('Solo se puede generar XML para facturas en borrador.', 422);
        }

        try {
            $xml = $this->invoiceService->generateXml($invoice);
            return $this->ok([
                'invoice' => $invoice->fresh(),
                'xml'     => $xml,
            ]);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    /**
     * Enviar factura al SRI.
     * POST /api/invoices/{invoice}/send
     */
    public function sendToSri(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value)) {
            return $this->forbidden();
        }

        if (! in_array($invoice->status, ['signed', 'draft'])) {
            return $this->error('La factura debe estar firmada o en borrador para enviarse al SRI.', 422);
        }

        try {
            // Si aún no tiene XML, generarlo primero
            if (! $invoice->xml_content) {
                $this->invoiceService->generateXml($invoice);
                $invoice->refresh();
            }

            $result = $this->invoiceService->sendToSri($invoice);
            return $this->ok([
                'invoice' => $invoice->fresh(),
                'result'  => $result,
            ]);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    /**
     * Descargar/ver contenido de la factura (XML por ahora, PDF futuro).
     * GET /api/invoices/{invoice}/pdf
     */
    public function downloadPdf(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->can(Permission::SETTINGS_EDIT->value) &&
            ! $request->user()->can(Permission::SALES_VIEW->value)) {
            return $this->forbidden();
        }

        if (! $invoice->xml_content) {
            return $this->error('La factura aún no tiene XML generado. Genérelo primero.', 404);
        }

        return response()->json([
            'invoice_number' => $invoice->full_number,
            'status'         => $invoice->status,
            'xml_content'    => $invoice->xml_content,
            'access_key'     => $invoice->access_key,
            'note'           => 'PDF disponible próximamente. Por ahora se retorna el XML generado.',
        ]);
    }
}
