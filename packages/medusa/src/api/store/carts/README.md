# Envases retornables

Marca el producto o la variante con metadatos configurados por el comercio:

```json
{
  "is_returnable": true,
  "bottle_deposit_price": 0.25
}
```

El Store API acepta `metadata.returns_bottle` como booleano al crear o actualizar
una línea del carrito. Si es `true`, no se cobra depósito por esas unidades y
éstas se contabilizan para recolección; si es `false` o no se envía, el servidor
calcula el depósito según el metadato del producto o variante. El precio no se
acepta desde el cliente.

El carrito y el pedido guardan `metadata.returnable_packaging_summary` con
`beverage_subtotal`, `bottle_deposit_total` y `empty_bottles_to_collect`. Los
depósitos también aparecen como líneas de pedido separadas, agrupadas por precio.
