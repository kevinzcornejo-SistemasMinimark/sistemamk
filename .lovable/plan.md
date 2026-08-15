# Plan - Fix Yape/Plin Payment Logos

The user reports that Yape and Plin payment method icons are not appearing in the POS checkout. The current implementation uses external assets that might be failing or missing. I will replace these with high-quality inline SVG versions of the Yape and Plin logos to ensure they always render correctly without external dependencies.

## User Review Required
> [!IMPORTANT]
> I am switching to inline SVG logos for Yape and Plin. This ensures they load instantly and work even if external asset URLs change or fail.

## Proposed Changes

### POS Components
#### [src/components/pos/CheckoutModal.tsx]
- Remove the imports for `yapeLogo` and `plinLogo` from JSON assets.
- Replace the `YapeLogo` component with a high-fidelity SVG representation of the Yape logo.
- Replace the `PlinLogo` component with a high-fidelity SVG representation of the Plin logo.
- Adjust the styling to ensure these SVGs fit correctly within the checkout grid.

## Verification Plan
1. **Automated Check**: Run a Playwright script to:
   - Navigate to the POS page (`/pos`).
   - Add a product to the cart.
   - Click "Cobrar" to open the `CheckoutModal`.
   - Verify that the Yape and Plin buttons are visible and take screenshots.
2. **Visual Check**: Inspect the screenshots to ensure the logos look professional and consistent with the other payment methods (Efectivo, Visa/MC).
