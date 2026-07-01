/**
 * Shared IMb mailer identity — must match across every script that builds or
 * looks up a barcode. Mailer ID is 9 digits, so the serial number field is 6
 * digits (9 + 6 = 15, per USPS Pub 109). Service Type 300 = First-Class Mail,
 * no special IMb services. Barcode Identifier 00 = standard, no special
 * services.
 */
export const USPS_MAILER_ID = '904209274';
export const USPS_SERVICE_TYPE = '300';
export const USPS_BARCODE_ID = '00';
export const USPS_SERIAL_DIGITS = 6;

/**
 * Physical mailpieces sent to each household, per event, in mailing order.
 * Every serial's mailpieceKey is scoped by `${eventName}:${piece}`, so this
 * list must stay in sync between the barcode generator and any script that
 * looks serials back up — a mismatched label hashes to a different key and
 * silently looks like the piece was never mailed.
 */
export const MAIL_PIECES = {
  nyc: ['Invitation'],
  france: ['SaveTheDate', 'Invitation'],
};
