package com.depos.app;

/**
 * MLKit Barcode Scanning Configuration & Validator for Android.
 * Explicitly configures formats for heavy packages (bulks/packs) and high-resolution camera.
 */
public class MLKitBarcodeHelper {

    // Heavy bulk barcode formats:
    // Barcode.FORMAT_ITF (128), Barcode.FORMAT_EAN_13 (32), Barcode.FORMAT_CODE_128 (1), Barcode.FORMAT_UPC_A (512)
    public static final int FORMAT_ITF = 128;
    public static final int FORMAT_EAN_13 = 32;
    public static final int FORMAT_CODE_128 = 1;
    public static final int FORMAT_UPC_A = 512;
    public static final int FORMAT_EAN_8 = 64;
    public static final int FORMAT_UPC_E = 1024;
    public static final int FORMAT_QR_CODE = 256;

    // High resolution preview: 1920x1080 Full HD
    public static final int TARGET_PREVIEW_WIDTH = 1920;
    public static final int TARGET_PREVIEW_HEIGHT = 1080;
    public static final boolean FORCE_CONTINUOUS_AUTOFOCUS = true;

    /**
     * Validates barcode checksum and format.
     * If barcode is damaged, returns false to prompt re-scan instead of guessing.
     */
    public static boolean validateBarcodeChecksum(String rawBarcode) {
        if (rawBarcode == null || rawBarcode.trim().length() < 4) {
            return false;
        }
        String clean = rawBarcode.trim();

        // ITF-14 validation
        if (clean.matches("^\\d{14}$")) {
            int sum = 0;
            for (int i = 0; i < 13; i++) {
                int digit = Character.getNumericValue(clean.charAt(i));
                sum += digit * (i % 2 == 0 ? 3 : 1);
            }
            int checkDigit = (10 - (sum % 10)) % 10;
            int provided = Character.getNumericValue(clean.charAt(13));
            return checkDigit == provided;
        }

        // EAN-13 validation
        if (clean.matches("^\\d{13}$")) {
            int sum = 0;
            for (int i = 0; i < 12; i++) {
                int digit = Character.getNumericValue(clean.charAt(i));
                sum += digit * (i % 2 == 0 ? 1 : 3);
            }
            int checkDigit = (10 - (sum % 10)) % 10;
            int provided = Character.getNumericValue(clean.charAt(12));
            return checkDigit == provided;
        }

        // UPC-A validation
        if (clean.matches("^\\d{12}$")) {
            int sum = 0;
            for (int i = 0; i < 11; i++) {
                int digit = Character.getNumericValue(clean.charAt(i));
                sum += digit * (i % 2 == 0 ? 3 : 1);
            }
            int checkDigit = (10 - (sum % 10)) % 10;
            int provided = Character.getNumericValue(clean.charAt(11));
            return checkDigit == provided;
        }

        // Code 128
        return clean.matches("^[A-Za-z0-9\\-_./]{4,40}$");
    }
}
