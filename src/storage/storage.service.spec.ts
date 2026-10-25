jest.mock('../config/envs', () => ({
  envs: { storage: { region: 'us-east-1', bucket: 'test-bucket' } },
}));

import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  const send = jest.spyOn(S3Client.prototype, 'send');
  const photo = {
    buffer: Buffer.from('image'),
    mimetype: 'image/png',
    originalname: '../../secret.html',
  } as Express.Multer.File;

  beforeEach(() => {
    send.mockReset().mockResolvedValue({} as never);
    service = new StorageService();
  });
  afterEach(() => service.onModuleDestroy());
  afterAll(() => send.mockRestore());

  it('sube con nombre único, tipo detectado y sin ACL', async () => {
    const first = await service.uploadFile(photo, 'reports');
    const second = await service.uploadFile(photo, 'reports');
    expect(first).toMatch(
      /^https:\/\/s3\.us-east-1\.amazonaws\.com\/test-bucket\/reports\/[a-f0-9-]+\.png$/,
    );
    expect(second).not.toBe(first);
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'test-bucket',
      ContentType: 'image/png',
      Body: photo.buffer,
    });
    expect(command.input).not.toHaveProperty('ACL');
  });

  it('borra únicamente la clave correspondiente a su URL', async () => {
    const url = await service.uploadFile(photo, 'reports');
    await service.deleteFile(url);
    const command = send.mock.calls[1][0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input.Key).toBe(url.split('/test-bucket/')[1]);
    await expect(
      service.deleteFile('https://example.com/other.png'),
    ).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('intenta compensar un error de subida y oculta detalles de AWS', async () => {
    send.mockRejectedValueOnce(new Error('UNSAFE_AWS_DETAILS') as never);
    await expect(service.uploadFile(photo, 'reports')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('registra la clave pendiente sin propagar secretos si falla la limpieza', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const url = await service.uploadFile(photo, 'reports');
    send.mockRejectedValueOnce(new Error('UNSAFE_AWS_DETAILS') as never);
    await expect(service.deleteFile(url)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('objeto huérfano reports/'),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('UNSAFE_AWS_DETAILS');
    log.mockRestore();
  });
});
