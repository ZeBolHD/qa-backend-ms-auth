import { MailerOptions } from "@nestjs-modules/mailer";
import { ConfigService } from "@nestjs/config";

export const getMailConfig = async (configService: ConfigService): Promise<MailerOptions> => {
  const transportUser = configService.get<string>("MAIL_TRANSPORT_USER");
  const transportPassword = configService.get<string>("MAIL_TRANSPORT_PASSWORD");
  const service = configService.get<string>("MAIL_TRANSPORT_SERVICE");
  const host = configService.get<string>("MAIL_TRANSPORT_HOST");
  const port = Number(configService.get<string>("MAIL_TRANSPORT_PORT"));
  const secure = configService.get<string>("MAIL_TRANSPORT_SECURE") === "true";

  return {
    transport: {
      service,
      host,
      port,
      secure,
      auth: {
        user: transportUser,
        pass: transportPassword,
        serviceClient: transportUser,
      },
    },
  };
};
