import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

async function login(page: Page, email = "gestor@pinauto.demo") {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("E2e-chaveflow-password!");
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page).toHaveURL(
    email.includes("cliente.demo") ? /\/cliente$/ : /\/app$/,
  );
}

test("gestor cadastra, edita e remove foto; gera QR legível e imprime somente etiquetas", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.goto("/app/veiculos/novo");
  await page
    .getByLabel("Código interno *", { exact: true })
    .fill("E2E-FOTO-001");
  await page
    .getByLabel("Chassi (VIN) *", { exact: true })
    .fill("9BWZZZ377VT004251");
  await page.getByLabel("Marca *", { exact: true }).fill("BYD");
  await page.getByLabel("Modelo *", { exact: true }).fill("Dolphin Teste");
  await page.getByLabel("Versão / motorização *", { exact: true }).fill("Plus");
  await page.getByLabel("Cor *", { exact: true }).fill("Branco");
  const photo = await sharp({
    create: { width: 320, height: 240, channels: 3, background: "#1684D8" },
  })
    .png()
    .toBuffer();
  await page
    .locator("#vehicle-photo")
    .setInputFiles({ name: "carro.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByAltText("Prévia da foto do veículo")).toBeVisible();
  await page
    .getByRole("button", { name: "Cadastrar veículo", exact: true })
    .click();
  await expect(page.getByText("Veículo salvo com sucesso.")).toBeVisible();
  const detailUrl = page.url();
  const vehicleImage = page.getByAltText("BYD Dolphin Teste", { exact: true });
  await expect(vehicleImage).toHaveAttribute(
    "src",
    /\/api\/vehicles\/.+\/photo\?v=/,
  );
  const photoUrl = await vehicleImage.getAttribute("src");
  const response = await page.request.get(photoUrl!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/webp");
  await page.reload();
  await expect(vehicleImage).toBeVisible();
  await page.getByRole("button", { name: "Editar Cadastro" }).click();
  await page.getByLabel("Cor *", { exact: true }).fill("Branco Pérola");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "BYD Dolphin Teste", exact: true }),
  ).toBeVisible();
  await expect(vehicleImage).toHaveAttribute("src", photoUrl!);

  await page
    .getByRole("link", { name: "Gerar etiquetas de outros carros" })
    .click();
  await page.getByRole("button", { name: /Gerar 1 etiqueta/ }).click();
  const qrImage = page.getByAltText("QR Code do veículo E2E-FOTO-001");
  await expect(qrImage).toBeVisible();
  const qrSvgUrl = await qrImage.getAttribute("src");
  const svg = decodeURIComponent(qrSvgUrl!.split(",")[1]);
  // Decode the actual rendered QR bitmap, not an expected string from the generator.
  const pixels = await sharp(Buffer.from(svg))
    .resize(600, 600)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const jsQR = (await import("jsqr")).default;
  const decoded = jsQR(
    new Uint8ClampedArray(pixels.data),
    pixels.info.width,
    pixels.info.height,
  );
  expect(decoded?.data).toMatch(/^http:\/\/127\.0\.0\.1:3101\/q\//);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Baixar QR Code" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("qr-E2E-FOTO-001.svg");
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("heading", { name: "Gerar QR Code", exact: true }),
  ).toBeHidden();
  await expect(qrImage).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("etiqueta-impressao.png"),
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.goto(decoded!.data);
  await expect(
    page.getByRole("region", { name: "Resultado do escaneamento" }),
  ).toContainText("Dolphin Teste");
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Editar Cadastro" }).click();
  await page.getByRole("button", { name: "Remover foto" }).click();
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(vehicleImage).toHaveAttribute("src", "/vehicle-placeholder.svg");
  expect(errors).toEqual([]);
});

test("admin navega pelos módulos e cliente acessa apenas seu portal", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "admin@pinauto.demo");
  for (const path of [
    "/app",
    "/app/negociacoes",
    "/app/negociacoes/nova",
    "/app/negociacoes/deal-001",
    "/app/clientes",
    "/app/veiculos",
    "/app/minhas-tarefas",
    "/app/pendencias",
    "/app/aprovacoes",
    "/app/relatorios",
    "/app/procedimentos",
    "/app/configuracoes",
    "/app/escanear",
    "/app/qr-codes",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBeLessThan(400);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Não foi possível carregar o sistema",
      }),
    ).toHaveCount(0);
  }
  await page.context().clearCookies();
  await login(page, "helena.martins@cliente.demo");
  await page.goto("/cliente/negociacoes/deal-001");
  await expect(page.locator("h1").first()).toBeVisible();
  await page.goto("/app/qr-codes");
  await expect(page).toHaveURL(/\/cliente$/);
  expect(errors).toEqual([]);
});

