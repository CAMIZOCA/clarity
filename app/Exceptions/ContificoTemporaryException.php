<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Fallo de Contifico que vale la pena reintentar: red caida, 429 o 5xx.
 *
 * El mensaje ya viene saneado por ContificoService (sin token ni API key).
 */
class ContificoTemporaryException extends RuntimeException {}
