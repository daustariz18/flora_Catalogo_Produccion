import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = repoRoot;
const outputRoot = path.join(projectRoot, "docs", "manual-usuario");
const assetsDir = path.join(outputRoot, "assets");
const previewUrl = "http://127.0.0.1:4173";
const catalogUrl = `${previewUrl}/catalogo/flora`;
const browserDebugUrl = "http://127.0.0.1:9222";
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const mockCatalog = buildMockCatalog();

await main();

async function main() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(assetsDir, { recursive: true });

  const previewProc = await startPreviewServer();
  const chromePath = await resolveChromePath();
  const browserUserDataDir = path.join(outputRoot, ".chrome-profile");
  await rm(browserUserDataDir, { recursive: true, force: true });

  const chromeProc = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--remote-debugging-port=9222",
      `--user-data-dir=${browserUserDataDir}`,
      "--window-size=1440,2000",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--allow-file-access-from-files",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    await waitForUrl(`${browserDebugUrl}/json/version`);
    const version = await fetchJson(`${browserDebugUrl}/json/version`);
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await waitForWebSocket(ws);

    const client = createCdpClient(ws);
    const target = await client.send("Target.createTarget", { url: "about:blank" });
    const attached = await client.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    const sessionId = attached.sessionId;

    const page = {
      send(method, params = {}) {
        return client.send(method, params, sessionId);
      },
      async waitForExpression(expression, timeoutMs = 30000) {
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
          const response = await this.send("Runtime.evaluate", {
            expression: `Boolean(${expression})`,
            returnByValue: true,
            awaitPromise: true,
          });

          if (response.result?.value) {
            return;
          }

          await delay(300);
        }

        throw new Error(`Timeout esperando: ${expression}`);
      },
      async evaluate(expression) {
        const response = await this.send("Runtime.evaluate", {
          expression,
          returnByValue: true,
          awaitPromise: true,
        });

        return response.result?.value;
      },
      async setViewport(width, height) {
        await this.send("Emulation.setDeviceMetricsOverride", {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: false,
          screenOrientation: { type: "portraitPrimary", angle: 0 },
        });
      },
      async capture(fileName) {
        const { data } = await this.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
        });
        const filePath = path.join(assetsDir, fileName);
        await writeFile(filePath, Buffer.from(data, "base64"));
        return filePath;
      },
      async navigate(url) {
        await this.send("Page.navigate", { url });
        await this.waitForExpression("document.readyState === 'complete' || document.readyState === 'interactive'", 30000);
      },
      async click(selector) {
        await this.evaluate(`
          (() => {
            const element = document.querySelector(${JSON.stringify(selector)});
            if (!element) throw new Error("No se encontro el selector ${selector}");
            element.click();
            return true;
          })()
        `);
      },
      async clickText(text) {
        await this.evaluate(`
          (() => {
            const candidates = Array.from(document.querySelectorAll("button, a, [role='button']"));
            const needle = ${JSON.stringify(text)};
            const element = candidates.find((node) => (node.textContent || "").trim().includes(needle));
            if (!element) throw new Error("No se encontro texto: ${text}");
            element.click();
            return true;
          })()
        `);
      },
      async setInput(selector, value) {
        await this.evaluate(`
          (() => {
            const element = document.querySelector(${JSON.stringify(selector)});
            if (!element) throw new Error("No se encontro el selector ${selector}");
            const prototype = Object.getPrototypeOf(element);
            const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")
              || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
              || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
            if (descriptor?.set) {
              descriptor.set.call(element, ${JSON.stringify(value)});
            } else {
              element.value = ${JSON.stringify(value)};
            }
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          })()
        `);
      },
      async setSelect(selector, value) {
        await this.evaluate(`
          (() => {
            const element = document.querySelector(${JSON.stringify(selector)});
            if (!element) throw new Error("No se encontro el selector ${selector}");
            element.value = ${JSON.stringify(value)};
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          })()
        `);
      },
      async type(selector, value) {
        await this.evaluate(`
          (() => {
            const element = document.querySelector(${JSON.stringify(selector)});
            if (!element) throw new Error("No se encontro el selector ${selector}");
            element.focus();
            return true;
          })()
        `);
        await this.send("Input.insertText", { text: value });
      },
      async scrollToTop() {
        await this.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })");
      },
      async overrideFetch() {
        const mockLookup = {
        encontrado: true,
        cliente: {
          cliente_id: 99,
          nombre_completo: "Andrea Gomez",
          identificacion: "1234567890",
          tipo_ident: "CC",
          telefono: "3001234567",
          telefono_completo: "+573001234567",
          indicativo: "+57",
          email: "andrea.gomez@example.com",
        },
      };

        const mockOrderResponse = {
          pedidoID: 4587,
          empresaID: 3,
          sucursalID: 1,
          clienteID: 99,
          estadoPedidoID: 1,
          numeroPedido: 4587,
          codigoPedido: "PED-4587",
          codigo_pedido: "PED-4587",
          totalBruto: 350000,
          totalIVA: 0,
          totalNeto: 365000,
        };

        await this.send("Page.addScriptToEvaluateOnNewDocument", {
          source: `
            (() => {
              const originalFetch = window.fetch.bind(window);
              const mockCatalog = ${JSON.stringify(mockCatalog)};
              const mockLookup = ${JSON.stringify(mockLookup)};
              const mockOrderResponse = ${JSON.stringify(mockOrderResponse)};

              window.fetch = async (input, init = {}) => {
                const url = typeof input === "string" ? input : input && input.url ? input.url : String(input);

                if (url.includes("/catalogo") && url.includes("/public/")) {
                  return new Response(JSON.stringify(mockCatalog), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                  });
                }

                if (url.includes("/clientes/buscar")) {
                  const parsed = new URL(url, window.location.origin);
                  const telefono = (parsed.searchParams.get("telefono") || "").replace(/\\s+/g, "");

                  if (telefono.includes("3001234567")) {
                    return new Response(JSON.stringify(mockLookup), {
                      status: 200,
                      headers: { "Content-Type": "application/json" },
                    });
                  }

                  return new Response(JSON.stringify({ encontrado: false, cliente: null }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                  });
                }

                if (url.includes("/pedidos") && (init.method === "POST" || !init.method)) {
                  return new Response(JSON.stringify(mockOrderResponse), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                  });
                }

                return originalFetch(input, init);
              };
            })();
          `,
        });
      },
    };

    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.setViewport(1440, 1700);
    await page.overrideFetch();

    const catalogPath = await captureCatalogFlow(page, "01-catalogo.png");
    const cartPath = await captureCartFlow(page, "02-carrito.png");
    const customerPath = await captureCheckoutCustomerFlow(page, "03-checkout-cliente.png");
    const deliveryPath = await captureCheckoutDeliveryFlow(page, "04-checkout-entrega.png");
    const messagePath = await captureCheckoutMessageFlow(page, "05-checkout-mensaje.png");
    const confirmPath = await captureCheckoutConfirmFlow(page, "06-checkout-confirmar.png");

    const html = buildManualHtml({
      catalogPath,
      cartPath,
      customerPath,
      deliveryPath,
      messagePath,
      confirmPath,
    });

    const htmlPath = path.join(outputRoot, "manual-usuario.html");
    await writeFile(htmlPath, html, "utf8");

    const fileUrl = pathToFileURL(htmlPath).href;
    await page.navigate(fileUrl);
    await page.waitForExpression("document.readyState === 'complete'", 30000);

    const { data: pdfData } = await page.send("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
    });

    await writeFile(path.join(outputRoot, "manual-usuario.pdf"), Buffer.from(pdfData, "base64"));
  } finally {
    try {
      chromeProc.kill();
    } catch {
      // ignore
    }

    try {
      previewProc.kill();
    } catch {
      // ignore
    }
  }
}

