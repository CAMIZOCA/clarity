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
});
