import { test, expect } from '@playwright/test';

/**
 * Prueba de regresión: Flujo de descuento y reimpresión
 * 
 * 1. Crea una venta con descuento en el POS.
 * 2. Verifica que el ticket inicial muestre el descuento.
 * 3. Va al historial de tickets.
 * 4. Abre la vista previa del ticket y valida que el descuento sea idéntico.
 */

test('debe aplicar descuento y mostrarlo correctamente en la reimpresión', async ({ page }) => {
  // 1. Login (Asumiendo que estamos en modo demo si no hay sesión)
  await page.goto('http://localhost:8080/pos');
  
  if (await page.getByRole('button', { name: 'Entrar en modo demo' }).isVisible()) {
    await page.getByRole('button', { name: 'Entrar en modo demo' }).click();
  }
  
  await page.waitForURL('**/pos');

  // 2. Agregar un producto al carrito
  // Seleccionamos el primer producto del grid
  const firstProduct = page.locator('div.group.relative.flex.flex-col').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();

  // 3. Aplicar Descuento
  await page.getByRole('button', { name: 'Descuento' }).click();
  await expect(page.getByText('Aplicar Descuento')).toBeVisible();
  
  await page.getByRole('combobox').first().selectOption('porcentaje');
  await page.getByPlaceholder('0.00').fill('10');
  await page.getByPlaceholder('Ej: Promoción, Cliente frecuente...').fill('Prueba Regresion');
  await page.getByRole('button', { name: 'Aplicar Descuento' }).click();

  // 4. Finalizar Venta
  await page.getByRole('button', { name: 'Cobrar' }).click();
  await page.getByRole('button', { name: 'Confirmar y Cobrar' }).click();

  // 5. Validar Ticket Original
  await expect(page.getByText('Vista previa del ticket')).toBeVisible();
  const ticketArea = page.locator('#ticket-print-area');
  await expect(ticketArea).toContainText('DESCUENTO');
  await expect(ticketArea).toContainText('Prueba Regresion');

  // Extraer el número de ticket para buscarlo después
  const ticketIdText = await page.locator('#ticket-print-area div.bold.font-extrabold.mt-1.text-base').innerText();
  const ticketId = ticketIdText.trim();

  await page.getByRole('button', { name: 'Cerrar sin imprimir' }).click();

  // 6. Validar Reimpresión en Historial
  await page.goto('http://localhost:8080/tickets');
  
  // Buscar el ticket específico
  const searchInput = page.getByPlaceholder('Buscar por número de ticket');
  await searchInput.fill(ticketId);
  
  // Abrir vista previa
  const reprintButton = page.getByRole('button', { name: 'Vista previa' }).first();
  await reprintButton.click();

  // Validar contenido de la reimpresión
  await expect(page.getByText('Vista previa del ticket')).toBeVisible();
  const reprintArea = page.locator('#ticket-print-area');
  await expect(reprintArea).toContainText('DESCUENTO');
  await expect(reprintArea).toContainText('Prueba Regresion');
  await expect(reprintArea).toContainText(ticketId);
});