async function captureCatalogFlow(page, fileName) {
  await page.setViewport(1440, 1600);
  await page.navigate(catalogUrl);
  await delay(4000);
  const debugPath = path.join(outputRoot, "debug-catalog.txt");
  const debugText = [
    `href: ${await page.evaluate("location.href")}`,
    `title: ${await page.evaluate("document.title")}`,
    `body: ${await page.evaluate("document.body.innerText.slice(0, 1200)")}`,
  ].join("\n\n");
  await writeFile(debugPath, debugText, "utf8");
  await page.waitForExpression("document.querySelectorAll('.product-card').length >= 4", 45000);
  await page.scrollToTop();
  return await page.capture(fileName);
}

async function captureCartFlow(page, fileName) {
  await page.click(".product-add");
  await delay(400);
  await page.navigate(`${previewUrl}/catalogo/flora/carrito`);
  await page.waitForExpression("document.querySelector('.cart-item') !== null", 30000);
  await page.scrollToTop();
  return await page.capture(fileName);
}

async function captureCheckoutCustomerFlow(page, fileName) {
  await page.click(".cart-footer-primary-action");
  await page.waitForExpression("document.querySelector('.wizard-panel h2')?.textContent?.includes('Informacion del cliente')", 30000);
  await page.setViewport(1440, 1800);
  await page.setInput('input[placeholder="3001234567"]', "3001234567");
  await page.setInput('input[placeholder="Ej: Andrea Gomez"]', "Andrea Gomez");
  await page.setInput('input[placeholder="1234567890"]', "1234567890");
  await page.setInput('input[placeholder="ejemplo@correo.com"]', "andrea.gomez@example.com");
  await page.click('input[placeholder="Ej: Andrea Gomez"]');
  await delay(1000);
  await page.scrollToTop();
  return await page.capture(fileName);
}

