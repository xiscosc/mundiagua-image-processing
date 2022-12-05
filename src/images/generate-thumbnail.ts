import {
  S3Client,
  GetObjectCommand,
  GetObjectCommandInput,
  PutObjectCommand,
  PutObjectCommandInput,
  CopyObjectCommand,
  CopyObjectCommandInput,
} from "@aws-sdk/client-s3";
import { S3Event } from "aws-lambda";
const imageThumbnail = require("image-thumbnail");
import getStream from "get-stream";
import { Stream } from "stream";

export const handler = async (event: S3Event): Promise<any> => {
  const client = new S3Client({});
  await Promise.all(
    event.Records.map(async (entry: any) => {
      await generateThumbnail(entry.s3.object.key as string, client);
    })
  );
};

async function generateThumbnail(key: string, client: S3Client) {
  const params: GetObjectCommandInput = {
    Bucket: process.env.processingBucket as string,
    Key: key,
  };
  const file = await client.send(new GetObjectCommand(params));
  const imageOptions = {
    width: 100,
    height: 100,
    responseType: "buffer",
    fit: "cover",
  };

  const thumbnail = await imageThumbnail(
    await getStream.buffer(file.Body as Stream),
    imageOptions
  );
  const putThumbnailParams: PutObjectCommandInput = {
    Bucket: process.env.destinationBucket as string,
    Body: thumbnail,
    Key: `th/${key}`,
    ContentType: "image/jpeg",
  };

  const copyObjectParams: CopyObjectCommandInput = {
    Bucket: process.env.destinationBucket as string,
    Key: key,
    ContentType: "image/jpeg",
    CopySource: `${process.env.processingBucket}/${key}`,
  };

  await client.send(new PutObjectCommand(putThumbnailParams));
  await client.send(new CopyObjectCommand(copyObjectParams));
}
