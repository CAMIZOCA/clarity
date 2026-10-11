<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Documento de identidad de un paciente, segun el tipo que eligio quien registra.
 *
 * Antes cualquier texto con una letra pasaba como "pasaporte": una cedula con un
 * error de tecleo ("17100340q5") se guardaba sin digito verificador y sin
 * encontrar al paciente que ya existia con la cedula correcta. Ahora el
 * pasaporte hay que elegirlo a proposito.
 */
class ValidPatientDocument implements ValidationRule
{
    /** Cedula o RUC ecuatorianos: solo digitos, con digito verificador. */
    public const TYPE_CEDULA = 'cedula';

    /** Pasaporte o documento extranjero: sin verificador. */
    public const TYPE_OTHER = 'otro';

    public const TYPES = [self::TYPE_CEDULA, self::TYPE_OTHER];

    public function __construct(private string $type = self::TYPE_CEDULA) {}

    /** Tipo que corresponde a un documento ya guardado: con letras no es una cedula. */
    public static function typeOf(?string $document): string
    {
        return preg_match('/[A-Z]/i', (string) $document) ? self::TYPE_OTHER : self::TYPE_CEDULA;
    }

    /**
     * Forma en que se guarda. En una cedula los espacios, guiones y puntos son
     * solo de presentacion; en otro documento no se tocan, para que un codigo
     * provisional ("HIST-00123") no pase por documento valido.
     */
    public static function normalize(string $document, string $type): string
    {
        $document = strtoupper(trim($document));

        return $type === self::TYPE_CEDULA && preg_match('/^[\d\s.\-]+$/', $document)
            ? str_replace([' ', '-', '.'], '', $document)
            : $document;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (empty($value)) {
            return; // El campo requerido lo maneja otra regla
        }

        $value = trim((string) $value);

        if ($this->type === self::TYPE_OTHER) {
            if (! preg_match('/^[A-Z0-9]{5,15}$/i', $value)) {
                $fail('El documento debe tener entre 5 y 15 letras o números, sin espacios ni guiones.');
            }

            return;
        }

        if (! preg_match('/^\d+$/', $value)) {
            $fail('La cédula o RUC solo lleva números. Si es un pasaporte, elija «Pasaporte u otro documento».');

            return;
        }

        (new ValidEcuadorCedula(allowPassport: false))->validate($attribute, $value, $fail);
    }
}
