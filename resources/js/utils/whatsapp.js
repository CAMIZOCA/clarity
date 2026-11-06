/**
 * Enlaces de WhatsApp para el envio manual desde Recordatorios.
 *
 * `wa.me` abre la app de escritorio si esta instalada y, si no, WhatsApp Web,
 * con el mensaje ya escrito: el usuario solo pulsa enviar dentro de WhatsApp.
 */

/**
 * Numero internacional (solo digitos) de un celular ecuatoriano, o `null` si
 * el telefono no sirve para WhatsApp (fijo, vacio o incompleto).
 *
 *   0991234567      -> 593991234567
 *   +593 99 123 4567 -> 593991234567
 *   2892229 / 022892229 -> null (fijo)
 */
export function whatsappNumber(phone) {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (!digits) return null;

    if (/^09\d{8}$/.test(digits)) return `593${digits.slice(1)}`;
    if (/^9\d{8}$/.test(digits)) return `593${digits}`;
    if (/^5939\d{8}$/.test(digits)) return digits;

    // Otro numero internacional ya completo (paciente extranjero).
    if (!digits.startsWith('593') && !digits.startsWith('0') && digits.length >= 11 && digits.length <= 15) {
        return digits;
    }

    return null;
}

/** `https://wa.me/<numero>?text=<mensaje>` o `null` si no hay celular. */
export function whatsappLink(phone, text = '') {
    const number = whatsappNumber(phone);
    if (!number) return null;
    const query = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${number}${query}`;
}
