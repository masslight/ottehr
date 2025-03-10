import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';

// import * as sqs from 'aws-cdk-lib/aws-sqs';
import config from '../../deploy-config.json';

export class DeployTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    if (!('project_id' in config)) {
      throw new Error('project_id is required in config file');
    }

    const projectConfig: any = config;
    const projectIdentifier = projectConfig.project_id;

    // todo: can we create these without a stack?
    const domain = 'domain' in projectConfig ? projectConfig.domain : 'ottehr.com';
    const intakeSubdomain = 'intake_subdomain' in projectConfig ? projectConfig.intake_subdomain : 'intake';
    const ehrSubdomain = 'ehr_subdomain' in projectConfig ? projectConfig.ehr_subdomain : 'ehr';
    const intakeBucket = deployWebsite(this, 'intake', projectIdentifier, domain, intakeSubdomain);
    const ehrBucket = deployWebsite(this, 'ehr', projectIdentifier, domain, ehrSubdomain);
    setupCloudfront(this, 'intake', intakeBucket, projectIdentifier);
    setupCloudfront(this, 'ehr', ehrBucket, projectIdentifier);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'DeployTestQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}

function deployWebsite(
  scope: Construct,
  website: 'intake' | 'ehr',
  projectIdentifier: string,
  domain: string,
  subdomain: string
): s3.Bucket {
  const bucketTemp = new s3.Bucket(scope, `create-${website}-s3-bucket`, {
    publicReadAccess: true,
    websiteIndexDocument: 'index.html',
    websiteErrorDocument: 'index.html',
    blockPublicAccess: {
      blockPublicAcls: true,
      blockPublicPolicy: false,
      ignorePublicAcls: true,
      restrictPublicBuckets: false,
    },
    // websiteErrorDocument: ''
    bucketName: `ottehr-${projectIdentifier}-${subdomain}.${domain}`,
  });

  new s3deploy.BucketDeployment(scope, `upload-${website}-to-s3-bucket`, {
    destinationBucket: bucketTemp,
    sources: [s3deploy.Source.asset(`../../../apps/${website}/build`)],
  });
  return bucketTemp;
}

function setupCloudfront(scope: Construct, website: 'intake' | 'ehr', bucket: s3.Bucket, projectId: string): void {
  new cloudfront.Distribution(scope, `create-${website}-cloudfront-distribution`, {
    defaultBehavior: {
      origin: new cloudfront_origins.S3Origin(bucket),
    },
    comment: `ottehr-${website}-${projectId}`,
  });
}
