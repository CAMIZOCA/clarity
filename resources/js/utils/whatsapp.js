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

/**
 * Texto listo para `?text=`: forma NFC (los acentos llegan siempre en el mismo
 * formato) y sin mitades de par sustituto sueltas. `encodeURIComponent` lanza
 * URIError con esas, y un emoji partido llega a WhatsApp como "�".
 * Los emojis completos (un par sustituto valido) se conservan intactos.
 */
export function cleanWhatsAppText(text) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
        .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

/** `https://wa.me/<numero>?text=<mensaje>` o `null` si no hay celular. */
export function whatsappLink(phone, text = '') {
    const number = whatsappNumber(phone);
    if (!number) return null;
    const clean = cleanWhatsAppText(text);
    const query = clean ? `?text=${encodeURIComponent(clean)}` : '';
    return `https://wa.me/${number}${query}`;
}
