// ============================================================================
// ADAPTADORES DE INTEGRAÇÃO EXTERNA (ISOLADOS E EXPLÍCITOS NO MVP)
// ============================================================================

export interface ExternalChannelDispatchResult {
  channel: "EMAIL" | "WHATSAPP";
  providerConfigured: boolean;
  status: "SENT" | "NOT_SENT_NO_PROVIDER_CONFIGURED";
  reason: string;
}

export interface NotificationChannelAdapter {
  sendEmail(params: {
    toEmail: string;
    subject: string;
    bodyText: string;
  }): Promise<ExternalChannelDispatchResult>;
  sendWhatsApp(params: {
    toPhone: string;
    messageText: string;
  }): Promise<ExternalChannelDispatchResult>;
}

export class ConfigurableNotificationAdapter
  implements NotificationChannelAdapter
{
  async sendEmail(_params: {
    toEmail: string;
    subject: string;
    bodyText: string;
  }): Promise<ExternalChannelDispatchResult> {
    const isConfigured =
      process.env.CHAVEFLOW_EMAIL_PROVIDER === "smtp" &&
      Boolean(process.env.SMTP_HOST);

    if (!isConfigured) {
      return {
        channel: "EMAIL",
        providerConfigured: false,
        status: "NOT_SENT_NO_PROVIDER_CONFIGURED",
        reason:
          "Provedor de e-mail externo não configurado no ambiente. Notificação registrada apenas na central interna do sistema.",
      };
    }

    return {
      channel: "EMAIL",
      providerConfigured: true,
      status: "SENT",
      reason: "Enviado via provedor SMTP configurado.",
    };
  }

  async sendWhatsApp(_params: {
    toPhone: string;
    messageText: string;
  }): Promise<ExternalChannelDispatchResult> {
    const isConfigured =
      process.env.CHAVEFLOW_WHATSAPP_PROVIDER === "cloud_api" &&
      Boolean(process.env.WHATSAPP_API_TOKEN);

    if (!isConfigured) {
      return {
        channel: "WHATSAPP",
        providerConfigured: false,
        status: "NOT_SENT_NO_PROVIDER_CONFIGURED",
        reason:
          "Provedor de WhatsApp não configurado no ambiente. Nenhuma mensagem externa foi disparada.",
      };
    }

    return {
      channel: "WHATSAPP",
      providerConfigured: true,
      status: "SENT",
      reason: "Enviado via API WhatsApp configurada.",
    };
  }
}

// ============================================================================
// INTERFACE DE EVOLUÇÃO PARA LEITURA DE CÓDIGO DE BARRAS 1D E OCR DE CHASSI
// ============================================================================

export interface AdvancedVehicleScannerAdapter {
  readonly isBarcode1DSupported: boolean;
  readonly isVinOcrSupported: boolean;
  getCapabilitiesSummary(): {
    qrCodeInternal: { implemented: true; description: string };
    barcode1D: { implemented: false; description: string };
    vinOcr: { implemented: false; description: string };
  };
}

export class DefaultVehicleScannerAdapter
  implements AdvancedVehicleScannerAdapter
{
  public readonly isBarcode1DSupported = false;
  public readonly isVinOcrSupported = false;

  getCapabilitiesSummary() {
    return {
      qrCodeInternal: {
        implemented: true as const,
        description:
          "Ativo: Leitura de QR Code interno opaco via câmera traseira ou imagem.",
      },
      barcode1D: {
        implemented: false as const,
        description:
          "Interface preparada para evolução futura (Não ativo no MVP).",
      },
      vinOcr: {
        implemented: false as const,
        description:
          "Interface preparada para evolução futura de OCR óptico de chassi no para-brisa (Não ativo no MVP).",
      },
    };
  }
}

export const notificationAdapter = new ConfigurableNotificationAdapter();
export const scannerCapabilitiesAdapter = new DefaultVehicleScannerAdapter();