async function captureCheckoutDeliveryFlow(page, fileName) {
  await page.clickText("Siguiente");
  await page.waitForExpression("document.querySelector('.wizard-panel h2')?.textContent?.includes('Informacion de entrega')", 30000);
  await page.setInput('input[placeholder="Ej: Maria Perez"]', "Maria Perez");
  await page.setInput('input[placeholder="3001234567"]', "3001234567");
  await page.setInput('input[placeholder="Ej: Calle 72 #45-32"]', "Calle 100 # 43B - 23");
  await page.setInput('input[placeholder="Ej: Torre 2 Apto 502"]', "Apartamento 502");
  await page.setInput('input[placeholder="Ej: Miramar"]', "Miramar");
  await delay(500);
  await page.clickText("Miramar");
  await delay(300);
  await page.scrollToTop();
  return await page.capture(fileName);
}

async function captureCheckoutMessageFlow(page, fileName) {
  await page.clickText("Continuar");
  await page.waitForExpression("document.querySelector('.wizard-panel h2')?.textContent?.includes('Mensaje')", 30000);
  await page.setInput("textarea.checkout-textarea-message", "Feliz cumpleanos, que disfrutes mucho tu dia.");
  await page.setInput("textarea.checkout-textarea-notes", "Entregar antes de las 5:00 p. m.");
  await delay(300);
  await page.scrollToTop();
  return await page.capture(fileName);
}

async function captureCheckoutConfirmFlow(page, fileName) {
  await page.clickText("Continuar");
  await page.waitForExpression("document.querySelector('.wizard-panel h2')?.textContent?.includes('Confirmar pedido')", 30000);
  await page.scrollToTop();
  return await page.capture(fileName);
}

