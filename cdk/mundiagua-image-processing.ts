#!/usr/bin/env node
import "source-map-support/register";
import { MundiaguaImageProcessingStack } from "./mundiagua-image-processing-stack";
import { App } from "@aws-cdk/core";

const app = new App();
const stage: string = process.env.stage as string;
const imagesDestinationBucketArn: string = process.env.imagesDestinationBucketArn as string;
const allowedOrigins: string[] = (process.env.allowedOrigins as string).split(",");

const imageStackProps = {
  stage: stage,
  allowedOrigins: allowedOrigins,
  imagesDestinationBucketArn: imagesDestinationBucketArn,
};

new MundiaguaImageProcessingStack(
  app,
  "MundiaguaImageProcessingStack-" + stage,
  imageStackProps
);
