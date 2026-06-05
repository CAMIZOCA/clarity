<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Api\Concerns\ApiResponses;
use App\Http\Controllers\Controller;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\Expense;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CashRegisterController extends Controller
{
    use ApiResponses;

    /**
     * Retorna la sesión abierta actual para una caja específica.
     * GET /api/cash-registers/{register}/current-session
     */
    public function currentSession(Request $request, CashRegister $register): JsonResponse
    {
        if (!$request->user()->can(Permission::CASH_VIEW->value)) {
            return $this->forbidden();
        }

        $session = CashRegisterSession::where('cash_register_id', $register->id)
            ->where('status', 'open')
            ->with(['openedBy', 'cashRegister'])
            ->latest('opened_at')
            ->first();

        return $this->ok(['data' => $session]);
    }

    /**
     * Abre una nueva sesión de caja.
     * POST /api/cash-registers/{register}/open
     */
    public function openSession(Request $request, CashRegister $register): JsonResponse
    {
        if (!$request->user()->can(Permission::CASH_OPEN->value)) {
            return $this->forbidden();
        }

        // Verificar que no haya sesión abierta para esta caja
        $existing = CashRegisterSession::where('cash_register_id', $register->id)
            ->where('status', 'open')
            ->first();

        if ($existing) {
            return response()->json([
                'message' => "La caja '{$register->name}' ya tiene una sesión abierta (ID: {$existing->id}).",
            ], 422);
        }

        $validated = $request->validate([
            'opening_amount' => ['required', 'numeric', 'min:0'],
            'notes'          => ['nullable', 'string', 'max:500'],
        ]);

        $session = CashRegisterSession::create([
            'cash_register_id' => $register->id,
            'opened_by'        => $request->user()->id,
            'opened_at'        => now(),
            'opening_amount'   => $validated['opening_amount'],
            'total_sales'      => 0,
            'total_cash'       => 0,
            'total_card'       => 0,
            'total_transfer'   => 0,
            'total_credit'     => 0,
            'total_refunds'    => 0,
            'total_expenses'   => 0,
            'expected_cash'    => $validated['opening_amount'],
            'status'           => 'open',
            'closing_notes'    => $validated['notes'] ?? null,
        ]);

        return $this->created(
            $session->load(['openedBy', 'cashRegister']),
            "Sesión de caja abierta exitosamente."
        );
    }

    /**
     * Cierra una sesión de caja y calcula los totales.
     * POST /api/cash-registers/sessions/{session}/close
     */
    public function closeSession(Request $request, CashRegisterSession $session): JsonResponse
    {
        if (!$request->user()->can(Permission::CASH_CLOSE->value)) {
            return $this->forbidden();
        }

        if ($session->status !== 'open') {
            return response()->json([
                'message' => 'La sesión ya está cerrada.',
            ], 422);
        }

        $validated = $request->validate([
            'actual_cash'       => ['nullable', 'numeric', 'min:0'],
            'denomination_count' => ['nullable', 'array'],
            'closing_notes'     => ['nullable', 'string', 'max:1000'],
        ]);

        // Calcular totales de pagos en esta sesión
        $payments = Payment::where('cash_register_session_id', $session->id)->get();

        $totalSales    = $payments->sum('amount');
        $totalCash     = $payments->where('method', 'cash')->sum('amount');
        $totalCard     = $payments->where('method', 'card')->sum('amount');
        $totalTransfer = $payments->where('method', 'transfer')->sum('amount');
        $totalCredit   = $payments->where('method', 'credit')->sum('amount');

        // Calcular gastos en esta sesión
        $totalExpenses = Expense::where('cash_register_session_id', $session->id)
            ->whereNull('deleted_at')
            ->sum('amount');

        // Efectivo esperado = apertura + cobros en efectivo - gastos en efectivo
        $expectedCash = (float) $session->opening_amount + (float) $totalCash - (float) $totalExpenses;

        $actualCash = isset($validated['actual_cash']) ? (float) $validated['actual_cash'] : null;
        $difference = $actualCash !== null ? round($expectedCash - $actualCash, 2) : null;

        $session->update([
            'closed_by'         => $request->user()->id,
            'closed_at'         => now(),
            'total_sales'       => round($totalSales, 2),
            'total_cash'        => round($totalCash, 2),
            'total_card'        => round($totalCard, 2),
            'total_transfer'    => round($totalTransfer, 2),
            'total_credit'      => round($totalCredit, 2),
            'total_expenses'    => round($totalExpenses, 2),
            'expected_cash'     => round($expectedCash, 2),
            'actual_cash'       => $actualCash,
            'difference'        => $difference,
            'status'            => 'closed',
            'denomination_count' => $validated['denomination_count'] ?? null,
            'closing_notes'     => $validated['closing_notes'] ?? $session->closing_notes,
        ]);

        return $this->ok(
            $session->fresh()->load(['openedBy', 'closedBy', 'cashRegister']),
            'Sesión de caja cerrada exitosamente.'
        );
    }

    /**
     * Lista sesiones históricas con filtros opcionales.
     * GET /api/cash-registers/sessions
     */
    public function sessions(Request $request): JsonResponse
    {
        if (!$request->user()->can(Permission::CASH_VIEW->value)) {
            return $this->forbidden();
        }

        $query = CashRegisterSession::with(['openedBy', 'closedBy', 'cashRegister']);

        // Si no puede ver todas las sesiones, solo ve las propias
        if (!$request->user()->can(Permission::CASH_VIEW_ALL->value)) {
            $query->where('opened_by', $request->user()->id);
        }

        if ($request->filled('cash_register_id')) {
            $query->where('cash_register_id', $request->cash_register_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('opened_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('opened_at', '<=', $request->date_to);
        }

        $sessions = $query->latest('opened_at')
            ->paginate($request->get('per_page', 20));

        return $this->ok($sessions);
    }

    /**
     * Registra un gasto en la sesión de caja activa.
     * POST /api/cash-registers/sessions/{session}/expenses
     */
    public function storeExpense(Request $request, CashRegisterSession $session): JsonResponse
    {
        if (!$request->user()->can(Permission::CASH_REGISTER_EXPENSES->value)) {
            return $this->forbidden();
        }

        if ($session->status !== 'open') {
            return response()->json([
                'message' => 'No se pueden registrar gastos en una sesión cerrada.',
            ], 422);
        }

        $validated = $request->validate([
            'category'       => ['required', 'string', 'max:100'],
            'description'    => ['required', 'string', 'max:500'],
            'amount'         => ['required', 'numeric', 'min:0.01'],
            'expense_date'   => ['nullable', 'date'],
            'receipt_number' => ['nullable', 'string', 'max:100'],
            'notes'          => ['nullable', 'string', 'max:500'],
        ]);

        $expense = Expense::create([
            'branch_id'                => $session->cashRegister->branch_id ?? null,
            'cash_register_session_id' => $session->id,
            'user_id'                  => $request->user()->id,
            'category'                 => $validated['category'],
            'description'              => $validated['description'],
            'amount'                   => $validated['amount'],
            'expense_date'             => $validated['expense_date'] ?? now()->toDateString(),
            'receipt_number'           => $validated['receipt_number'] ?? null,
            'notes'                    => $validated['notes'] ?? null,
        ]);

        return $this->created($expense->load('user'), 'Gasto registrado exitosamente.');
    }
}
