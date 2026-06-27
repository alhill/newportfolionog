import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class R2NotConfiguredError extends Error {
  constructor() {
    super(
      'Cloudflare R2 no está configurado. Define CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET_NAME.',
    );
    this.name = 'R2NotConfiguredError';
  }
}

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  objectKeyPrefix: string;
  publicBaseUrl: string;
}

function readConfig(): Partial<R2Config> {
  return {
    accountId: import.meta.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
    accessKeyId: import.meta.env.R2_ACCESS_KEY_ID?.trim(),
    secretAccessKey: import.meta.env.R2_SECRET_ACCESS_KEY?.trim(),
    bucketName: import.meta.env.R2_BUCKET_NAME?.trim(),
    objectKeyPrefix: import.meta.env.R2_OBJECT_KEY_PREFIX?.trim() ?? '',
    publicBaseUrl: import.meta.env.R2_PUBLIC_BASE_URL?.trim() ?? '',
  };
}

function requireConfig(): R2Config {
  const config = readConfig();

  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    throw new R2NotConfiguredError();
  }

  return {
    accountId: config.accountId,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucketName: config.bucketName,
    objectKeyPrefix: config.objectKeyPrefix ?? '',
    publicBaseUrl: config.publicBaseUrl ?? '',
  };
}

let client: S3Client | null = null;

function getClient(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = requireConfig();

  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return client;
}

export function resolveR2ObjectKey(key: string): string {
  const { objectKeyPrefix } = requireConfig();
  return objectKeyPrefix ? `${objectKeyPrefix}${key}` : key;
}

function resolveListPrefix(prefix?: string): string | undefined {
  const { objectKeyPrefix } = requireConfig();
  const combined = `${objectKeyPrefix}${prefix ?? ''}`;
  return combined || undefined;
}

export function isR2Configured(): boolean {
  const config = readConfig();
  return Boolean(
    config.accountId && config.accessKeyId && config.secretAccessKey && config.bucketName,
  );
}

export interface R2PutOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface R2ObjectResult {
  key: string;
  body: Uint8Array;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface R2ListOptions {
  prefix?: string;
  limit?: number;
  continuationToken?: string;
}

export interface R2ListedObject {
  key: string;
  size?: number;
  lastModified?: Date;
  etag?: string;
}

export interface R2ListResult {
  objects: R2ListedObject[];
  continuationToken?: string;
  isTruncated: boolean;
}

export async function putR2Object(
  key: string,
  body: PutObjectCommandInput['Body'],
  options: R2PutOptions = {},
): Promise<{ key: string; etag?: string }> {
  const { bucketName } = requireConfig();
  const objectKey = resolveR2ObjectKey(key);

  const response = await getClient().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: body,
      ContentType: options.contentType,
      CacheControl: options.cacheControl,
      Metadata: options.metadata,
    }),
  );

  return {
    key: objectKey,
    etag: response.ETag,
  };
}

export async function getR2Object(key: string): Promise<R2ObjectResult | null> {
  const { bucketName } = requireConfig();
  const objectKey = resolveR2ObjectKey(key);

  try {
    const response = await getClient().send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      }),
    );

    if (!response.Body) {
      return null;
    }

    const body = new Uint8Array(await response.Body.transformToByteArray());

    return {
      key: objectKey,
      body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      etag: response.ETag,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function headR2Object(key: string): Promise<Omit<R2ObjectResult, 'body'> | null> {
  const { bucketName } = requireConfig();
  const objectKey = resolveR2ObjectKey(key);

  try {
    const response = await getClient().send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      }),
    );

    return {
      key: objectKey,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      etag: response.ETag,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function deleteR2Object(key: string): Promise<void> {
  const { bucketName } = requireConfig();

  await getClient().send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: resolveR2ObjectKey(key),
    }),
  );
}

export async function listR2Objects(options: R2ListOptions = {}): Promise<R2ListResult> {
  const { bucketName } = requireConfig();

  const response = await getClient().send(
    new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: resolveListPrefix(options.prefix),
      MaxKeys: options.limit,
      ContinuationToken: options.continuationToken,
    }),
  );

  return {
    objects: (response.Contents ?? []).map((item) => ({
      key: item.Key ?? '',
      size: item.Size,
      lastModified: item.LastModified,
      etag: item.ETag,
    })),
    continuationToken: response.NextContinuationToken,
    isTruncated: response.IsTruncated ?? false,
  };
}

export async function getR2SignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const { bucketName } = requireConfig();

  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: bucketName,
      Key: resolveR2ObjectKey(key),
    }),
    { expiresIn: expiresInSeconds },
  );
}

export async function getR2SignedUploadUrl(
  key: string,
  options: { contentType?: string; expiresInSeconds?: number } = {},
): Promise<string> {
  const { bucketName } = requireConfig();
  const expiresInSeconds = options.expiresInSeconds ?? 3600;

  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucketName,
      Key: resolveR2ObjectKey(key),
      ContentType: options.contentType,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export function getR2PublicUrl(key: string): string | null {
  const { publicBaseUrl } = requireConfig();
  if (!publicBaseUrl) {
    return null;
  }

  const base = publicBaseUrl.replace(/\/$/, '');
  return `${base}/${resolveR2ObjectKey(key)}`;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error.name === 'NoSuchKey' || error.name === 'NotFound')
  );
}
