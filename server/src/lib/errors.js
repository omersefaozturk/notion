export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg = 'Geçersiz istek') => new HttpError(400, msg);
export const unauthorized = (msg = 'Oturum açmanız gerekiyor') => new HttpError(401, msg);
export const forbidden = (msg = 'Bu işlem için yetkiniz yok') => new HttpError(403, msg);
export const notFound = (msg = 'Bulunamadı') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);
