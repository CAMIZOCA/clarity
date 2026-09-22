<?php

/**
 * Traducciones de validacion usadas por el formulario de consulta.
 *
 * Se activan solo dentro de StoreConsultationRequest (via
 * app()->setLocale('es') en prepareForValidation()), sin cambiar el locale
 * global de la app (`config('app.locale')` sigue en su default).
 */
return [
    'required' => 'El campo :attribute es obligatorio.',
    'required_with' => 'El campo :attribute es obligatorio.',
    'string' => 'El campo :attribute debe ser una cadena de texto.',
    'numeric' => 'El campo :attribute debe ser un valor numérico.',
    'integer' => 'El campo :attribute debe ser un número entero.',
    'array' => 'El campo :attribute debe ser una lista.',
    'boolean' => 'El campo :attribute debe ser verdadero o falso.',
    'date' => 'El campo :attribute no es una fecha válida.',
    'in' => 'El valor seleccionado para :attribute no es válido.',
    'exists' => 'El valor seleccionado para :attribute no existe.',
    'before_or_equal' => 'El campo :attribute debe ser una fecha anterior o igual a :date.',
    'after_or_equal' => 'El campo :attribute debe ser una fecha posterior o igual a :date.',

    'max' => [
        'numeric' => 'El campo :attribute no debe ser mayor que :max.',
        'file' => 'El campo :attribute no debe pesar más de :max kilobytes.',
        'string' => 'El campo :attribute no debe tener más de :max caracteres.',
        'array' => 'El campo :attribute no debe tener más de :max elementos.',
    ],

    'min' => [
        'numeric' => 'El campo :attribute debe ser al menos :min.',
        'file' => 'El campo :attribute debe pesar al menos :min kilobytes.',
        'string' => 'El campo :attribute debe tener al menos :min caracteres.',
        'array' => 'El campo :attribute debe tener al menos :min elementos.',
    ],

    /*
     * StoreConsultationRequest::attributes() cubre los nombres dinámicos
     * (ej. "rx_uso_entries.0.cilindro_od"); esta lista es solo un respaldo
     * para cualquier campo que no pase por ese método.
     */
    'attributes' => [
        'patient_id' => 'paciente',
        'fecha_consulta' => 'fecha de consulta',
        'optometrista_id' => 'médico / optometrista',
        'motivo_consulta' => 'motivo de consulta',
        'estado' => 'estado',
    ],
];
