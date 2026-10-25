import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { envs } from '../config/envs';

@Injectable()
export class StorageService implements OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly client = new S3Client({
    region: envs.storage.region,
    maxAttempts: 3,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 },
  });

  private publicBaseUrl(): string {
    const { bucket, region } = envs.storage;
    if (!bucket || !region) {
      throw new ServiceUnavailableException(
        'Configura AWS_REGION y AWS_S3_BUCKET para subir fotos',
      );
    }
    return `https://s3.${region}.amazonaws.com/${bucket}/`;
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const baseUrl = this.publicBaseUrl();
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensions[file.mimetype];
    if (!extension || !/^[a-zA-Z0-9_-]+$/.test(folder)) {
      throw new Error('Tipo de imagen o carpeta no permitido');
    }
    const key = `${folder}/${randomUUID()}.${extension}`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: envs.storage.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch {
      // Un timeout puede ocurrir después de que S3 haya recibido el objeto.
      await this.deleteFile(baseUrl + key);
      throw new ServiceUnavailableException(
        'No se pudo subir la foto; el reporte no se guardó',
      );
    }
    return baseUrl + key;
  }

  async deleteFile(photoUrl: string): Promise<void> {
    const baseUrl = this.publicBaseUrl();
    const key = photoUrl.startsWith(baseUrl)
      ? photoUrl.slice(baseUrl.length)
      : '';
    if (!/^[a-zA-Z0-9_-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) {
      throw new Error('La foto no pertenece al almacenamiento de reportes');
    }
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: envs.storage.bucket,
          Key: key,
        }),
      );
    } catch {
      this.logger.error(
        `No se pudo eliminar el objeto huérfano ${key}; requiere revisión en S3.`,
      );
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
