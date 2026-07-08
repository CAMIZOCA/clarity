<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PatientController;
use App\Http\Controllers\Api\ConsultationController;
use App\Http\Controllers\Api\AppointmentController;
use App\Http\Controllers\Api\BrigadeController;
use App\Http\Controllers\Api\SpecialContactLensController;
use App\Http\Controllers\Api\OphthalmologyReferenceController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\Cie10Controller;
use App\Http\Controllers\Api\ConsultationMetaController;
use App\Http\Controllers\Api\GuaranteeReportController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\CatalogController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\CashRegisterController;
use App\Http\Controllers\Api\LabOrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\WarehouseController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\CrmController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\SystemMaintenanceController;

Route::middleware('auth:sanctum')->group(function () {

    // Patients
    Route::get('/patients/search', [PatientController::class, 'search']);
    Route::apiResource('patients', PatientController::class);
    Route::get('/patients/{patient}/consultations', [PatientController::class, 'consultations']);
    Route::get('/patients/{patient}/last-consultation', [PatientController::class, 'lastConsultation']);

    // Consultations
    Route::get('/consultations-meta', ConsultationMetaController::class);
    Route::get('/consultations/{consultation}/pdf-data', [ConsultationController::class, 'pdfData']);
    Route::apiResource('consultations', ConsultationController::class);

    // Appointments
    Route::apiResource('appointments', AppointmentController::class);

    // Brigades
    Route::post('/brigades/{brigade}/patients', [BrigadeController::class, 'attachPatient']);
    Route::delete('/brigades/{brigade}/patients/{patient}', [BrigadeController::class, 'detachPatient']);
    Route::apiResource('brigades', BrigadeController::class);

    // Special contact lenses
    Route::apiResource('special-contact-lenses', SpecialContactLensController::class);

    // Ophthalmology references
    Route::apiResource('ophthalmology-references', OphthalmologyReferenceController::class);

    // Users
    Route::post('/users/{user}/firma', [UserController::class, 'uploadFirma']);
    Route::apiResource('users', UserController::class);

    // Reports
    Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
    Route::get('/reports/consultations', [ReportController::class, 'consultations']);
    Route::get('/reports/diagnoses', [ReportController::class, 'diagnoses']);
    Route::get('/reports/patients', [ReportController::class, 'patients']);
    Route::get('/reports/export/csv', [ReportController::class, 'exportCsv']);

    // Guarantee reports
    Route::apiResource('guarantee-reports', GuaranteeReportController::class);

    // Settings
    Route::get('/settings', [SettingController::class, 'index']);
    Route::post('/settings', [SettingController::class, 'update']);
    Route::post('/settings/logo', [SettingController::class, 'uploadLogo']);

    // Catalog management
    Route::get('/catalog-groups', [CatalogController::class, 'groups']);
    Route::post('/catalog-items', [CatalogController::class, 'storeItem']);
    Route::put('/catalog-items/{item}', [CatalogController::class, 'updateItem']);
    Route::delete('/catalog-items/{item}', [CatalogController::class, 'destroyItem']);
    Route::put('/print-templates/{id}', [CatalogController::class, 'updateTemplate']);

    // CIE-10
    Route::get('/cie10', [Cie10Controller::class, 'search']);

    // ─── INVENTARIO ──────────────────────────────────────────────────────────────
    Route::prefix('products')->group(function () {
        Route::get('/', [ProductController::class, 'index']);
        Route::post('/', [ProductController::class, 'store']);
        Route::get('/barcode/{barcode}', [ProductController::class, 'findByBarcode']);
        Route::get('/{product}', [ProductController::class, 'show']);
        Route::put('/{product}', [ProductController::class, 'update']);
        Route::delete('/{product}', [ProductController::class, 'destroy']);
        Route::get('/{product}/variants', [ProductController::class, 'variants']);
        Route::post('/{product}/variants', [ProductController::class, 'storeVariant']);
        Route::put('/{product}/variants/{variant}', [ProductController::class, 'updateVariant']);
    });

    Route::prefix('inventory')->group(function () {
        Route::get('/', [InventoryController::class, 'index']);
        Route::get('/movements', [InventoryController::class, 'movements']);
        Route::get('/low-stock', [InventoryController::class, 'lowStock']);
        Route::get('/valuation', [InventoryController::class, 'valuation']);
        Route::post('/adjust', [InventoryController::class, 'adjust']);
        Route::post('/transfer', [InventoryController::class, 'transfer']);
    });

    Route::apiResource('suppliers', SupplierController::class);
    Route::apiResource('branches', BranchController::class);
    Route::apiResource('warehouses', WarehouseController::class);

    // ─── VENTAS / POS ─────────────────────────────────────────────────────────────
    Route::prefix('sales')->group(function () {
        Route::get('/', [SaleController::class, 'index']);
        Route::post('/', [SaleController::class, 'store']);
        Route::get('/patient/{patient}', [SaleController::class, 'patientSummary']);
        Route::get('/{sale}', [SaleController::class, 'show']);
        Route::post('/{sale}/items', [SaleController::class, 'addItem']);
        Route::delete('/{sale}/items/{item}', [SaleController::class, 'removeItem']);
        Route::post('/{sale}/payments', [SaleController::class, 'processPayment']);
        Route::post('/{sale}/cancel', [SaleController::class, 'cancel']);
    });

    // ─── CAJA ─────────────────────────────────────────────────────────────────────
    Route::prefix('cash-registers')->group(function () {
        Route::get('/{register}/current-session', [CashRegisterController::class, 'currentSession']);
        Route::post('/{register}/open', [CashRegisterController::class, 'openSession']);
        Route::post('/sessions/{session}/close', [CashRegisterController::class, 'closeSession']);
        Route::get('/sessions', [CashRegisterController::class, 'sessions']);
        Route::post('/sessions/{session}/expenses', [CashRegisterController::class, 'storeExpense']);
    });

    // ─── LABORATORIO ──────────────────────────────────────────────────────────────
    Route::prefix('lab-orders')->group(function () {
        Route::get('/', [LabOrderController::class, 'index']);
        Route::get('/suppliers', [LabOrderController::class, 'suppliers']);
        Route::post('/', [LabOrderController::class, 'store']);
        Route::get('/{labOrder}', [LabOrderController::class, 'show']);
        Route::put('/{labOrder}', [LabOrderController::class, 'update']);
        Route::delete('/{labOrder}', [LabOrderController::class, 'destroy']);
        Route::post('/{labOrder}/status', [LabOrderController::class, 'updateStatus']);
    });

    // ─── REPORTES COMERCIALES ─────────────────────────────────────────────────
    Route::prefix('reports')->group(function () {
        Route::get('/dashboard-commercial', [ReportController::class, 'dashboardCommercial']);
        Route::get('/sales', [ReportController::class, 'salesReport']);
        Route::get('/inventory', [ReportController::class, 'inventoryReport']);
        Route::get('/lab', [ReportController::class, 'labReport']);
        Route::get('/cash', [ReportController::class, 'cashReport']);
        Route::get('/branch-comparison', [ReportController::class, 'branchComparison']);
    });

    // ─── EXPORTACIONES ────────────────────────────────────────────────────────
    Route::prefix('export')->group(function () {
        Route::get('/sales', [ExportController::class, 'exportSalesExcel']);
        Route::get('/inventory', [ExportController::class, 'exportInventoryExcel']);
    });

    // ─── CRM ──────────────────────────────────────────────────────────────────────
    Route::prefix('crm')->group(function () {
        Route::get('/templates', [CrmController::class, 'templates']);
        Route::post('/templates', [CrmController::class, 'storeTemplate']);
        Route::put('/templates/{template}', [CrmController::class, 'updateTemplate']);
        Route::get('/reminders', [CrmController::class, 'reminders']);
        Route::post('/reminders', [CrmController::class, 'storeReminder']);
        Route::get('/campaigns', [CrmController::class, 'campaigns']);
        Route::post('/campaigns/preview', [CrmController::class, 'previewCampaign']);
        Route::post('/campaigns', [CrmController::class, 'storeCampaign']);
        Route::post('/campaigns/{campaign}/send', [CrmController::class, 'sendCampaign']);
    });

    // ─── FACTURACIÓN ──────────────────────────────────────────────────────────────
    Route::prefix('invoices')->group(function () {
        Route::get('/', [InvoiceController::class, 'index']);
        Route::post('/', [InvoiceController::class, 'store']);
        Route::get('/{invoice}', [InvoiceController::class, 'show']);
        Route::post('/{invoice}/xml', [InvoiceController::class, 'generateXml']);
        Route::post('/{invoice}/send', [InvoiceController::class, 'sendToSri']);
        Route::get('/{invoice}/pdf', [InvoiceController::class, 'downloadPdf']);
    });

    // ─── AUDITORÍA ────────────────────────────────────────────────────────────────
    Route::get('/audit/activity', [AuditController::class, 'index']);

    // ─── INTELIGENCIA ARTIFICIAL ─────────────────────────────────────────────────
    Route::prefix('ai')->group(function () {
        Route::get('/status', [AiController::class, 'status']);
        Route::get('/patient/{patient}/summary', [AiController::class, 'patientSummary']);
        Route::post('/product-recommendation', [AiController::class, 'productRecommendation']);
        Route::post('/analyze-sales', [AiController::class, 'analyzeSales']);
        Route::post('/generate-message', [AiController::class, 'generateMessage']);
        Route::post('/predict-stockouts', [AiController::class, 'predictStockouts']);
        Route::post('/chat', [AiController::class, 'chat']);
    });

    Route::prefix('admin/maintenance')->group(function () {
        Route::get('/backups', [SystemMaintenanceController::class, 'backups']);
        Route::post('/backups', [SystemMaintenanceController::class, 'createBackup']);
        Route::get('/backups/{operation}/download', [SystemMaintenanceController::class, 'downloadBackup']);
        Route::post('/imports/upload', [SystemMaintenanceController::class, 'uploadImport']);
        Route::post('/imports/{operation}/analyze', [SystemMaintenanceController::class, 'analyzeImport']);
        Route::post('/imports/{operation}/run', [SystemMaintenanceController::class, 'runImport']);
        Route::get('/imports/{operation}', [SystemMaintenanceController::class, 'showImport']);
    });
});