function buildManualHtml(paths) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Manual de usuario - Catalogo Flora</title>
  <style>
    :root {
      --brand: #d94b8a;
      --brand-dark: #b43b6f;
      --text: #1f2937;
      --muted: #6b7280;
      --bg: #fff8fb;
      --card: #ffffff;
      --border: #f3c7d7;
      --shadow: 0 20px 50px rgba(217, 75, 138, 0.10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: var(--text);
      background: linear-gradient(180deg, #fff7fb 0%, #ffffff 45%, #fff9fd 100%);
    }
    .page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 24px 56px;
    }
    .hero {
      background: linear-gradient(135deg, rgba(217, 75, 138, 0.12), rgba(255, 255, 255, 0.96));
      border: 1px solid rgba(217, 75, 138, 0.18);
      border-radius: 24px;
      padding: 32px;
      box-shadow: var(--shadow);
      margin-bottom: 28px;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--brand);
      font-size: 12px;
      font-weight: 700;
      margin: 0 0 8px;
    }
    h1 {
      font-size: 38px;
      line-height: 1.1;
      margin: 0 0 12px;
    }
    .lead {
      color: var(--muted);
      font-size: 16px;
      line-height: 1.7;
      margin: 0;
      max-width: 900px;
    }
    .note {
      margin-top: 18px;
      padding: 14px 16px;
      border-left: 4px solid var(--brand);
      background: rgba(217, 75, 138, 0.06);
      border-radius: 14px;
      color: #7a3558;
    }
    .toc {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin: 24px 0 34px;
    }
    .toc-item {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 18px;
      box-shadow: 0 10px 30px rgba(17, 24, 39, 0.04);
    }
    .toc-item strong {
      display: block;
      margin-bottom: 6px;
      color: var(--brand-dark);
    }
    section.step {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 22px;
      margin: 0 0 28px;
      box-shadow: var(--shadow);
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .step-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    .step-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: var(--brand);
      color: white;
      font-weight: 700;
      margin-right: 12px;
      flex: none;
    }
    .step-title {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 24px;
    }
    .step-copy {
      color: var(--muted);
      line-height: 1.7;
      margin: 8px 0 0;
      max-width: 900px;
    }
    .step-list {
      margin: 12px 0 0;
      padding-left: 20px;
      color: #374151;
      line-height: 1.8;
    }
    figure {
      margin: 18px 0 0;
    }
    img {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 18px;
      border: 1px solid var(--border);
      box-shadow: 0 20px 45px rgba(17, 24, 39, 0.10);
    }
    figcaption {
      margin-top: 10px;
      color: var(--muted);
      font-size: 14px;
    }
    .footer {
      margin-top: 18px;
      color: var(--muted);
      font-size: 14px;
      text-align: center;
    }
    @page {
      size: A4;
      margin: 16mm;
    }
    @media print {
      body { background: white; }
      .page { max-width: none; padding: 0; }
      .hero, section.step { box-shadow: none; }
      section.step { break-after: page; page-break-after: always; }
      section.step:last-of-type { break-after: auto; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <p class="eyebrow">Manual de usuario</p>
      <h1>Catalogo Flora</h1>
      <p class="lead">
        Esta guia muestra el flujo completo para que un cliente recorra el catalogo, agregue productos al carrito,
        complete el checkout y deje listo el pedido para continuar por WhatsApp.
      </p>
      <div class="note">
        Las capturas corresponden a la interfaz real del frontend ejecutada en modo local con datos de demostracion
        inyectados para no depender de la red durante la generacion del manual.
      </div>
    </header>

    <div class="toc">
      <div class="toc-item"><strong>1. Explorar catalogo</strong><span>Buscar, filtrar y elegir arreglos.</span></div>
      <div class="toc-item"><strong>2. Revisar carrito</strong><span>Ver productos, cantidades y total antes de pagar.</span></div>
      <div class="toc-item"><strong>3. Datos del cliente</strong><span>Confirmar identidad y correo.</span></div>
      <div class="toc-item"><strong>4. Datos de entrega</strong><span>Direccion, barrio y fecha de entrega.</span></div>
      <div class="toc-item"><strong>5. Mensaje</strong><span>Escribir dedicatoria y notas del pedido.</span></div>
      <div class="toc-item"><strong>6. Confirmar</strong><span>Revisar el resumen final y enviar el pedido.</span></div>
    </div>

    <section class="step">
      <div class="step-head">
        <div>
          <h2 class="step-title"><span class="step-badge">1</span>Explorar el catalogo</h2>
          <p class="step-copy">
            El cliente entra al catalogo, revisa la barra de categorias y usa la busqueda por codigo, nombre o categoria.
          </p>
          <ul class="step-list">
            <li>La categoria <strong>Personalizado</strong> aparece primero.</li>
            <li>Despues se muestra <strong>Flora Madres</strong> y el resto del orden del backend.</li>
            <li>Cada producto tiene precio, codigo y boton para anadir al carrito.</li>
          </ul>
        </div>
      </div>
      <figure>
        <img src="${paths.catalogPath.replace(/\\/g, "/")}" alt="Pantalla principal del catalogo" />
        <figcaption>Pantalla principal del catalogo con busqueda, categorias y tarjetas de producto.</figcaption>
      </figure>
    </section>

    <section class="step">
      <div class="step-head">
        <div>
          <h2 class="step-title"><span class="step-badge">2</span>Revisar el carrito</h2>
          <p class="step-copy">
            Cuando el cliente agrega un arreglo, puede abrir el carrito para ajustar cantidades y verificar el total antes de pasar al checkout.
          </p>
          <ul class="step-list">
            <li>Se muestra el producto seleccionado con su subtotal.</li>
            <li>El resumen indica el total de productos y el total a pagar.</li>
            <li>El boton <strong>Continuar al pedido</strong> lleva al flujo de checkout.</li>
          </ul>
        </div>
      </div>
      <figure>
        <img src="${paths.cartPath.replace(/\\/g, "/")}" alt="Pantalla del carrito" />
        <figcaption>Vista del carrito con un producto cargado y el resumen de compra.</figcaption>
      </figure>
    </section>

    <section class="step">
      <div class="step-head">
        <div>
          <h2 class="step-title"><span class="step-badge">3</span>Datos del cliente</h2>
          <p class="step-copy">
            En el primer paso del checkout se capturan los datos del comprador. Si el telefono ya existe en el sistema,
            la aplicacion puede autocompletar la informacion.
          </p>
          <ul class="step-list">
            <li>Telefono de WhatsApp.</li>
            <li>Nombre completo.</li>
            <li>Tipo e identificacion.</li>
            <li>Correo electronico opcional.</li>
          </ul>
        </div>
      </div>
      <figure>
        <img src="${paths.customerPath.replace(/\\/g, "/")}" alt="Paso de datos del cliente" />
        <figcaption>Primer paso del checkout con los datos del cliente diligenciados.</figcaption>
      </figure>
    </section>

    <section class="step">
      <div class="step-head">
        <div>
          <h2 class="step-title"><span class="step-badge">4</span>Datos de entrega</h2>
          <p class="step-copy">
            El segundo paso define como se entrega el pedido. Para domicilios se solicita direccion, complemento y barrio.
          </p>
          <ul class="step-list">
            <li>Metodo de entrega: domicilio o recoger en tienda.</li>
            <li>Nombre del destinatario y telefono de entrega.</li>
            <li>Direccion, complemento y barrio.</li>
            <li>Fecha de entrega.</li>
          </ul>
        </div>
      </div>
      <figure>
        <img src="${paths.deliveryPath.replace(/\\/g, "/")}" alt="Paso de datos de entrega" />
        <figcaption>Segundo paso del checkout con direccion, barrio y fecha seleccionados.</figcaption>
      </figure>
    </section>

    <section class="step">
      <div class="step-head">
        <div>
          <h2 class="step-title"><span class="step-badge">5</span>Mensaje y notas</h2>
          <p class="step-copy">
            El tercer paso permite escribir la dedicatoria de la tarjeta y observaciones internas para el pedido.
          </p>
          <ul class="step-list">
            <li>Mensaje para la tarjeta.</li>
            <li>Notas adicionales para la operacion o la entrega.</li>
            <li>No hay casilla de terminos y condiciones en este paso.</li>
          </ul>
        </div>
      </div>
      <figure>
        <img src="${paths.messagePath.replace(/\\/g, "/")}" alt="Paso de mensaje y notas" />
        <figcaption>Tercer paso del checkout con mensaje y notas del pedido.</figcaption>
      </figure>
    </section>

    <section class="step">
      <div class="step-head">
        <div>
          <h2 class="step-title"><span class="step-badge">6</span>Confirmar pedido</h2>
          <p class="step-copy">
            El ultimo paso resume los datos, calcula el total final y habilita el boton para finalizar el pedido.
          </p>
          <ul class="step-list">
            <li>Resumen de productos y totales.</li>
            <li>Datos de entrega.</li>
            <li>Boton final para completar el pedido.</li>
          </ul>
        </div>
      </div>
      <figure>
        <img src="${paths.confirmPath.replace(/\\/g, "/")}" alt="Paso final de confirmacion" />
        <figcaption>Paso final del checkout con el resumen y el boton para finalizar el pedido.</figcaption>
      </figure>
    </section>

    <p class="footer">Manual generado desde el frontend real del catalogo Flora.</p>
  </div>
</body>
</html>`;
}

function buildMockCatalog() {
  const categories = [
    [101, "Personalizado"],
    [102, "Flora Madres"],
    [103, "Flora Box"],
    [104, "Flora Canastos"],
    [105, "Flora Bouquets"],
    [106, "Corazones"],
    [107, "Maderas"],
    [108, "Ceramicas & Vidrios"],
    [109, "Ancheta"],
    [110, "Condolencias"],
    [111, "Flora Mujer"],
    [112, "Adicionales"],
    [113, "Primavera"],
    [114, "Bodas"],
    [115, "Dia Mujer"],
    [116, "Evento"],
  ];

  return {
    empresa: {
      id: 3,
      slug: "flora",
      nombre: "Floreria Flora",
      logoUrl: null,
      colorPrimario: "#d94b8a",
      barrios: [
        { id_barrio: 1, nombre_barrio: "Miramar", costo_domicilio: 15000, activo: true },
        { id_barrio: 2, nombre_barrio: "El Prado", costo_domicilio: 12000, activo: true },
        { id_barrio: 3, nombre_barrio: "Los Alpes", costo_domicilio: 18000, activo: true },
      ],
    },
    categorias: categories.map(([id, nombre]) => ({ id, nombre })),
    productos: [
      {
        id: 1,
        id_producto: 1,
        codigo_producto: "FLORA-0001",
        nombre: "Arreglo Personalizado Deluxe",
        precio: 120000,
        descripcion: "Arreglo personalizado con rosas y follaje.",
        imagen_url: null,
        nombre_categoria: "Personalizado",
        categoria_nombre: "Personalizado",
        categoria: { id: 101, nombre: "Personalizado" },
      },
      {
        id: 2,
        id_producto: 2,
        codigo_producto: "FLORA-0002",
        nombre: "Flora Madres Rosas",
        precio: 135000,
        descripcion: "Arreglo especial para madres.",
        imagen_url: null,
        nombre_categoria: "Flora Madres",
        categoria_nombre: "Flora Madres",
        categoria: { id: 102, nombre: "Flora Madres" },
      },
      {
        id: 3,
        id_producto: 3,
        codigo_producto: "FLORA-0015",
        nombre: "Flora Box Redonda 24 Rosas de Jardin",
        precio: 350000,
        descripcion: "Caja floral con 24 rosas de jardin.",
        imagen_url: null,
        nombre_categoria: "Flora Box",
        categoria_nombre: "Flora Box",
        categoria: { id: 103, nombre: "Flora Box" },
      },
      {
        id: 4,
        id_producto: 4,
        codigo_producto: "FLORA-0016",
        nombre: "Flora Box Grande 36 Rosas",
        precio: 360000,
        descripcion: "Arreglo elegante para ocasiones especiales.",
        imagen_url: null,
        nombre_categoria: "Flora Box",
        categoria_nombre: "Flora Box",
        categoria: { id: 103, nombre: "Flora Box" },
      },
      {
        id: 5,
        id_producto: 5,
        codigo_producto: "FLORA-0017",
        nombre: "Flora Bouquets Pastel",
        precio: 210000,
        descripcion: "Bouquet en tonos pastel.",
        imagen_url: null,
        nombre_categoria: "Flora Bouquets",
        categoria_nombre: "Flora Bouquets",
        categoria: { id: 105, nombre: "Flora Bouquets" },
      },
      {
        id: 6,
        id_producto: 6,
        codigo_producto: "FLORA-0018",
        nombre: "Flora Canastos Rosados",
        precio: 190000,
        descripcion: "Canasto floral con rosas y lirios.",
        imagen_url: null,
        nombre_categoria: "Flora Canastos",
        categoria_nombre: "Flora Canastos",
        categoria: { id: 104, nombre: "Flora Canastos" },
      },
    ],
    barrios: [
      { id: 1, nombre: "Miramar", costoDomicilio: 15000 },
      { id: 2, nombre: "El Prado", costoDomicilio: 12000 },
      { id: 3, nombre: "Los Alpes", costoDomicilio: 18000 },
    ],
  };
}

function createCdpClient(ws) {
  let id = 0;
  const pending = new Map();

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) {
        return;
      }

      pending.delete(message.id);

      if (message.error) {
        entry.reject(new Error(message.error.message || "CDP error"));
        return;
      }

      entry.resolve(message.result);
      return;
    }
  };

  return {
    send(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const messageId = ++id;
        pending.set(messageId, { resolve, reject });
        const payload = { id: messageId, method, params };

        if (sessionId) {
          payload.sessionId = sessionId;
        }

        ws.send(JSON.stringify(payload));
      });
    },
  };
}

async function startPreviewServer() {
  const previewProc = spawn(
    "npm",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4173"],
    {
      cwd: projectRoot,
      shell: true,
      stdio: "ignore",
    },
  );

  await waitForUrl(previewUrl);
  return previewProc;
}

async function resolveChromePath() {
  for (const candidate of chromeCandidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("No se encontro chrome.exe. Define CHROME_PATH o instala Google Chrome.");
}

async function waitForUrl(url, timeoutMs = 30000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }

    await delay(300);
  }

  throw new Error(`Timeout esperando ${url}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo leer ${url} (${response.status})`);
  }

  return await response.json();
}

async function waitForWebSocket(ws, timeoutMs = 15000) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("No fue posible abrir la conexion con Chrome"));
    }, timeoutMs);

    ws.onopen = () => {
      clearTimeout(timeout);
      resolve();
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error("Error al abrir WebSocket"));
    };
  });
}
