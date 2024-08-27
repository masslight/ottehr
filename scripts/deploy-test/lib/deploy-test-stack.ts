import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

// import * as sqs from 'aws-cdk-lib/aws-sqs';
import config from "../config.json";

export class DeployTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    if (!("project_identifier" in config)) {
      throw new Error("project_identifier is required");
    }

    const projectConfig: any = config;
    const projectIdentifier = projectConfig.project_identifier;
    let domain = "domain" in projectConfig ? projectConfig.domain : "ottehr.com";
    let intakeSubdomain = "intake_subdomain" in projectConfig ? projectConfig.intake_subdomain : "intake";
    let ehrSubdomain = "ehr_subdomain" in projectConfig ? projectConfig.ehr_subdomain : "ehr";
    

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'DeployTestQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
    const intakeBucket = new s3.Bucket(this, "create-intake-s3-bucket", {
      publicReadAccess: true,
      websiteIndexDocument: 'index.html',
      blockPublicAccess: {
        blockPublicAcls: true,
        blockPublicPolicy: false,
        ignorePublicAcls: true,
        restrictPublicBuckets: false,
      },
      // websiteErrorDocument: ''
      bucketName: `ottehr-${projectIdentifier}-${intakeSubdomain}.${domain}`
    });

    new s3deploy.BucketDeployment(this, "upload-intake-to-s3-bucket", {
      destinationBucket: intakeBucket,
      sources: [s3deploy.Source.asset("../../packages/telemed-intake/app/build")]
    })
  }
}
