import { App, Duration, Stack, StackProps } from "@aws-cdk/core";
import {
  BlockPublicAccess,
  Bucket,
  BucketProps,
  CorsRule,
  HttpMethods,
} from "@aws-cdk/aws-s3";
import { LambdaDestination } from "@aws-cdk/aws-s3-notifications";
import { Runtime } from "@aws-cdk/aws-lambda";
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";
import * as path from "path";

interface MundiaguaImageStackProps extends StackProps {
  stage: string;
  allowedOrigins: string[];
  imagesDestinationBucketArn: string;
}

export class MundiaguaImageProcessingStack extends Stack {
  private readonly props: MundiaguaImageStackProps;

  constructor(scope: App, id: string, props: MundiaguaImageStackProps) {
    super(scope, id, props);
    this.props = props;

    const corsRule: CorsRule = {
      allowedMethods: [HttpMethods.PUT, HttpMethods.POST],
      allowedOrigins: this.props.allowedOrigins,
      allowedHeaders: ["*"],
      exposedHeaders: ["Access-Control-Allow-Origin"],
    };
    const uploadBucketProps: BucketProps = {
      bucketName: "upload-images-mundiagua-" + this.props.stage,
      cors: [corsRule],
      lifecycleRules: [{ expiration: Duration.days(7) }],
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    };

    const imagesProcessingBucket = new Bucket(
      this,
      "mundiagua-processing-images-" + this.props.stage,
      uploadBucketProps
    );
    const imagesDestinationBucket = Bucket.fromBucketArn(
      this,
      "mundiagua-destination-images-" + this.props.stage,
      this.props.imagesDestinationBucketArn
    );

    const thumbnailLambda = new NodejsFunction(
      this,
      "thumbnailGeneratorImage-" + this.props.stage,
      {
        memorySize: 512,
        runtime: Runtime.NODEJS_14_X,
        handler: "handler",
        entry: path.join(__dirname, `/../src/images/generate-thumbnail.ts`),
        timeout: Duration.seconds(30),
        environment: {
          processingBucket: imagesProcessingBucket.bucketName,
          destinationBucket: imagesDestinationBucket.bucketName,
        },
        bundling: {
          minify: true,
          sourceMap: true,
          nodeModules: ["image-thumbnail", "sharp"],
        },
      }
    );

    imagesProcessingBucket.grantRead(thumbnailLambda);
    imagesDestinationBucket.grantReadWrite(thumbnailLambda);
    imagesProcessingBucket.addObjectCreatedNotification(
      new LambdaDestination(thumbnailLambda)
    );
  }
}
