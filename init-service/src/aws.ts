import { S3 } from "aws-sdk";

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  endpoint: process.env.S3_ENDPOINT,
});

export async function copyS3Folder(
  sourcePrefix: string,
  destinationPrefix: string,
  continuationToken: string
) {
  try {
    const listParams = {
      Bucket: process.env.S3_BUCKET ?? "",
      Prefix: sourcePrefix,
      ContinuationToken: continuationToken,
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
      return;
    }

    await Promise.all(
      listedObjects.Contents.map(async (object) => {
        if (!object.Key) return;
        let destinationKey = object.Key.replace(
          sourcePrefix,
          destinationPrefix
        );
        let copyParams = {
          Bucket: process.env.S3_BUCKET ?? "",
          CopySource: `${process.env.S3_BUCKET}/${object.Key}`,
          Key: destinationKey,
        };

        await s3.copyObject(copyParams).promise();
      })
    );

    if (listedObjects.IsTruncated) {
      listParams.ContinuationToken = listedObjects.NextContinuationToken ?? "";
      await copyS3Folder(
        sourcePrefix,
        destinationPrefix,
        listParams.ContinuationToken
      );
    }
  } catch (error) {
    console.error("Error copying S3 folder:", error);
  }
}

export async function saveToS3(
  key: string,
  filePath: string,
  content: string
): Promise<void> {
  const params = {
    Bucket: process.env.S3_BUCKET ?? "",
    Key: `${key}${filePath}`,
    Body: content,
  };

  await s3.putObject(params).promise();
}
