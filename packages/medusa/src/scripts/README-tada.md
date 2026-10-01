# Catálogo Tada Delivery Ecuador

Desde el directorio `deployment/medusa-backend`, ejecuta el seed contra la base
de datos configurada en el entorno:

```sh
yarn medusa exec ../../packages/medusa/src/scripts/seed-tada.ts
```

Para reemplazar únicamente prendas de la colección de demostración:

```sh
yarn medusa exec ../../packages/medusa/src/scripts/seed-tada.ts delete-old-clothing
```

La eliminación requiere esa opción explícita, rechaza `NODE_ENV=production` y
se limita a productos con handle `demo-*` o nombre de producto Medusa Starter
cuyos nombres, tipos o categorías identifican ropa o accesorios. No borra el
resto del catálogo. Sin la opción, conserva la ropa de demostración.
`medusa exec` recibe argumentos posicionales para el script, por eso el
indicador se pasa como `delete-old-clothing` sin guiones.

El seed agrega USD como moneda principal de la tienda, configura la región
Ecuador con precios inclusivos de impuestos y activa el cálculo automático.
Si todavía no existe una región tributaria de Ecuador, crea IVA con la tasa
indicada en `TADA_ECUADOR_VAT_RATE` (15 por ciento por defecto); si ya existe,
respeta las reglas existentes. Verifica la tasa aplicable antes de producción.

Las categorías, productos, stock inicial, ubicación de Quito y canal de venta
se crean de manera idempotente. Para refrescar una instalación donde ya existan
productos con los handles `tada-*`, elimina esos productos primero desde Admin
si necesitas reemplazar también sus variantes e inventario.