test("câmera conecta o vídeo após montar o leitor e encerra ao sair", async ({
  page,
}) => {
  await login(page);
  await page.addInitScript(() => {
    let stopped = false;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const stream = canvas.captureStream(5);
    const track = stream.getVideoTracks()[0];
    const stop = track.stop.bind(track);
    track.stop = () => {
      stopped = true;
      stop();
    };
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => stream,
    });
    Object.defineProperty(window, "testCameraStopped", { get: () => stopped });
  });
  await page.goto("/app/escanear");
  await page.getByRole("button", { name: "Ativar Câmera Traseira" }).click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video: HTMLVideoElement) => Boolean(video.srcObject)),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Encerrar Câmera" }).click();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { testCameraStopped?: boolean }).testCameraStopped,
    ),
  ).toBe(true);
});

test("importação de arquivo CSV invalida prévia alterada e confirma sem duplicação", async ({
  page,
}) => {
  await login(page);
  await page.goto("/app/veiculos");
  await page.getByRole("button", { name: "Importar CSV", exact: true }).click();
  const text =
    'codigo_interno;chassi;marca;modelo;versao;ano_fab;ano_mod;cor;condicao;placa;data_entrada;observacoes\nE2E-CSV-001;9BWZZZ377VT004253;BYD;Dolphin CSV;Plus;2026;2027;Branco;NOVO;;2026-11-12;"Conferir cor; acessórios, manual"';
  await page
    .getByLabel("Escolher arquivo CSV")
    .setInputFiles({
      name: "estoque.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(text),
    });
  await expect(page.locator("#csv-text")).toHaveValue(text);
  await page
    .getByRole("button", { name: "1. Gerar Prévia e Validar Linhas" })
    .click();
  const confirm = page.getByRole("button", {
    name: /2\. Confirmar Importação/,
  });
  await expect(confirm).toBeEnabled();
  await page.locator("#csv-text").fill(text + "\n");
  await expect(confirm).toBeDisabled();
  await page
    .getByRole("button", { name: "1. Gerar Prévia e Validar Linhas" })
    .click();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(
    page.getByRole("status").filter({ hasText: "Importação concluída:" }),
  ).toContainText("1 veículo(s)");
  await expect(confirm).toBeDisabled();
  await page
    .getByRole("textbox", { name: /Buscar veículos/ })
    .fill("E2E-CSV-001");
  await expect(
    page.getByRole("heading", { name: "BYD Dolphin CSV • Branco" }),
  ).toHaveCount(1);
});

test("QR preserva destino após login e vendedor não acessa geração gerencial", async ({
  page,
}) => {
  await page.goto("/q/qr-pin-byd-001-songplus");
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await page.locator('input[type="email"]').fill("vendedor@pinauto.demo");
  await page.locator('input[type="password"]').fill("E2e-chaveflow-password!");
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(
    page.getByRole("region", { name: "Resultado do escaneamento" }),
  ).toContainText("Song Plus");
  await page.goto("/app/qr-codes");
  await expect(page).toHaveURL(/\/app\/veiculos$/);
  await expect(
    page.getByRole("link", { name: "Gerar QR Code", exact: true }),
  ).toHaveCount(0);
  const unauthorized = await page.request.post("/api/vehicles", {
    data: { action: "GENERATE_QR_LABELS", vehicleIds: ["veh-001"] },
  });
  expect(unauthorized.status()).toBe(403);
});

test("menu móvel mantém foco, filtros recuperam resultados e falha de rede mantém formulário", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Menu principal",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Sair da conta" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Abrir menu de navegação" }),
  ).toBeFocused();
  await page.goto("/app/veiculos");
  await page
    .getByRole("textbox", { name: /Buscar veículos/ })
    .fill("nenhum-carro-xyz");
  await expect(
    page.getByText("Nenhum veículo corresponde aos filtros"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(
    page.getByText("Nenhum veículo corresponde aos filtros"),
  ).toBeHidden();
  await page.goto("/app/veiculos/novo");
  await page
    .getByLabel("Código interno *", { exact: true })
    .fill("E2E-REDE-001");
  await page
    .getByLabel("Chassi (VIN) *", { exact: true })
    .fill("9BWZZZ377VT004252");
  await page.getByLabel("Marca *", { exact: true }).fill("BYD");
  await page.getByLabel("Modelo *", { exact: true }).fill("Dolphin");
  await page.getByLabel("Versão / motorização *", { exact: true }).fill("Plus");
  await page.getByLabel("Cor *", { exact: true }).fill("Branco");
  await page.route("**/api/vehicles", (route) => route.abort("failed"));
  await page
    .getByRole("button", { name: "Cadastrar veículo", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "O cadastro ainda não foi salvo" }),
  ).toContainText("Não foi possível conectar");
  await expect(
    page.getByLabel("Código interno *", { exact: true }),
  ).toHaveValue("E2E-REDE-001");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
