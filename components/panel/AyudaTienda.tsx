/** Bloques de ayuda de Mi tienda, con el estilo del aviso de Mercado Pago. */

const TEXTO = { fontFamily: "var(--font-body)" } as const;

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4" style={{ backgroundColor: "#fef9c3", borderColor: "#fde68a" }}>
      <p className="mb-2" style={{ ...TEXTO, fontSize: "14px", fontWeight: 600, color: "#854d0e" }}>{titulo}</p>
      <div className="flex flex-col gap-2" style={{ ...TEXTO, fontSize: "13px", color: "#854d0e", lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

export function AyudaDespacho() {
  return (
    <Bloque titulo="¿Cómo le llega el producto a tu comprador?">
      <ul className="list-disc pl-5">
        <li>
          <strong>Envío:</strong> tú despachas por correo o courier (Starken, Chilexpress, Blue Express u otro).
          Defines cuánto cobras por el envío y en cuántos días hábiles despachas. El comprador lo ve antes de pagar.
        </li>
        <li>
          <strong>Retiro:</strong> el comprador lo pasa a buscar sin costo. Indica un punto y horario, por ejemplo tu
          próximo show, una tienda amiga o una sala de ensayo. No uses la dirección de tu casa: la ve cualquier comprador.
        </li>
        <li><strong>Envío y retiro:</strong> el comprador elige al pagar.</li>
        <li>Una vez hecha la compra, el plazo que prometiste te obliga. Si se atrasa, avísale al comprador.</li>
      </ul>
    </Bloque>
  );
}

export function QuePuedesVender() {
  return (
    <Bloque titulo="¿Qué puedes vender en tu tienda?">
      <p>Solo productos oficiales de tu propio proyecto musical:</p>
      <ul className="list-disc pl-5">
        <li><strong>Merch oficial:</strong> poleras, polerones, gorros, bolsos, stickers, parches y accesorios con tu nombre, logo o arte.</li>
        <li><strong>Música en formato físico:</strong> vinilos, CDs y cassettes de tu música.</li>
        <li><strong>Piezas de colección:</strong> afiches, fotos, arte o ediciones limitadas ligadas a tu música.</li>
      </ul>
      <p>
        <strong>No se permite:</strong> merch de otros artistas o bandas, reventa de productos ajenos, réplicas o
        productos no oficiales, cosas sin relación con tu música, y por ahora productos digitales.
      </p>
      <p>Revisamos cada producto antes de publicarlo. Si no cumple, te lo devolvemos con el motivo.</p>
    </Bloque>
  );
}
