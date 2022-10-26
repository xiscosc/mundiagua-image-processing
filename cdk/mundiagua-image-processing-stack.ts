import { App, Duration, Stack, StackProps } from "aws-cdk-lib";
import {
  BlockPublicAccess,
  Bucket,
  BucketProps,
  CorsRule,
  HttpMethods,
} from "aws-cdk-lib/aws-s3";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
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
        runtime: Runtime.NODEJS_16_X,
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

    /*
     * DATA TABLES
     */

    const commonProps = {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "model", type: AttributeType.STRING },
      sortKey: { name: "s3Key", type: AttributeType.STRING },
    };

    // DOCUMENTS
    new Table(this, "uploaded-documents-" + this.props.stage, {
      tableName: "uploaded-documents-" + this.props.stage,
      ...commonProps,
    });

    // IMAGES
    new Table(this, "uploaded-images-" + this.props.stage, {
      tableName: "uploaded-images-" + this.props.stage,
      ...commonProps,
    });
  }
}
